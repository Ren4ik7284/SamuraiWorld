import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VipOrderEntity, OrderStatus } from '../../modules/database/entities/vip-order.entity';
import { McExecutorService, GrantVipOptions, GrantVipResponse } from './mc-executor.service';

export interface PendingVipOrder {
  orderId: string;
  nickname: string;
  amount: number;
  type: 'vip' | 'pass';
  status: 'PENDING' | 'DELIVERED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string;
  deliveryResult?: any;
}
@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private cronTimer?: NodeJS.Timeout;
  constructor(
    private readonly mcExecutor: McExecutorService,
    @InjectRepository(VipOrderEntity)
    private readonly orderRepo: Repository<VipOrderEntity>,
  ) {}

  public get wallet(): string {
    return (process.env.YOOMONEY_WALLET || '').trim();
  }
  public get secretKey(): string {
    return (process.env.YOOMONEY_SECRET_KEY || '').trim();
  }
  public get clientId(): string {
    return (process.env.YOOMONEY_CLIENT_ID || '').trim();
  }
  public get accessToken(): string {
    return (process.env.YOOMONEY_ACCESS_TOKEN || '').trim();
  }
  onModuleInit() {
    this.logger.log('[Payments Cron] Starting — interval 15s, retries up to 10 per order');
    this.cronTimer = setInterval(() => {
      this.processPendingQueue().catch((err) => {
        this.logger.error(`[Payments Cron] ${err.message}`);
      });
    }, 15000);
  }
  onModuleDestroy() {
    if (this.cronTimer) {
      clearInterval(this.cronTimer);
      this.logger.log('[Payments Cron] Stopped');
    }
  }
  verifyYooMoneyNotification(params: Record<string, string>): boolean {
    const secret = this.secretKey;
    if (!secret) {
      this.logger.warn('[YooMoney] YOOMONEY_SECRET_KEY не задан — верификация пропущена');
      return true;
    }
    const receivedSign = params['sign'];
    if (receivedSign) {
      const filtered = { ...params };
      delete filtered['sign'];
      const sortedKeys = Object.keys(filtered).sort();
      const signString = sortedKeys
        .map((k) => `${k}=${encodeURIComponent(filtered[k] ?? '')}`)
        .join('&');
      const expectedSign = crypto
        .createHmac('sha256', secret)
        .update(signString, 'utf8')
        .digest('hex');
      try {
        if (crypto.timingSafeEqual(Buffer.from(expectedSign, 'hex'), Buffer.from(receivedSign, 'hex'))) {
          return true;
        }
      } catch (e: any) {
        this.logger.error(`[YooMoney Sign] Ошибка сравнения sign: ${e.message}`);
      }
    }
    const receivedSha1 = params['sha1_hash'];
    if (receivedSha1) {
      const sha1String = [
        params['notification_type'] || '',
        params['operation_id'] || '',
        params['amount'] || '',
        params['currency'] || '',
        params['datetime'] || '',
        params['sender'] || '',
        params['codepro'] || '',
        secret,
        params['label'] || '',
      ].join('&');
      const expectedSha1 = crypto.createHash('sha1').update(sha1String, 'utf8').digest('hex');
      try {
        if (crypto.timingSafeEqual(Buffer.from(expectedSha1, 'hex'), Buffer.from(receivedSha1, 'hex'))) {
          return true;
        }
      } catch (e: any) {
        this.logger.error(`[YooMoney SHA1] Ошибка сравнения sha1_hash: ${e.message}`);
      }
    }
    this.logger.warn('[YooMoney] Подпись уведомления не прошла проверку');
    return false;
  }
  /** Конвертирует VipOrderEntity в PendingVipOrder интерфейс */
  private entityToOrder(e: VipOrderEntity): PendingVipOrder {
    return {
      orderId: e.orderId,
      nickname: e.nickname,
      amount: Number(e.amount),
      type: e.type,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      attempts: e.attempts,
      lastError: e.lastError ?? undefined,
      deliveryResult: e.deliveryResult,
    };
  }

  public async getPendingQueue(): Promise<PendingVipOrder[]> {
    const orders = await this.orderRepo.find({ order: { createdAt: 'DESC' } });
    return orders.map((o) => this.entityToOrder(o));
  }

  public async registerPendingOrder(
    orderId: string,
    nickname: string,
    amount: number,
    type: 'vip' | 'pass' = 'vip',
  ): Promise<PendingVipOrder> {
    const now = new Date();
    let entity = await this.orderRepo.findOne({ where: { orderId } });
    if (!entity) {
      entity = this.orderRepo.create({
        orderId,
        nickname: nickname.trim(),
        amount,
        type,
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
        attempts: 0,
      });
    } else {
      entity.updatedAt = now;
    }
    await this.orderRepo.save(entity);
    return this.entityToOrder(entity);
  }

  /** Помечает пользователя как VIP в таблице users (через AuthService — не нужно, VIP хранится в orders) */
  updatePlayerVipStatus(_nickname: string): void {
    // VIP-статус теперь определяется по наличию DELIVERED-заказа в таблице vip_orders.
    // Этот метод оставлен для обратной совместимости но больше не пишет в /tmp.
    this.logger.log(`[VIP] Статус VIP обновлён в таблице orders для: ${_nickname}`);
  }


  async checkPaymentViaApi(orderId: string, expectedAmount?: number): Promise<boolean> {
    const token = this.accessToken;
    if (!token) {
      this.logger.warn('[YooMoney API] YOOMONEY_ACCESS_TOKEN не задан — пропускаем проверку');
      return false;
    }
    try {
      const params = new URLSearchParams({
        type: 'deposition',    
        label: orderId,        
        records: '10',
      });
      const resp = await fetch('https://yoomoney.ru/api/operation-history', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        this.logger.warn(`[YooMoney API] operation-history error ${resp.status}: ${errText}`);
        return false;
      }
      const data: any = await resp.json();
      if (data.error) {
        this.logger.warn(`[YooMoney API] operation-history returned error: ${data.error}`);
        return false;
      }
      const operations: any[] = data.operations || [];
      const found = operations.find((op) => {
        if (op.label !== orderId) return false;
        if (op.status !== 'success') return false;
        if (expectedAmount && Math.abs(parseFloat(op.amount) - expectedAmount) > 0.01) {
          this.logger.warn(
            `[YooMoney API] Сумма не совпадает: ожидали ${expectedAmount}, получили ${op.amount} (label: ${orderId})`
          );
          return false;
        }
        return true;
      });
      if (found) {
        this.logger.log(
          `[YooMoney API] ✅ Платёж подтверждён: ${found.amount} руб. op_id=${found.operation_id} label=${orderId}`
        );
        return true;
      }
      this.logger.log(`[YooMoney API] Платёж по label ${orderId} не найден в operation-history`);
      return false;
    } catch (err: any) {
      this.logger.error(`[YooMoney API] Ошибка запроса operation-history: ${err.message}`);
      return false;
    }
  }
  public async processPendingQueue(): Promise<void> {
    const pendingOrders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.status = :pending OR (o.status = :failed AND o.attempts < 10)', {
        pending: 'PENDING',
        failed: 'FAILED',
      })
      .getMany();

    if (pendingOrders.length === 0) return;
    this.logger.log(`[Cron] Processing ${pendingOrders.length} pending order(s)`);

    for (const item of pendingOrders) {
      item.attempts += 1;
      item.updatedAt = new Date();
      try {
        if (this.accessToken && item.orderId.startsWith('YM-')) {
          const isPaid = await this.checkPaymentViaApi(item.orderId, Number(item.amount));
          if (!isPaid) {
            this.logger.log(
              `[Cron WAIT] Платёж ${item.orderId} ещё не подтверждён в ЮMoney API — ждём`
            );
            item.status = 'PENDING';
            item.lastError = 'Платёж не найден в ЮMoney operation-history';
            await this.orderRepo.save(item);
            continue;
          }
        }
        this.updatePlayerVipStatus(item.nickname);
        const execResult = item.type === 'pass'
          ? await this.mcExecutor.grantPassInMinecraft(item.nickname)
          : await this.mcExecutor.grantVipInMinecraft(item.nickname);
        const hasSuccess = execResult.results.some((r) => r.success);
        if (hasSuccess) {
          item.status = 'DELIVERED';
          item.deliveryResult = execResult;
          item.lastError = null;
          this.logger.log(`[Cron OK] ${item.type} delivered to ${item.nickname} (order: ${item.orderId})`);
        } else {
          item.status = 'FAILED';
          item.lastError = execResult.results.map((r) => r.error || r.message).join('; ');
          this.logger.warn(`[Cron RETRY ${item.attempts}/10] ${item.nickname}: ${item.lastError}`);
        }
      } catch (err: any) {
        item.status = 'FAILED';
        item.lastError = err.message;
        this.logger.error(`[Cron ERR] ${item.nickname}: ${err.message}`);
      }
      await this.orderRepo.save(item);
    }
  }
  private buildYooMoneyPayUrl(
    orderId: string,
    amount: number,
    targets: string,
  ): string {
    const wallet = this.wallet;
    if (!wallet) {
      this.logger.warn('[YooMoney] YOOMONEY_WALLET не задан — ссылка не сформирована');
      return '';
    }
    const params = new URLSearchParams({
      receiver: wallet,
      'quickpay-form': 'shop',
      targets,
      paymentType: 'AC',
      sum: amount.toFixed(2),
      label: orderId,
      successURL: `https://samuraiworld.ru/store?payment=success&order=${encodeURIComponent(orderId)}`,
    });
    return `https://yoomoney.ru/quickpay/confirm?${params.toString()}`;
  }
  async createYooMoneyOrder(body: { nickname: string; promoCode?: string }) {
    const nick = (body.nickname || '').trim();
    if (!nick || !/^[a-zA-Z0-9_]{3,16}$/.test(nick)) {
      throw new BadRequestException('Укажите верный игровой никнейм Minecraft (3-16 символов)');
    }
    let amount = 200;
    const cleanPromo = (body.promoCode || '').trim().toUpperCase();
    if (cleanPromo === 'SAMURAI' || cleanPromo === 'ROLLY') {
      amount = 180;
    } else if (cleanPromo === 'START') {
      amount = 170;
    }
    const orderId = `YM-VIP-${nick.toUpperCase()}-${Date.now()}`;
    await this.registerPendingOrder(orderId, nick, amount, 'vip');
    const payUrl = this.buildYooMoneyPayUrl(
      orderId,
      amount,
      `Покупка VIP статуса SamuraiWorld для ${nick}`,
    );
    return {
      payUrl,
      orderId,
      amount,
      message: payUrl
        ? 'Ссылка на оплату VIP через ЮMoney успешно сгенерирована'
        : 'Создан заказ VIP. Для завершения укажите YOOMONEY_WALLET в .env',
    };
  }
  async createPassOrder(body: { nickname: string }) {
    const nick = (body.nickname || '').trim();
    if (!nick || !/^[a-zA-Z0-9_]{3,16}$/.test(nick)) {
      throw new BadRequestException('Укажите верный игровой никнейм Minecraft (3-16 символов)');
    }
    const amount = 150;
    const orderId = `YM-PASS-${nick.toUpperCase()}-${Date.now()}`;
    await this.registerPendingOrder(orderId, nick, amount, 'pass');
    const payUrl = this.buildYooMoneyPayUrl(
      orderId,
      amount,
      `Покупка Проходки на сервер SamuraiWorld для ${nick}`,
    );
    return {
      payUrl,
      orderId,
      amount,
      message: payUrl
        ? 'Ссылка на оплату Проходки через ЮMoney успешно сгенерирована'
        : 'Создан заказ Проходки. Для завершения укажите YOOMONEY_WALLET в .env',
    };
  }
  private async grantPrivilege(
    nick: string,
    type: 'vip' | 'pass',
    options: GrantVipOptions,
    orderId: string,
  ): Promise<{ status: string; message: string; result: GrantVipResponse }> {
    const execResult = type === 'pass'
      ? await this.mcExecutor.grantPassInMinecraft(nick, options)
      : await this.mcExecutor.grantVipInMinecraft(nick, options);
    const hasSuccess = execResult.results.some((r) => r.success);
    const entity = await this.orderRepo.findOne({ where: { orderId } });
    if (entity) {
      entity.status = hasSuccess ? 'DELIVERED' : 'PENDING';
      entity.deliveryResult = execResult;
      entity.updatedAt = new Date();
      await this.orderRepo.save(entity);
    }
    const label = type === 'pass' ? 'Проходка' : 'VIP статус';
    if (!hasSuccess) {
      return {
        status: 'PENDING_CRON',
        message: `${label} зачислена аккаунту ${nick} и передана в Cron очередь авто-выдачи.`,
        result: execResult,
      };
    }
    return {
      status: 'SUCCESS',
      message: `${label} успешно активирована в Minecraft для игрока ${nick}!`,
      result: execResult,
    };
  }
  async grantVipStatus(body: {
    nickname: string;
    pteroKey?: string;
    pteroServerId?: string;
    pteroUrl?: string;
    rconHost?: string;
    rconPort?: string | number;
    rconPassword?: string;
    customCommand?: string;
    orderId?: string;
  }): Promise<{ status: string; message: string; result: GrantVipResponse }> {
    const nick = (body.nickname || '').trim();
    if (!nick || nick.length < 3) {
      throw new BadRequestException('Укажите правильный игровой никнейм Minecraft');
    }
    const orderId = body.orderId || `DIRECT-VIP-${nick.toUpperCase()}-${Date.now()}`;
    await this.registerPendingOrder(orderId, nick, 200, 'vip');
    const options: GrantVipOptions = {};
    if (body.pteroKey) options.pteroKey = body.pteroKey;
    if (body.pteroServerId) options.pteroServerId = body.pteroServerId;
    if (body.pteroUrl) options.pteroUrl = body.pteroUrl;
    if (body.rconHost) options.rconHost = body.rconHost;
    if (body.rconPort) options.rconPort = Number(body.rconPort);
    if (body.rconPassword) options.rconPassword = body.rconPassword;
    if (body.customCommand) {
      options.commands = [
        body.customCommand.replace('{nickname}', nick),
        `say [SamuraiWorld] Igrok ${nick} poluchil VIP status!`,
      ];
    }
    this.updatePlayerVipStatus(nick);
    return this.grantPrivilege(nick, 'vip', options, orderId);
  }
  async grantPassStatus(body: {
    nickname: string;
    pteroKey?: string;
    pteroServerId?: string;
    pteroUrl?: string;
    rconHost?: string;
    rconPort?: string | number;
    rconPassword?: string;
    orderId?: string;
  }): Promise<{ status: string; message: string; result: GrantVipResponse }> {
    const nick = (body.nickname || '').trim();
    if (!nick || nick.length < 3) {
      throw new BadRequestException('Укажите правильный игровой никнейм Minecraft');
    }
    const orderId = body.orderId || `DIRECT-PASS-${nick.toUpperCase()}-${Date.now()}`;
    await this.registerPendingOrder(orderId, nick, 150, 'pass');
    const options: GrantVipOptions = {};
    if (body.pteroKey) options.pteroKey = body.pteroKey;
    if (body.pteroServerId) options.pteroServerId = body.pteroServerId;
    if (body.pteroUrl) options.pteroUrl = body.pteroUrl;
    if (body.rconHost) options.rconHost = body.rconHost;
    if (body.rconPort) options.rconPort = Number(body.rconPort);
    if (body.rconPassword) options.rconPassword = body.rconPassword;
    this.updatePlayerVipStatus(nick);
    return this.grantPrivilege(nick, 'pass', options, orderId);
  }
  async handleYooMoneyWebhook(params: Record<string, string>) {
    if (!this.verifyYooMoneyNotification(params)) {
      throw new ForbiddenException('Неверная подпись ЮMoney уведомления');
    }
    if (params['test_notification'] === 'true') {
      this.logger.log('[YooMoney Webhook] Тестовое уведомление — игнорируем');
      return { status: 'OK', message: 'Тестовое уведомление принято' };
    }
    const notificationType = params['notification_type'] || '';
    const supportedTypes = ['p2p-incoming', 'card-incoming'];
    if (!supportedTypes.includes(notificationType)) {
      this.logger.log(`[YooMoney Webhook] Неизвестный тип уведомления: ${notificationType}`);
      return { status: 'IGNORED', message: 'Тип уведомления не поддерживается' };
    }
    if (params['unaccepted'] === 'true') {
      this.logger.warn('[YooMoney Webhook] Перевод захолдирован (unaccepted=true)');
      return { status: 'IGNORED', message: 'Перевод захолдирован' };
    }
    const orderId = (params['label'] || '').trim();
    const amount = parseFloat(params['amount'] || '0');
    if (!orderId) {
      this.logger.warn('[YooMoney Webhook] Поле label отсутствует — невозможно идентифицировать заказ');
      return { status: 'IGNORED', message: 'Отсутствует label — невозможно идентифицировать заказ' };
    }
    let orderType: 'vip' | 'pass' = 'vip';
    let nick = 'Player';
    const vipMatch = orderId.match(/^YM-VIP-([A-Za-z0-9_]+)-\d+$/);
    const passMatch = orderId.match(/^YM-PASS-([A-Za-z0-9_]+)-\d+$/);
    if (vipMatch) {
      orderType = 'vip';
      nick = vipMatch[1];
    } else if (passMatch) {
      orderType = 'pass';
      nick = passMatch[1];
    } else {
      const existingOrder = await this.orderRepo.findOne({ where: { orderId } });
      if (existingOrder) {
        orderType = existingOrder.type;
        nick = existingOrder.nickname;
      } else {
        this.logger.warn(`[YooMoney Webhook] Не удалось идентифицировать заказ по label: ${orderId}`);
        return { status: 'IGNORED', message: `Заказ с label ${orderId} не найден` };
      }
    }
    this.logger.log(`[YooMoney Webhook] Входящий перевод: ${amount} руб. для ${nick} (${orderType}) — orderId: ${orderId}`);
    await this.registerPendingOrder(orderId, nick, amount, orderType);
    this.updatePlayerVipStatus(nick);
    const mcDelivery = orderType === 'pass'
      ? await this.mcExecutor.grantPassInMinecraft(nick)
      : await this.mcExecutor.grantVipInMinecraft(nick);
    const hasSuccess = mcDelivery.results.some((r) => r.success);
    const entity = await this.orderRepo.findOne({ where: { orderId } });
    if (entity) {
      entity.status = hasSuccess ? 'DELIVERED' : 'PENDING';
      entity.deliveryResult = mcDelivery;
      entity.updatedAt = new Date();
      await this.orderRepo.save(entity);
    }
    const label = orderType === 'pass' ? 'Проходка' : 'VIP';
    this.logger.log(`[YooMoney Webhook] ${label} -> ${nick} (order: ${orderId}) delivered=${hasSuccess}`);
    return {
      status: 'OK',
      message: hasSuccess
        ? `${label} выдан в игре для ${nick}`
        : `${label} зачислен в базу и передан в Cron для авто-выдачи игроку ${nick}`,
      minecraftDelivery: mcDelivery,
    };
  }
}

