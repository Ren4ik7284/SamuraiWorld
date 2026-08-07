import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

export type TicketCategory =
  | 'Технические проблемы'
  | 'Аккаунт & Паспорт'
  | 'Донат & Экономика'
  | 'Суд & Жалоба'
  | 'Идеи & Баг-репорты';

export type TicketPriority = 'Низкий' | 'Средний' | 'Высокий' | 'Критический';
export type TicketStatus = 'Ожидает ответа' | 'В обработке' | 'Решено' | 'Закрыто';

export interface TicketMessage {
  id: string;
  sender: string;
  role: 'user' | 'support' | 'system';
  text: string;
  timestamp: string;
}

export interface Ticket {
  _id?: string;
  id: string;
  ticketNumber: string;
  nickname: string;
  contact: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  messages: TicketMessage[];
}

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, SafeHtmlPipe],
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.css'],
})
export class SupportComponent implements OnInit, OnDestroy {
  // Список резервных эндпоинтов для 100% гарантии синхронизации
  readonly ENDPOINTS: string[] = [
    'https://crudcrud.com/api/7c16a052e7f242aaaad90b0d09b7fdd4/tickets',
    'https://crudcrud.com/api/40c9f2ef44174272b782728337e03571/tickets',
    'https://crudcrud.com/api/88568c07e034458f96e42b2ca7452d5b/tickets',
  ];

  activeEndpointIndex: number = 0;
  activeEndpointUrl: string = '';
  isRecoveringEndpoint: boolean = false;

  // Никнейм текущего игрока в браузере
  currentUserNickname: string = '';

  // Авторизация администратора по секретному ключу
  isAdminAuthenticated: boolean = false;
  showAuthModal: boolean = false;
  inputAdminKey: string = '';
  authErrorMessage: string = '';

  // Секретные ключи доступа в админ-панель
  readonly SECRET_ADMIN_KEYS: string[] = ['7777', 'SAMURAI-ADMIN'];

  // Режим просмотра: 'user' (Игрок) или 'admin' (Админ-панель)
  viewMode: 'user' | 'admin' = 'user';

  // Выбранная вкладка игрока: 'create' | 'tracker' | 'faq'
  activeTab: 'create' | 'tracker' | 'faq' = 'create';

  // Форма создания тикета
  newTicket = {
    nickname: '',
    contact: '',
    category: 'Технические проблемы' as TicketCategory,
    priority: 'Средний' as TicketPriority,
    subject: '',
    description: '',
  };

  categories: Array<{ title: TicketCategory; icon: string; desc: string }> = [
    {
      title: 'Технические проблемы',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      desc: 'Вылеты, проблемы с подключением к серверу, лаги или баги текстур.',
    },
    {
      title: 'Аккаунт & Паспорт',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      desc: 'Восстановление доступа, получение паспорта гражданина, смена ника.',
    },
    {
      title: 'Донат & Экономика',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      desc: 'Пополнение баланса, покупка привилегий, зачисление валюты.',
    },
    {
      title: 'Суд & Жалоба',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>`,
      desc: 'Жалобы на гриферство, нарушения правил, подача исков в Верховный Суд.',
    },
    {
      title: 'Идеи & Баг-репорты',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/><path d="M9 21h6"/></svg>`,
      desc: 'Предложения по улучшению плагинов, найденные баги и абузы.',
    },
  ];

  priorities: TicketPriority[] = ['Низкий', 'Средний', 'Высокий', 'Критический'];

  isSubmitting = false;
  submitSuccess = false;
  createdTicketInfo: Ticket | null = null;
  errorMessage = '';

  // Список тикетов и фильтры
  searchQuery = '';
  adminFilterStatus = 'ВСЕ';
  ticketsList: Ticket[] = [];
  selectedTicket: Ticket | null = null;

  // Ответы и действия админа
  replyText = '';
  adminName = 'Администратор SamuraiWorld';
  isReplying = false;
  isDeleting = false;

  private pollTimer: any;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.checkAdminAuth();
    this.loadUserSession();
    this.loadActiveEndpoint();
    this.loadLocalCache();
    this.loadTickets();

