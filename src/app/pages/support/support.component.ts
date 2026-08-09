import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { AuthService, User } from '../../services/auth.service';

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
  id: string;
  ticketNumber: string;
  userId?: string;
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
  readonly API_TICKETS_URL = '/api/support/tickets';

  // Текущий пользователь из AuthService
  currentUser: User | null = null;

  // Модалка авторизации / регистрации
  showAuthModal: boolean = false;
  authMode: 'login' | 'register' = 'login';
  authNicknameInput: string = '';
  authPasswordInput: string = '';
  authEmailInput: string = '';
  authErrorMessage: string = '';
  authSuccessMessage: string = '';
  isAuthSubmitting: boolean = false;

  // Режим просмотра: 'user' (Игрок) или 'admin' (Панель техподдержки)
  viewMode: 'user' | 'admin' = 'user';

  // Выбранная вкладка: 'create' | 'tracker' | 'faq'
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

  // Ответы и действия поддержки
  replyText = '';
  isReplying = false;

  private pollTimer: any;

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      if (user) {
        this.newTicket.nickname = user.nickname;
        if (user.role === 'admin' || user.role === 'support') {
          this.viewMode = 'admin';
        } else {
          this.viewMode = 'user';
        }
      } else {
        this.viewMode = 'user';
      }
      this.loadTickets();
    });

    // Автоматическое обновление каждые 4 секунды
    this.pollTimer = setInterval(() => {
      this.loadTickets(true);
    }, 4000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  openAuthModal(mode: 'login' | 'register' = 'login'): void {
    this.authMode = mode;
    this.showAuthModal = true;
    this.authErrorMessage = '';
    this.authSuccessMessage = '';
  }

  closeAuthModal(): void {
    this.showAuthModal = false;
  }

  switchAuthMode(mode: 'login' | 'register'): void {
    this.authMode = mode;
    this.authErrorMessage = '';
    this.authSuccessMessage = '';
  }

  submitAuth(): void {
    if (!this.authNicknameInput.trim() || !this.authPasswordInput.trim()) {
      this.authErrorMessage = 'Введите никнейм и пароль';
      return;
    }

    this.isAuthSubmitting = true;
    this.authErrorMessage = '';
    this.authSuccessMessage = '';

    if (this.authMode === 'register') {
      this.authService
        .register({
          nickname: this.authNicknameInput.trim(),
          password: this.authPasswordInput.trim(),
          email: this.authEmailInput.trim() || undefined,
        })
        .subscribe({
          next: () => {
            this.isAuthSubmitting = false;
            this.authSuccessMessage = 'Успешная регистрация и вход!';
            setTimeout(() => this.closeAuthModal(), 800);
          },
          error: (err) => {
            this.isAuthSubmitting = false;
            this.authErrorMessage =
              err.error?.message || 'Ошибка при регистрации. Возможно никнейм уже занят.';
          },
        });
    } else {
      this.authService
        .login({
          nickname: this.authNicknameInput.trim(),
          password: this.authPasswordInput.trim(),
        })
        .subscribe({
          next: () => {
            this.isAuthSubmitting = false;
            this.authSuccessMessage = 'Успешный вход!';
            setTimeout(() => this.closeAuthModal(), 800);
          },
          error: (err) => {
            this.isAuthSubmitting = false;
            this.authErrorMessage =
              err.error?.message || 'Неверный никнейм или пароль.';
          },
        });
    }
  }

  logout(): void {
    this.authService.logout();
    this.viewMode = 'user';
    this.ticketsList = [];
    this.selectedTicket = null;
    this.loadTickets();
  }

  switchToUserView(): void {
    this.viewMode = 'user';
  }

  switchToAdminView(): void {
    if (this.authService.isSupportOrAdmin) {
      this.viewMode = 'admin';
    } else {
      this.openAuthModal('login');
    }
  }

  selectCategory(cat: TicketCategory): void {
    this.newTicket.category = cat;
  }

  /**
   * Загрузка тикетов с передачей JWT токена
   */
  readonly LOCAL_STORAGE_KEY = 'samurai_tickets_cache_v1';

  private loadLocalTicketsCache(): Ticket[] {
    try {
      const data = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveLocalTicketsCache(tickets: Ticket[]): void {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(tickets));
    } catch {}
  }

  /**
   * Загрузка и синхронизация тикетов с сервером и локальным кэшем
   */
  loadTickets(silent: boolean = false): void {
    const headers = this.authService.getAuthHeaders();
    let url = this.API_TICKETS_URL;
    
    if (!this.currentUser && this.newTicket.nickname) {
      url += `?nickname=${encodeURIComponent(this.newTicket.nickname.trim())}`;
    }

    const localCache = this.loadLocalTicketsCache();

    if (localCache.length > 0) {
      this.http.post<Ticket[]>(`${this.API_TICKETS_URL}/sync`, { tickets: localCache }, headers).subscribe({
        next: (data) => {
          if (Array.isArray(data)) {
            this.updateTicketsList(data);
          }
        },
        error: () => {
          this.fetchTicketsGet(url, headers, silent, localCache);
        },
      });
    } else {
      this.fetchTicketsGet(url, headers, silent, localCache);
    }
  }

  private fetchTicketsGet(url: string, headers: any, silent: boolean, localCache: Ticket[]): void {
    this.http.get<Ticket[]>(url, headers).subscribe({
      next: (data) => {
        if (Array.isArray(data)) {
          this.updateTicketsList(data);
        }
      },
      error: (err) => {
        if (!silent) {
          console.warn('Ошибка загрузки тикетов:', err);
        }
        if (localCache.length > 0) {
          this.updateTicketsList(localCache);
        }
      },
    });
  }

  private updateTicketsList(newList: Ticket[]): void {
    const localCache = this.loadLocalTicketsCache();
    const mergedMap = new Map<string, Ticket>();

    for (const t of localCache) mergedMap.set(t.id, t);
    for (const t of newList) {
      if (mergedMap.has(t.id)) {
        const existing = mergedMap.get(t.id)!;
        const msgMap = new Map<string, TicketMessage>();
        for (const m of existing.messages || []) msgMap.set(m.id, m);
        for (const m of t.messages || []) msgMap.set(m.id, m);
        
        mergedMap.set(t.id, {
          ...t,
          messages: Array.from(msgMap.values()).sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          ),
        });
      } else {
        mergedMap.set(t.id, t);
      }
    }

    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    this.ticketsList = merged;
    this.saveLocalTicketsCache(merged);
    this.syncSelectedTicket();
  }

  private syncSelectedTicket(): void {
    if (this.selectedTicket) {
      const updated = this.ticketsList.find((t) => t.id === this.selectedTicket?.id);
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
    if (this.authService.isSupportOrAdmin) return true;

    const userNick = (this.currentUser?.nickname || this.newTicket.nickname).trim().toLowerCase();
    const authorNick = ticket.nickname.trim().toLowerCase();

    return !!userNick && userNick === authorNick;
  }

  /**
   * Создание нового обращения с JWT привязкой
   */
  submitTicket(): void {
    const nickname = (this.currentUser?.nickname || this.newTicket.nickname).trim();
    if (!nickname || !this.newTicket.subject || !this.newTicket.description) {
      this.errorMessage = 'Заполните ваш никнейм, тему и описание проблемы.';
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;

    const dto = {
      nickname,
      contact: this.newTicket.contact || 'Не указан',
      category: this.newTicket.category,
      priority: this.newTicket.priority,
      subject: this.newTicket.subject,
      description: this.newTicket.description,
    };

    const headers = this.authService.getAuthHeaders();

    this.http.post<Ticket>(this.API_TICKETS_URL, dto, headers).subscribe({
      next: (created) => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.createdTicketInfo = created;
        this.ticketsList.unshift(created);
        this.saveLocalTicketsCache(this.ticketsList);
        this.resetForm();
        this.activeTab = 'tracker';
        this.openTicketDetails(created);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err.error?.message || 'Ошибка создания тикета на сервере.';
      },
    });
  }

  resetForm(): void {
    this.newTicket = {
      nickname: this.currentUser?.nickname || '',
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
      alert('Отвечать в этом тикете могут только Автор обращения и Техподдержка!');
      return;
    }

    this.isReplying = true;
    const isStaff = this.authService.isSupportOrAdmin;
    const senderName = this.currentUser?.nickname || (isStaff ? 'Агент Поддержки' : this.selectedTicket.nickname);
    const role = isStaff ? ('support' as const) : ('user' as const);

    const dto = {
      sender: senderName,
      role: role,
      text: this.replyText.trim(),
      ticketContext: this.selectedTicket,
    };

    const headers = this.authService.getAuthHeaders();

    this.http.post<Ticket>(`${this.API_TICKETS_URL}/${this.selectedTicket.id}/messages`, dto, headers).subscribe({
      next: (updated) => {
        this.isReplying = false;
        this.replyText = '';
        this.selectedTicket = updated;
        const idx = this.ticketsList.findIndex((t) => t.id === updated.id);
        if (idx !== -1) {
          this.ticketsList[idx] = updated;
        } else {
          this.ticketsList.unshift(updated);
        }
        this.saveLocalTicketsCache(this.ticketsList);
      },
      error: (err) => {
        this.isReplying = false;
        alert(err.error?.message || 'Ошибка отправки ответа.');
      },
    });
  }

  changeStatus(newStatus: TicketStatus): void {
    if (!this.selectedTicket) return;

    const headers = this.authService.getAuthHeaders();
    const dto = {
      status: newStatus,
      ticketContext: this.selectedTicket,
    };

    this.http
      .patch<Ticket>(`${this.API_TICKETS_URL}/${this.selectedTicket.id}/status`, dto, headers)
      .subscribe({
        next: (updated) => {
          this.selectedTicket = updated;
          const idx = this.ticketsList.findIndex((t) => t.id === updated.id);
          if (idx !== -1) {
            this.ticketsList[idx] = updated;
          } else {
            this.ticketsList.unshift(updated);
          }
          this.saveLocalTicketsCache(this.ticketsList);
        },
        error: (err) => alert(err.error?.message || 'Ошибка изменения статуса.'),
      });
  }

  deleteTicket(ticketId: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!confirm('Вы действительно хотите закрыть и удалить этот тикет?')) return;

    const headers = this.authService.getAuthHeaders();
    this.http.delete(`${this.API_TICKETS_URL}/${ticketId}`, headers).subscribe({
      next: () => {
        this.ticketsList = this.ticketsList.filter((t) => t.id !== ticketId);
        this.saveLocalTicketsCache(this.ticketsList);
        if (this.selectedTicket?.id === ticketId) {
          this.closeTicketDetails();
        }
      },
      error: (err) => alert(err.error?.message || 'Ошибка удаления тикета.'),
    });
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
