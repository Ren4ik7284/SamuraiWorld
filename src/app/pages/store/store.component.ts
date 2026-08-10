import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';

export interface StoreItem {
  id: string;
  name: string;
  category: 'privileges' | 'cases' | 'coins' | 'services';
  badge?: string;
  badgeType?: 'hit' | 'popular' | 'new' | 'legend';
  icon: string;
  color: string; // CSS color string or gradient key
  shortDesc: string;
  fullDesc: string[];
  basePrice: number; // For 30 days or single purchase
  price90?: number;
  priceForever?: number;
  features: string[];
  isPrivilege?: boolean;
}

@Component({
  selector: 'app-store',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './store.component.html',
  styleUrls: ['./store.component.css']
})
export class StoreComponent implements OnInit, OnDestroy {
  activeCategory: 'all' | 'privileges' | 'cases' | 'coins' | 'services' = 'all';
  currentUser: User | null = null;
  private userSub!: Subscription;

  // Selected item & modal states
  selectedItem: StoreItem | null = null; // For Buy modal
  detailItem: StoreItem | null = null;   // For Info modal
  
  // Checkout Form State
  checkoutDuration: '30' | '90' | 'forever' = 'forever';
  nicknameInput: string = '';
  promoCodeInput: string = '';
  appliedPromo: string = '';
  discountPercent: number = 0;
  promoError: string = '';
  promoSuccess: string = '';
  selectedPayment: 'sbp' | 'tinkoff' | 'card' | 'yumoney' | 'crypto' = 'sbp';

  checkoutStep: 1 | 2 = 1;
  isProcessingPay = false;
  lastOrderId = '';
  commandCopied = false;

  // Search filter
  searchQuery: string = '';

