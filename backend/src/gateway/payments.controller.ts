import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Get, Query, Param, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { PaymentsService } from '../microservices/payments/payments.service';
import { JwtAuthGuard, AuthenticatedRequest } from '../modules/auth/jwt-auth.guard';
import { AuthService } from '../modules/auth/auth.service';
export class GrantVipDto {
  @IsString()
  @IsNotEmpty()
  nickname: string;
  @IsString()
  @IsOptional()
  pteroKey?: string;
  @IsString()
  @IsOptional()
  pteroServerId?: string;
  @IsString()
  @IsOptional()
  pteroUrl?: string;
  @IsString()
  @IsOptional()
  rconHost?: string;
  @IsOptional()
  rconPort?: string | number;
  @IsString()
  @IsOptional()
  rconPassword?: string;
  @IsString()
  @IsOptional()
  customCommand?: string;
  @IsString()
  @IsOptional()
  orderId?: string;
}
export class YooMoneyOrderDto {
  @IsString()
  @IsNotEmpty()
  nickname: string;
  @IsString()
  @IsOptional()
  promoCode?: string;
}
export class PassOrderDto {
  @IsString()
  @IsNotEmpty()
  nickname: string;
}
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService,
  ) {}

  /** Проверяет что текущий пользователь является администратором */
  private requireAdmin(req: AuthenticatedRequest): void {
    const user = req.user;
    const MASTER_ADMINS = ['ren4ik284', 'mydaf0n62'];
    const isMaster = user && MASTER_ADMINS.includes(user.nickname?.toLowerCase());
    if (!user || (!isMaster && user.role !== 'admin')) {
      throw new ForbiddenException('Доступ разрешён только администраторам');
    }
  }

  @Post('yoomoney')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Создать заказ VIP (200 руб.) и ссылку на оплату через ЮMoney' })
  async createYooMoneyOrder(@Body() dto: YooMoneyOrderDto) {
    return this.paymentsService.createYooMoneyOrder(dto);
  }
  @Post('pass')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Создать заказ Проходки (150 руб.) и ссылку на оплату через ЮMoney' })
  async createPassOrder(@Body() dto: PassOrderDto) {
    return this.paymentsService.createPassOrder(dto);
  }
  @Post('grant-vip')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Мгновенно выдать VIP статус на сервере Minecraft (RCON / Pterodactyl) — только Админ' })
  async grantVip(@Body() dto: GrantVipDto, @Req() req: AuthenticatedRequest) {
    this.requireAdmin(req);
    return this.paymentsService.grantVipStatus(dto);
  }
  @Post('grant-pass')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Мгновенно выдать Проходку на сервере Minecraft (RCON / Pterodactyl) — только Админ' })
  async grantPass(@Body() dto: GrantVipDto, @Req() req: AuthenticatedRequest) {
    this.requireAdmin(req);
    return this.paymentsService.grantPassStatus(dto);
  }
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Приём HTTP-уведомления от ЮMoney о входящем переводе' })
  async handleYooMoneyWebhook(@Body() body: Record<string, string>) {
    return this.paymentsService.handleYooMoneyWebhook(body);
  }
  @Get('check-payment/:orderId')
  @ApiOperation({ summary: 'Проверить оплату по orderId через ЮMoney API (operation-history)' })
  async checkPayment(@Param('orderId') orderId: string, @Query('amount') amount?: string) {
    const isPaid = await this.paymentsService.checkPaymentViaApi(
      orderId,
      amount ? parseFloat(amount) : undefined,
    );
    return { orderId, isPaid, message: isPaid ? '✅ Платёж подтверждён' : '⏳ Платёж не найден' };
  }
  @Get('oauth-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить OAuth ссылку для авторизации кошелька владельца — только Админ' })
  getOAuthUrl(@Req() req: AuthenticatedRequest, @Query('redirect_uri') redirectUri?: string) {
    this.requireAdmin(req);
    const clientId = process.env.YOOMONEY_CLIENT_ID || '';
    const redirect = redirectUri || 'https://samuraiworld.ru/api/payments/oauth-callback';
    const scope = 'operation-history operation-details account-info';
    const url = `https://yoomoney.ru/oauth/authorize?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirect)}&` +
      `scope=${encodeURIComponent(scope)}`;
    return {
      url,
      instructions: [
        '1. Перейди по ссылке url в браузере',
        '2. Войди в свой кошелёк ЮMoney и подтверди права',
        '3. ЮMoney перенаправит тебя на redirect_uri?code=XXXXX',
        '4. Скопируй code и вызови POST /api/payments/oauth-token?code=XXXXX',
        '5. Полученный access_token добавь в .env как YOOMONEY_ACCESS_TOKEN',
      ],
    };
  }
  @Post('oauth-token')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обменять OAuth code на access_token кошелька — только Админ' })
  async exchangeOAuthCode(@Query('code') code: string, @Query('redirect_uri') redirectUri?: string, @Req() req?: AuthenticatedRequest) {
    this.requireAdmin(req!);
    if (!code) {
      return { error: 'Укажи ?code=... из redirect ЮMoney' };
    }
    const clientId = process.env.YOOMONEY_CLIENT_ID || '';
    const redirect = redirectUri || 'https://samuraiworld.ru/api/payments/oauth-callback';
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      grant_type: 'authorization_code',
      redirect_uri: redirect,
    });
    try {
      const resp = await fetch('https://yoomoney.ru/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const data: any = await resp.json();
      if (data.access_token) {
        return {
          access_token: data.access_token,
          next_step: 'Добавь в .env файл: YOOMONEY_ACCESS_TOKEN=' + data.access_token,
        };
      }
      return { error: data.error || 'Ошибка обмена кода', raw: data };
    } catch (err: any) {
      return { error: err.message };
    }
  }
  @Get('oauth-callback')
  @ApiOperation({ summary: 'OAuth callback — принимает code от ЮMoney' })
  oauthCallback(@Query('code') code?: string, @Query('error') error?: string) {
    if (error) return { error, message: 'ЮMoney отказал в авторизации' };
    if (!code) return { error: 'code отсутствует в параметрах' };
    return {
      code,
      next_step: `Вызови POST /api/payments/oauth-token?code=${code} для получения access_token`,
    };
  }
  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить список невыданных VIP/Проходок из очереди Cron — только Админ' })
  async getPendingQueue(@Req() req: AuthenticatedRequest) {
    this.requireAdmin(req);
    return this.paymentsService.getPendingQueue();
  }
  @Get('test-rcon')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Проверить статус RCON подключения к Minecraft серверу — только Админ' })
  async testRcon(
    @Req() req: AuthenticatedRequest,
    @Query('nick') nick?: string,
    @Query('host') host?: string,
    @Query('port') port?: string,
    @Query('password') password?: string,
  ) {
    this.requireAdmin(req);
    const targetNick = nick || 'TestPlayer';
    return this.paymentsService.grantVipStatus({
      nickname: targetNick,
      rconHost: host,
      rconPort: port,
      rconPassword: password,
    });
  }
}

