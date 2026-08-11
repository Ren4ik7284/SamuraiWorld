import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';

export interface VipFeature {
  icon: string;
  title: string;
  desc: string;
  badge?: string;
}

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './store.component.html',
  styleUrls: ['./store.component.css']
})
export class StoreComponent implements OnInit, OnDestroy {
  currentUser: User | null = null;
  private userSub!: Subscription;

  // Pricing details
  vipPrice = 200;

  // Checkout modal state
  showBuyModal = false;
  nicknameInput = '';
  promoCodeInput = '';
  appliedPromo = '';
  discountPercent = 0;
  promoError = '';
  promoSuccess = '';
  selectedPayment: string = 'coinso_pay';

  checkoutStep: 1 | 2 = 1;
  isProcessingPay = false;
  lastOrderId = '';
  commandCopied = false;

  // Core VIP features focusing on inspection, chest logs, helper RP functions (No command strings)
  vipFeatures: VipFeature[] = [
    {
      icon: 'search',
      title: 'Инспекция сундуков и логов',
      desc: 'Смотрите кто, что и в какое точно время взял или положил вещи в сундук. Помогает быстро разобрать спорные ситуации.',
      badge: 'ОСНОВНАЯ ФУНКЦИЯ'
    },
    {
      icon: 'scroll',
      title: 'Аудит взаимодействий с блоками',
      desc: 'Просмотр истории изменения блоков и дверей на вашей территории за выбранный период.',
      badge: 'БЕЗОПАСНОСТЬ'
    },
    {
      icon: 'radar',
      title: 'Проверка игроков поблизости',
      desc: 'Вспомогательная функция для определения присутствия других игроков в небольшом радиусе.',
      badge: 'УТИЛИТА'
    },
    {
      icon: 'clock',
      title: 'Статистика и Пинг',
      desc: 'Отображение наигранного времени любого игрока на сервере и проверка отклика соединения.',
      badge: 'ИНФО'
    },
    {
      icon: 'home',
      title: 'Дополнительные точки дома',
      desc: 'Возможность сохранять дополнительные приватные точки возврата для удобного перемещения.',
      badge: 'УДОБСТВО'
    },
    {
      icon: 'unlock',
      title: 'Резервный слот входа',
      desc: 'Приоритетный вход на сервер без очереди, даже при максимальном онлайне.',
      badge: 'ПРИОРИТЕТ'
    },
    {
      icon: 'paint',
      title: 'Выделенный цвет ника в чате',
      desc: 'Элегантное цветовое выделение никнейма в чате и списке игроков (TAB).',
      badge: 'СТИЛЬ'
    },
    {
      icon: 'chat',
      title: 'Роль VIP в Discord',
      desc: 'Специальная роль и доступ в закрытый канал для меценатов в официальном Discord.',
      badge: 'DISCORD'
    }
  ];