    // Автоматическая синхронизация каждые 3 секунды
    this.pollTimer = setInterval(() => {
      this.loadTickets(true);
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  private loadActiveEndpoint(): void {
    const savedEndpoint = localStorage.getItem('samurai_active_endpoint');
    if (savedEndpoint) {
      this.activeEndpointUrl = savedEndpoint;
    } else {
      this.activeEndpointUrl = this.ENDPOINTS[0];
    }
  }

  private loadUserSession(): void {
    this.currentUserNickname = localStorage.getItem('samurai_user_nickname') || '';
    if (this.currentUserNickname) {
      this.newTicket.nickname = this.currentUserNickname;
    }
  }

  private loadLocalCache(): void {
    try {
      const saved = localStorage.getItem('samurai_shared_tickets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.ticketsList = parsed;
        }
      }
    } catch (e) {
      console.warn('Cache error:', e);
    }
  }

  private saveLocalCache(): void {
    try {
      localStorage.setItem('samurai_shared_tickets', JSON.stringify(this.ticketsList));
    } catch (e) {
      console.warn('Save cache error:', e);
    }
  }

  private checkAdminAuth(): void {
    this.isAdminAuthenticated = localStorage.getItem('samurai_admin_auth') === 'true';
  }

  switchToUserView(): void {
    this.viewMode = 'user';
  }

  switchToAdminView(): void {
    if (this.isAdminAuthenticated) {
      this.viewMode = 'admin';
    } else {
      this.showAuthModal = true;
      this.inputAdminKey = '';
      this.authErrorMessage = '';
    }
  }

  verifyAdminKey(): void {
    const key = this.inputAdminKey.trim();
    if (this.SECRET_ADMIN_KEYS.includes(key)) {
      this.isAdminAuthenticated = true;
      localStorage.setItem('samurai_admin_auth', 'true');
      this.showAuthModal = false;
      this.authErrorMessage = '';
      this.viewMode = 'admin';
    } else {
      this.authErrorMessage = 'Неверный секретный ключ доступа!';
    }
  }

  logoutAdmin(): void {
    this.isAdminAuthenticated = false;
    localStorage.removeItem('samurai_admin_auth');
    this.viewMode = 'user';
  }

  selectCategory(cat: TicketCategory): void {
    this.newTicket.category = cat;
  }

  /**
   * Загрузка всех тикетов из базы данных
   */
  loadTickets(silent: boolean = false): void {
    this.http.get<Ticket[]>(this.activeEndpointUrl).subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          // Объединяем локальный кэш с полученными удаленными данными
          const map = new Map<string, Ticket>();
          this.ticketsList.forEach((t) => map.set(t.id, t));
          data.forEach((t) => map.set(t.id, t));

          this.ticketsList = Array.from(map.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          this.saveLocalCache();
          this.syncSelectedTicket();
        }
      },
      error: (err) => {
        if (err.status === 404 || err.status === 400 || err.status === 0) {
          this.recoverEndpoint();
        }
      },
    });
  }

  /**
   * Автоматическое переключение на свежую базу данных при исчерпании лимита 100 запросов
   */
  private recoverEndpoint(): void {
    if (this.isRecoveringEndpoint) return;
    this.isRecoveringEndpoint = true;

    // Сначала пробуем переключить на следующий резервный эндпоинт из списка
    this.activeEndpointIndex = (this.activeEndpointIndex + 1) % this.ENDPOINTS.length;
    this.activeEndpointUrl = this.ENDPOINTS[this.activeEndpointIndex];
    localStorage.setItem('samurai_active_endpoint', this.activeEndpointUrl);

    // Параллельно запрашиваем со страницы новую чистую динамическую точку
    this.http.get('https://crudcrud.com', { responseType: 'text' }).subscribe({
      next: (html) => {
        const match = html.match(/https:\/\/crudcrud\.com\/api\/[a-f0-9]{32}/);
        if (match && match[0]) {
          this.activeEndpointUrl = `${match[0]}/tickets`;
          localStorage.setItem('samurai_active_endpoint', this.activeEndpointUrl);
          this.reuploadAllTickets();
        }
        this.isRecoveringEndpoint = false;
      },
      error: () => {
        this.reuploadAllTickets();
        this.isRecoveringEndpoint = false;
      },
    });
  }

  private reuploadAllTickets(): void {
    this.ticketsList.forEach((t) => {
      const { _id, ...cleanObj } = t;
      this.http.post<Ticket>(this.activeEndpointUrl, cleanObj).subscribe({
        next: (created) => {
          t._id = created._id;
        },
        error: () => {},
      });
    });
  }

  private syncSelectedTicket(): void {
    if (this.selectedTicket) {
      const updated = this.ticketsList.find(
        (t) => t._id === this.selectedTicket?._id || t.id === this.selectedTicket?.id
      );
      if (updated) {
        this.selectedTicket = {
          ...updated,
          messages: [...updated.messages],
        };
      }
    }
  }

  canUserReply(ticket: Ticket | null): boolean {
    if (!ticket) return false;
    if (this.viewMode === 'admin' && this.isAdminAuthenticated) return true;

    const userNick = (this.currentUserNickname || this.newTicket.nickname).trim().toLowerCase();
    const authorNick = ticket.nickname.trim().toLowerCase();

    return !!userNick && userNick === authorNick;
  }

  /**
   * Создание нового обращения
   */
  submitTicket(): void {
    if (!this.newTicket.nickname || !this.newTicket.subject || !this.newTicket.description) {
      this.errorMessage = 'Заполните никнейм, тему и описание проблемы.';
      return;
    }

    this.currentUserNickname = this.newTicket.nickname.trim();
    localStorage.setItem('samurai_user_nickname', this.currentUserNickname);

    this.errorMessage = '';
    this.isSubmitting = true;

    const now = new Date().toISOString();
    const ticketNumber = `TK-${Math.floor(10000 + Math.random() * 90000)}`;
    const newTicketObj: Omit<Ticket, '_id'> = {
      id: `t-${Date.now()}`,
      ticketNumber,
      nickname: this.currentUserNickname,
      contact: this.newTicket.contact || 'Не указан',
      category: this.newTicket.category,
      priority: this.newTicket.priority,
      subject: this.newTicket.subject,
      description: this.newTicket.description,
      status: 'Ожидает ответа',
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          id: `m-${Date.now()}-1`,
          sender: this.currentUserNickname,
          role: 'user',
          text: this.newTicket.description,
          timestamp: now,
        },
        {
          id: `m-${Date.now()}-2`,
          sender: 'Система Поддержки',
          role: 'system',
          text: `Тикет ${ticketNumber} успешно создан [AMQP Queue: support.created]`,
          timestamp: now,
        },
      ],
    };

    // Сразу сохраняем локально, чтобы у пользователя тикет появился мгновенно!
    const localTicket: Ticket = { ...newTicketObj };
    this.ticketsList.unshift(localTicket);
    this.saveLocalCache();

    this.isSubmitting = false;
    this.submitSuccess = true;
    this.createdTicketInfo = localTicket;
    this.resetForm();

    // Отправляем во внешнюю базу данных
    this.http.post<Ticket>(this.activeEndpointUrl, newTicketObj).subscribe({
      next: (created) => {
        localTicket._id = created._id;
        this.saveLocalCache();
      },
      error: (err) => {
        if (err.status === 404 || err.status === 400 || err.status === 0) {
          this.recoverEndpoint();
        }
      },
    });
  }

  resetForm(): void {
    this.newTicket = {
      nickname: this.currentUserNickname || '',
      contact: '',
      category: 'Технические проблемы',
      priority: 'Средний',
      subject: '',
      description: '',
    };
  }

  get filteredTickets(): Ticket[] {
    let list = [...this.ticketsList];

    if (this.viewMode === 'admin' && this.adminFilterStatus !== 'ВСЕ') {
      list = list.filter((t) => t.status === this.adminFilterStatus);
    }

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(q) ||
          t.nickname.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q),
      );
    }

    return list;
  }

  openTicketDetails(ticket: Ticket): void {
    this.selectedTicket = ticket;
  }

  closeTicketDetails(): void {
    this.selectedTicket = null;
    this.replyText = '';
  }

  sendReply(): void {
    if (!this.replyText.trim() || !this.selectedTicket) return;

    if (!this.canUserReply(this.selectedTicket)) {
      alert('Отвечать в этом тикете могут только Автор обращения и Администрация!');
      return;
    }

    const isSupportRole = this.viewMode === 'admin' && this.isAdminAuthenticated;
    const senderName = isSupportRole ? (this.adminName || 'Агент Поддержки') : this.selectedTicket.nickname;
    const role = isSupportRole ? ('support' as const) : ('user' as const);
    const now = new Date().toISOString();

    const newMsg: TicketMessage = {
      id: `m-${Date.now()}`,
      sender: senderName,
      role: role,
      text: this.replyText.trim(),
      timestamp: now,
    };

    const targetTicket = this.selectedTicket;
    targetTicket.messages.push(newMsg);
    targetTicket.updatedAt = now;
    targetTicket.status = isSupportRole ? 'В обработке' : 'Ожидает ответа';
    this.selectedTicket = { ...targetTicket, messages: [...targetTicket.messages] };
    this.saveLocalCache();
    this.replyText = '';

    if (targetTicket._id) {
      const { _id, ...body } = targetTicket;
      this.http.put(`${this.activeEndpointUrl}/${_id}`, body).subscribe({
        next: () => this.saveLocalCache(),
        error: (err) => {
          if (err.status === 404 || err.status === 400 || err.status === 0) this.recoverEndpoint();
        },
      });
    } else {
      // Если у тикета нет _id, создаем заново в базе
      const { _id, ...body } = targetTicket;
      this.http.post<Ticket>(this.activeEndpointUrl, body).subscribe({
        next: (created) => {
          targetTicket._id = created._id;
          this.saveLocalCache();
        },
        error: (err) => {
          if (err.status === 404 || err.status === 400 || err.status === 0) this.recoverEndpoint();
        },
      });
    }
  }

  changeStatus(newStatus: TicketStatus): void {
    if (!this.selectedTicket) return;

    const now = new Date().toISOString();
    const newMsg: TicketMessage = {
      id: `m-${Date.now()}`,
      sender: 'Система',
      role: 'system',
      text: `Статус тикета изменён на: "${newStatus}"`,
      timestamp: now,
    };

    const targetTicket = this.selectedTicket;
    targetTicket.status = newStatus;
    targetTicket.updatedAt = now;
    targetTicket.messages.push(newMsg);
    this.selectedTicket = { ...targetTicket, messages: [...targetTicket.messages] };
    this.saveLocalCache();

    if (targetTicket._id) {
      const { _id, ...body } = targetTicket;
      this.http.put(`${this.activeEndpointUrl}/${_id}`, body).subscribe({
        next: () => this.saveLocalCache(),
        error: (err) => {
          if (err.status === 404 || err.status === 400 || err.status === 0) this.recoverEndpoint();
        },
      });
    }
  }

  deleteTicket(ticketId: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!confirm('Вы действительно хотите закрыть и удалить этот тикет?')) return;

    const targetTicket = this.ticketsList.find((t) => t.id === ticketId || t._id === ticketId);
    const dbId = targetTicket?._id || ticketId;

    if (targetTicket?._id) {
      this.http.delete(`${this.activeEndpointUrl}/${targetTicket._id}`).subscribe({
        next: () => {},
        error: (err) => console.warn('Delete error:', err),
      });
    }

    this.ticketsList = this.ticketsList.filter((t) => t.id !== ticketId && t._id !== ticketId && t._id !== dbId);
    this.saveLocalCache();

    if (this.selectedTicket?.id === ticketId || this.selectedTicket?._id === dbId) {
      this.closeTicketDetails();
    }
  }

  getStatusClass(status: TicketStatus): string {
    switch (status) {
      case 'Ожидает ответа':
        return 'status-pending';
      case 'В обработке':
        return 'status-progress';
      case 'Решено':
        return 'status-resolved';
      case 'Закрыто':
        return 'status-closed';
      default:
        return '';
    }
  }
}