  // All Store Items Data
  items: StoreItem[] = [
    {
      id: 'vip',
      name: 'VIP',
      category: 'privileges',
      badge: 'СТАРТОВЫЙ',
      badgeType: 'new',
      icon: '🎖️',
      color: '#00b894',
      shortDesc: 'Идеальный выбор для комфортного старта на сервере',
      fullDesc: [
        'Возможность использовать полет на спавне',
        'До 3-х точек дома для быстрой телепортации',
        'Выделенный зелёный ник в чате и списки игроков',
        'Кит VIP с ценными ресурсами каждые 24 часа',
        'Резервный слот на забитом сервере'
      ],
      basePrice: 149,
      price90: 349,
      priceForever: 499,
      isPrivilege: true,
      features: [
        '3 точки дома (/sethome)',
        '/fly на Спавне и на Площади',
        'Цветной зеленый ник в чате',
        'Ежедневный набор /kit vip',
        'Резервный слот входа',
        'Сундук банка (+10 ячеек)'
      ]
    },
    {
      id: 'samurai',
      name: 'SAMURAI',
      category: 'privileges',
      badge: 'ХИТ ПРОДАЖ',
      badgeType: 'hit',
      icon: '⚔️',
      color: '#d4a017',
      shortDesc: 'Престижный статус настоящего воина SamuraiWorld',
      fullDesc: [
        'Включает все функции статуса VIP',
        'Восстановление сытости без еды /feed',
        'Доступ к виртуальному верстаку /workbench',
        'Уникальный золотой префикс [Samurai] в чате',
        'Возможность приватить до 3-х территорий',
        'Создание собственной торговой компании без пошлин'
      ],
      basePrice: 299,
      price90: 699,
      priceForever: 899,
      isPrivilege: true,
      features: [
        'Все возможности VIP',
        '6 точек дома (/sethome)',
        '/feed (восстановление голода)',
        '/workbench (переносной верстак)',
        'Золотой префикс [Samurai]',
        'Ежедневный /kit samurai (незерит)',
        'Приват до 3-х территорий'
      ]
    },
    {
      id: 'shogun',
      name: 'SHOGUN',
      category: 'privileges',
      badge: 'ПРЕМИУМ',
      badgeType: 'popular',
      icon: '🏯',
      color: '#e74c3c',
      shortDesc: 'Максимальное преимущество, власть и уважение',
      fullDesc: [
        'Включает все функции статусов VIP и SAMURAI',
        'Команда исцеления /heal (раз в 15 минут)',
        'Возможность надевать любой блок на голову /hat',
        'Красочный градиент имени и префикс [Shogun]',
        'Бесплатное создание собственной партии или клана',
        'Голосовое вещание и объявления /bc на весь сервер'
      ],
      basePrice: 549,
      price90: 1299,
      priceForever: 1699,
      isPrivilege: true,
      features: [
        'Все возможности SAMURAI',
        '10 точек дома (/sethome)',
        '/heal (лечение раз в 15 мин)',
        '/hat (надеть блок на голову)',
        'Префикс [Shogun] с градиентом',
        'Ежедневный /kit shogun (элитры)',
        'Создание партии/клана бесплатно',
        'Серверные объявления /bc'
      ]
    },
    {
      id: 'emperor',
      name: 'EMPEROR',
      category: 'privileges',
      badge: 'ЛЕГЕНДА',
      badgeType: 'legend',
      icon: '👑',
      color: '#9b59b6',
      shortDesc: 'Высшая власть, элитные права и вечный почет',
      fullDesc: [
        'Включает абсолютно все функции предыдущих рангов',
        'Безлимитное количество точек дома /sethome',
        'Персональная аура (частицы сакуры/дракона вокруг игрока)',
        'Коронка в TAB и чате с переливающимся цветом',
        'Легендарный /kit emperor с уникальным зачарованным оружием',
        'Персональный канал в официальном Discord с ролью Императора',
        'Ежемесячно 500 самурай-монет на личный баланс'
      ],
      basePrice: 990,
      price90: 2290,
      priceForever: 2990,
      isPrivilege: true,
      features: [
        'ВСЕ возможности других рангов',
        'Неограниченно точек дома',
        'Уникальная аура сакуры/дракона',
        'Титул [Император] + коронка в TAB',
        'Ежедневный /kit emperor (Легенда)',
        'Роль & канал в Discord',
        '+500 монет каждый месяц'
      ]
    },
    // Cases
    {
      id: 'case_samurai',
      name: 'Кейс Самурая',
      category: 'cases',
      badge: 'ТОП ВЫГОДА',
      badgeType: 'hit',
      icon: '📦',
      color: '#d4a017',
      shortDesc: 'Шанс выбить статусы VIP, SAMURAI, SHOGUN или редкие ресурсы!',
      fullDesc: [
        'Шанс выпадения статуса EMPEROR: 3%',
        'Шанс выпадения статуса SHOGUN: 7%',
        'Шанс выпадения статуса SAMURAI: 15%',
        'Шанс выпадения статуса VIP: 25%',
        'Шанс 5000 монет / Незерит: 50%'
      ],
      basePrice: 99,
      features: [
        'Шанс получить топовый статус',
        'Мгновенное открытие в игре (/case)',
        'Гарантированный призовой лут'
      ]
    },
    {
      id: 'case_resources',
      name: 'Кейс Ресурсов',
      category: 'cases',
      icon: '💎',
      color: '#0984e3',
      shortDesc: 'Алмазы, незеритовые слитки, зачарованные книги и элитры',
      fullDesc: [
        'Наборы строительных и драгоценных блоков',
        'Незеритовая броня и элитры',
        'Зачарованные книги на Починку и Прочность III'
      ],
      basePrice: 49,
      features: [
        'Редкие материалы и руды',
        'Зачарованные книги',
        'Элитры и Незерит'
      ]
    },
    {
      id: 'case_cosmetic',
      name: 'Кейс Кастомизации',
      category: 'cases',
      icon: '🎨',
      color: '#e84393',
      shortDesc: 'Уникальные эффекты, гаджеты и титулы для вашего персонажа',
      fullDesc: [
        'Анимированные партиклы вокруг игрока',
        'Эксклюзивные титулы в чате',
        'Питомцы и забавные гаджеты'
      ],
      basePrice: 79,
      features: [
        'Титулы и свечение',
        'Партиклы и следы',
        'Декоративные шапки'
      ]
    },
    // Coins
    {
      id: 'coins_1000',
      name: '1,000 Игровых Монет',
      category: 'coins',
      icon: '🪙',
      color: '#f1c40f',
      shortDesc: 'Игровая валюта для покупок у жителей и на аукционе',
      fullDesc: ['Пополнение игрового баланса на 1,000 Йен'],
      basePrice: 100,
      features: ['Зачисление на баланс (/balance)']
    },
    {
      id: 'coins_5000',
      name: '5,000 Монет (+10% бонус)',
      category: 'coins',
      badge: '+500 БОНУС',
      badgeType: 'popular',
      icon: '💰',
      color: '#f39c12',
      shortDesc: 'Выгодный пакет монет для быстрого развития бизнеса',
      fullDesc: ['Зачисление 5,500 монет на ваш игровой счет'],
      basePrice: 450,
      features: ['5,000 Основных монет', '+500 Бонусных монет (10%)']
    },
    {
      id: 'coins_12000',
      name: '12,000 Монет (+20% бонус)',
      category: 'coins',
      badge: 'МАКСИМАЛЬНО',
      badgeType: 'legend',
      icon: '🏦',
      color: '#e67e22',
      shortDesc: 'Огромный сундук монет для покупки лучших участков и фирм',
      fullDesc: ['Зачисление 14,400 монет на ваш баланс'],
      basePrice: 990,
      features: ['12,000 Основных монет', '+2,400 Бонусных монет (20%)']
    },
    // Services
    {
      id: 'unban',
      name: 'Разблокировка (Разбан)',
      category: 'services',
      icon: '🔓',
      color: '#e74c3c',
      shortDesc: 'Снятие бана с игрового аккаунта и возможность продолжить игру',
      fullDesc: ['Снятие всех действующих блокировок с указанного никнейма.'],
      basePrice: 350,
      features: ['Мгновенный разбан', 'Восстановление доступа к игре']
    },
    {
      id: 'nick_change',
      name: 'Смена Никнейма / Перенос',
      category: 'services',
      icon: '🔄',
      color: '#3498db',
      shortDesc: 'Перенос всех ваших привилегий и монет на новый никнейм',
      fullDesc: ['Сохранение ранга, ресурсов и статистики при смене ника.'],
      basePrice: 150,
      features: ['Перенос привилегии', 'Сохранение статистики']
    },
    {
      id: 'clan_flag',
      name: 'Флаг Клана / Организации',
      category: 'services',
      icon: '🚩',
      color: '#1abc9c',
      shortDesc: 'Регистрация уникального герба и кастомного флага клана',
      fullDesc: ['Официальное внесение флага в гербовник SamuraiWorld.'],
      basePrice: 200,
      features: ['Уникальный кастомный флаг', 'Официальный статус организации']
    }
  ];

