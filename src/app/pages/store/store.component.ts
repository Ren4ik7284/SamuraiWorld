import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';

export interface VipFeature {
  icon: string;
  title: string;
  cmd?: string;
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

  // Pricing & Status details
  vipPrice = 100; // 100 рублей
  vipDurationMonths = 1;

  // Checkout modal state
  showBuyModal = false;
  nicknameInput = '';
  promoCodeInput = '';
  appliedPromo = '';
  discountPercent = 0;
  promoError = '';
  promoSuccess = '';
  selectedPayment: 'rollypay_sbp' | 'rollypay_card' | 'rollypay_tbank' | 'rollypay_yumoney' = 'rollypay_sbp';

  checkoutStep: 1 | 2 = 1;
  isProcessingPay = false;
  lastOrderId = '';
  commandCopied = false;

  // Core VIP features focusing on inspection, chest logs, helper RP functions
  vipFeatures: VipFeature[] = [
    {
      icon: '🔍',
      title: 'Инспекция сундуков и логов',
      cmd: '/co inspect или /chestlog',
      desc: 'Смотри кто, что и в какое точно время взял или положил вещи в сундук. Идеально для расследования RP-краж.',
      badge: 'ГЛАВНАЯ ФУНКЦИЯ'
    },
    {
      icon: '📜',
      title: 'Аудит взаимодействий с блоками',
      cmd: '/co lookup',
      desc: 'Полный просмотр истории изменения блоков и дверей на вашей территории за любое время.',
      badge: 'ЗАЩИТА'
    },
    {
      icon: '🕵️',
      title: 'Проверка игроков поблизости',
      cmd: '/near',
      desc: 'Вспомогательная команда для определения игроков в небольшом радиусе вокруг вашего персонажа.',
      badge: 'RP УТИЛИТА'
    },
    {
      icon: '⏱️',
      title: 'Статистика и Пинг',
      cmd: '/playtime & /ping',
      desc: 'Узнай точный наигранный тайм-код любого игрока на сервере и проверь отклик соединения.',
      badge: 'ИНФО'
    },
    {
      icon: '🏠',
      title: '3 Точки дома',
      cmd: '/sethome [название]',
      desc: 'Сохраняйте до 3-х приватных точек возврата для удобных путешествий по карте государства.',
      badge: 'УДОБСТВО'
    },
    {
      icon: '🔓',
      title: 'Резервный слот входа',
      cmd: 'Автоматически',
      desc: 'Вход без очереди и ожидания, даже если все игровые слоты сервера полностью заполнены.',
      badge: 'ПРИОРИТЕТ'
    },
    {
      icon: '🎨',
      title: 'Зеленый цвет ника в чате',
      cmd: 'Визуальный статус',
      desc: 'Стильное выделение ника в чате и списке игроков (TAB), подчеркивающее статус мецената.',
      badge: 'СТИЛЬ'
    },
    {
      icon: '💬',
      title: 'Роль VIP в Discord',
      cmd: 'Синхронизация',
      desc: 'Эксклюзивная роль и доступ в закрытый уютный чат меценатов сервера в официальном Discord.',
      badge: 'DISCORD'
    }
  ];

  // FAQ Items
  faqItems = [
    {
      q: 'Почему на сервере только одна привилегия за 100₽?',
      a: 'SamuraiWorld — это чистый ванильный RP сервер. Мы против дисбаланса и Pay-to-Win! VIP статус создан только как подписка мецената для поддержки сервера и дает исключительно вспомогательные функции (логи сундуков, команды проверки).'
    },
    {
      q: 'Как работают логи сундуков?',
      a: 'При включении режима инспекции (/co inspect) и клике по любому сундуку вам отобразится список всех предметов, никнеймы игроков и точное время (дата, часы, минуты), когда вещь была взята или положена.'
    },
    {
      q: 'Как проходит оплата через Rollypay?',
      a: 'Оплата принимается через платёжную систему Rollypay. Вы можете оплатить через СБП, карту любого банка РФ, Т-Банк или ЮMoney без лишних комиссий.'
    },
    {
      q: 'Как быстро выдается VIP статус?',
      a: 'После проведения оплаты через Rollypay статус автоматически выдается вашему никнейму на сервере в течение 10–30 секунд.'
    }
  ];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.nickname && !this.nicknameInput) {
        this.nicknameInput = user.nickname;
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

    if (code === 'SAMURAI' || code === 'ROLLY') {
      this.discountPercent = 10;
      this.appliedPromo = code;
      this.promoSuccess = 'Промокод применен! Скидка 10%';
    } else if (code === 'START' || code === 'VANILLA') {
      this.discountPercent = 15;
      this.appliedPromo = code;
      this.promoSuccess = 'Приветственная скидка 15%';
    } else {
      this.promoError = 'Промокод не существует или истёк (попробуйте SAMURAI или START)';
      this.discountPercent = 0;
      this.appliedPromo = '';
    }
  }

  submitRollypayOrder(): void {
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

    // Simulate Rollypay payment invoice redirect / creation
    setTimeout(() => {
      this.isProcessingPay = false;
      this.lastOrderId = 'ROLLY-' + Math.floor(100000 + Math.random() * 900000);
      this.checkoutStep = 2;
    }, 1200);
  }

  copyGetCommand(): void {
    const cmd = `/don get ${this.lastOrderId}`;
    navigator.clipboard.writeText(cmd).finally(() => {
      this.commandCopied = true;
      setTimeout(() => { this.commandCopied = false; }, 2500);
    });
  }

  getAvatarUrl(nick: string): string {
    const cleanNick = (nick || '').trim();
    if (!cleanNick || cleanNick.length < 3) {
      return 'https://crafatar.com/avatars/Steve?overlay=true';
    }
    return `https://crafatar.com/avatars/${cleanNick}?overlay=true`;
  }
}