  // FAQ Items
  faqItems = [
    {
      q: 'Как работает VIP статус?',
      a: 'VIP статус подчёркивает вашу поддержку сервера и предоставляет полезный вспомогательный функционал: инспекцию истории сундуков, просмотр логов блоков и удобные утилиты.'
    },
    {
      q: 'Как работают логи сундуков?',
      a: 'При включении режима инспекции и нажатии на сундук вы получаете полную историю: точный список предметов, никнеймы игроков и дату с точностью до секунд.'
    },
    {
      q: 'Как проходит оплата?',
      a: 'Оплата происходит через официальный платёжный шлюз Coinso. Поддерживаются СБП (по QR-коду), карты любого банка РФ и мира, а также криптовалюта (USDT, TON, BTC).'
    },
    {
      q: 'Как быстро выдается статус?',
      a: 'После успешной оплаты через Coinso статус автоматически зачисляется на ваш никнейм в течение 20 секунд.'
    }
  ];

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.nickname && !this.nicknameInput) {
        this.nicknameInput = user.nickname;
      }
    });

    this.route.queryParams.subscribe(params => {
      if (params['payment'] === 'success') {
        const nick = params['nickname'] || 'Игрок';
        this.lastOrderId = params['order'] || 'COINSO-SUCCESS';
        this.nicknameInput = nick;
        this.showBuyModal = true;
        this.checkoutStep = 2;
      }
    });
  }

  ngOnDestroy(): void {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
  }

  openBuyModal(): void {
    this.showBuyModal = true;
    this.checkoutStep = 1;
    this.discountPercent = 0;
    this.appliedPromo = '';
    this.promoError = '';
    this.promoSuccess = '';
    this.promoCodeInput = '';

    if (this.currentUser?.nickname) {
      this.nicknameInput = this.currentUser.nickname;
    }
  }

  closeBuyModal(): void {
    this.showBuyModal = false;
    this.checkoutStep = 1;
  }

  calculatePrice(): number {
    let base = this.vipPrice;
    if (this.discountPercent > 0) {
      base = Math.round(base * (1 - this.discountPercent / 100));
    }
    return base;
  }

  applyPromoCode(): void {
    const code = (this.promoCodeInput || '').trim().toUpperCase();
    this.promoError = '';
    this.promoSuccess = '';

    if (!code) {
      this.promoError = 'Введите промокод!';
      return;
    }

    if (code === 'SAMURAI' || code === 'COINSO') {
      this.discountPercent = 10;
      this.appliedPromo = code;
      this.promoSuccess = 'Промокод применен! Скидка 10%';
    } else if (code === 'START') {
      this.discountPercent = 15;
      this.appliedPromo = code;
      this.promoSuccess = 'Приветственная скидка 15%';
    } else {
      this.promoError = 'Промокод не существует или истёк (попробуйте SAMURAI или START)';
      this.discountPercent = 0;
      this.appliedPromo = '';
    }
  }

  submitCoinsoOrder(): void {
    const nick = (this.nicknameInput || '').trim();
    if (!nick) {
      this.promoError = 'Укажите ваш игровой никнейм!';
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(nick)) {
      this.promoError = 'Никнейм должен состоять из латинских букв или цифр (3–16 символов)!';
      return;
    }

    this.isProcessingPay = true;
    this.promoError = '';

    this.http.post<{ payUrl: string; orderId: string }>('/api/payments/coinso', {
      nickname: nick,
      promoCode: this.appliedPromo
    }).subscribe({
      next: (res: { payUrl: string; orderId: string }) => {
        this.isProcessingPay = false;
        this.lastOrderId = res.orderId;
        if (res.payUrl) {
          window.location.href = res.payUrl;
        } else {
          this.checkoutStep = 2;
        }
      },
      error: (err: any) => {
        this.isProcessingPay = false;
        this.promoError = err.error?.message || 'Ошибка создания платежа';
      }
    });
  }

  grantStatusMessage = '';
  isGranting = false;

  triggerInstantGrant(): void {
    const nick = (this.nicknameInput || '').trim();
    if (!nick) {
      this.grantStatusMessage = 'Укажите никнейм!';
      return;
    }
    this.isGranting = true;
    this.grantStatusMessage = 'Отправка команды на сервер...';

    this.http.post<any>('/api/payments/grant-vip', { nickname: nick }).subscribe({
      next: (res) => {
        this.isGranting = false;
        this.grantStatusMessage = res.message || 'VIP статус выдан!';
      },
      error: (err) => {
        this.isGranting = false;
        this.grantStatusMessage = err.error?.message || err.error?.error || 'Не удалось отправить команду на сервер';
      }
    });
  }

  copyGetCommand(): void {
    const cmd = `/don get ${this.lastOrderId}`;
    navigator.clipboard.writeText(cmd).finally(() => {
      this.commandCopied = true;
      setTimeout(() => { this.commandCopied = false; }, 2500);
    });
  }

  readonly DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.03-4.84-2.6.03-1.61 3.22-2.4 4.84-2.4 1.61 0 4.81.79 4.84 2.4C15.8 18.97 14.03 20 12 20z"/></svg>';

  getUserAvatar(): string {
    if (this.currentUser?.avatarUrl) {
      return this.currentUser.avatarUrl;
    }
    return this.DEFAULT_AVATAR;
  }

  getFeatureSvgIcon(icon: string): string {
    switch (icon) {
      case 'search':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;color:#38bdf8;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`;
      case 'scroll':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;color:#22c55e;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      case 'radar':
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;color:#eab308;"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 12 19 5"/></svg>`;
      default:
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;color:#a855f7;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    }
  }

  getAvatarUrl(nick: string): string {
    return this.getUserAvatar();
  }
}