  // Matrix comparison data
  matrixRows = [
    { name: 'Точки дома (/sethome)', vip: '3', samurai: '6', shogun: '10', emperor: '∞ Безлимит' },
    { name: 'Полет на спавне (/fly)', vip: '✓', samurai: '✓', shogun: '✓', emperor: '✓' },
    { name: 'Утоление голода (/feed)', vip: '✗', samurai: '✓', shogun: '✓', emperor: '✓' },
    { name: 'Лечение (/heal)', vip: '✗', samurai: '✗', shogun: '✓ (15 мин)', emperor: '✓ (Без КД)' },
    { name: 'Виртуальный верстак (/workbench)', vip: '✗', samurai: '✓', shogun: '✓', emperor: '✓' },
    { name: 'Блок на голову (/hat)', vip: '✗', samurai: '✗', shogun: '✓', emperor: '✓' },
    { name: 'Резервный слот входа', vip: '✓', samurai: '✓', shogun: '✓', emperor: '✓' },
    { name: 'Ежедневные наборы (/kit)', vip: 'VIP', samurai: 'SAMURAI', shogun: 'SHOGUN', emperor: 'EMPEROR' },
    { name: 'Приват территорий', vip: '2 региона', samurai: '3 региона', shogun: '5 регионов', emperor: '10 регионов' },
    { name: 'Создание клана/партии', vip: 'С комиссией', samurai: 'С комиссией', shogun: 'Бесплатно', emperor: 'Бесплатно + Защита' },
    { name: 'Аура партиклов сакуры', vip: '✗', samurai: '✗', shogun: '✗', emperor: '✓ ЭКСКЛЮЗИВ' },
    { name: 'Канал и роль в Discord', vip: '✗', samurai: 'Базовая', shogun: 'Премиум', emperor: 'Персональный канал' }
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

  get filteredItems(): StoreItem[] {
    return this.items.filter(item => {
      const matchCat = this.activeCategory === 'all' || item.category === this.activeCategory;
      const q = this.searchQuery.trim().toLowerCase();
      const matchQuery = !q || item.name.toLowerCase().includes(q) || item.shortDesc.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }

  setCategory(cat: 'all' | 'privileges' | 'cases' | 'coins' | 'services'): void {
    this.activeCategory = cat;
  }

  openInfoModal(item: StoreItem, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.detailItem = item;
  }

  closeInfoModal(): void {
    this.detailItem = null;
  }

  openBuyModal(item: StoreItem, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedItem = item;
    this.checkoutStep = 1;
    this.checkoutDuration = item.priceForever ? 'forever' : '30';
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
    this.selectedItem = null;
    this.checkoutStep = 1;
  }

  // Calculate current price of item based on duration and promo
  calculatePrice(): number {
    if (!this.selectedItem) return 0;

    let base = this.selectedItem.basePrice;

    if (this.selectedItem.isPrivilege) {
      if (this.checkoutDuration === '90' && this.selectedItem.price90) {
        base = this.selectedItem.price90;
      } else if (this.checkoutDuration === 'forever' && this.selectedItem.priceForever) {
        base = this.selectedItem.priceForever;
      }
    }

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

    if (code === 'SAMURAI10' || code === 'SAMURAI') {
      this.discountPercent = 10;
      this.appliedPromo = code;
      this.promoSuccess = 'Промокод применен! Скидка 10%';
    } else if (code === 'START' || code === 'WELCOME') {
      this.discountPercent = 15;
      this.appliedPromo = code;
      this.promoSuccess = 'Приветственный промокод! Скидка 15%';
    } else if (code === 'VIP2026' || code === 'SHOGUN') {
      this.discountPercent = 20;
      this.appliedPromo = code;
      this.promoSuccess = 'Эксклюзивный промокод! Скидка 20%';
    } else {
      this.promoError = 'Промокод не существует или истёк (попробуйте SAMURAI10 или START)';
      this.discountPercent = 0;
      this.appliedPromo = '';
    }
  }

  submitPurchase(): void {
    const nick = (this.nicknameInput || '').trim();
    if (!nick) {
      this.promoError = 'Укажите ваш игровой никнейм!';
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,16}$/.test(nick)) {
      this.promoError = 'Никнейм должен быть латинскими буквами (от 3 до 16 символов)!';
      return;
    }

    this.isProcessingPay = true;
    this.promoError = '';

    setTimeout(() => {
      this.isProcessingPay = false;
      this.lastOrderId = 'SW-' + Math.floor(100000 + Math.random() * 900000);
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
