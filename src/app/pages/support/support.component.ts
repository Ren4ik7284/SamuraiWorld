import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { AuthService, User } from '../../services/auth.service';
import { WebSocketService } from '../../services/websocket.service';
export type TicketCategory =
  | 'Технические проблемы'
  | 'Аккаунт & Паспорт'
  | 'Донат & Экономика'
  | 'Суд & Жалоба'
  | 'Идеи & Баг-репорты';
export type TicketPriority = 'Низкий' | 'Средний' | 'Высокий' | 'Критический';
export type TicketStatus = 'В работе' | 'Выполненные' | 'Нерешенные' | 'Ожидает ответа' | 'В обработке' | 'Решено' | 'Закрыто';
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
  currentUser: User | null = null;
  showAuthModal: boolean = false;
  authMode: 'login' | 'register' = 'login';
  authNicknameInput: string = '';
  authPasswordInput: string = '';
  authEmailInput: string = '';
  authErrorMessage: string = '';
  authSuccessMessage: string = '';
  isAuthSubmitting: boolean = false;
  viewMode: 'user' | 'admin' = 'user';
  activeTab: 'create' | 'tracker' | 'faq' = 'create';
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
  searchQuery = '';
  adminFilterStatus = 'ВСЕ';
  ticketsList: Ticket[] = [];
  selectedTicket: Ticket | null = null;
  registeredUsers: (User & { lastLogin?: string })[] = [];
  userSearchQuery = '';
  replyText = '';
  isReplying = false;
  private wsSubs: Subscription[] = [];

  constructor(
    private http: HttpClient,
    public authService: AuthService,
    private wsService: WebSocketService,
  ) {}

  ngOnInit(): void {
    // Подключаем WebSocket для real-time
    this.wsService.connect();

    // Реагируем на изменения пользователя
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
      this.loadRegisteredUsers();
    });

    // 🔴 WebSocket: новый тикет — добавляем в список плавно
    this.wsSubs.push(
      this.wsService.ticketCreated$.subscribe((ticket) => {
        const deletedIds = this.getDeletedTicketIds();
        if (!deletedIds.includes(ticket.id) && !this.ticketsList.find(t => t.id === ticket.id)) {
          // Обычный юзер видит только свои тикеты
          if (this.authService.isSupportOrAdmin || ticket.nickname === this.currentUser?.nickname || ticket.userId === this.currentUser?.id) {
            this.ticketsList.unshift(ticket);
            this.saveLocalTicketsCache(this.ticketsList);
          }
        }
      })
    );

    // 🔴 WebSocket: тикет обновлён (новый ответ / смена статуса)
    this.wsSubs.push(
      this.wsService.ticketUpdated$.subscribe((updated) => {
        const idx = this.ticketsList.findIndex(t => t.id === updated.id);
        if (idx !== -1) {
          // Плавно обновляем только нужный тикет — без перезагрузки страницы
          this.ticketsList[idx] = updated;
          this.ticketsList = [...this.ticketsList];
          this.saveLocalTicketsCache(this.ticketsList);
          // Если этот тикет открыт — обновляем его в модале
          if (this.selectedTicket?.id === updated.id) {
            this.selectedTicket = { ...updated, messages: [...updated.messages] };
          }
        } else if (this.authService.isSupportOrAdmin) {
          // Тикет которого не было в списке — добавляем
          this.ticketsList.unshift(updated);
          this.ticketsList = [...this.ticketsList];
          this.saveLocalTicketsCache(this.ticketsList);
        }
      })
    );

    // 🔴 WebSocket: тикет удалён
    this.wsSubs.push(
      this.wsService.ticketDeleted$.subscribe(({ id }) => {
        this.addDeletedTicketId(id);
        this.ticketsList = this.ticketsList.filter(t => t.id !== id);
        this.saveLocalTicketsCache(this.ticketsList);
        if (this.selectedTicket?.id === id) {
          this.closeTicketDetails();
        }
      })
    );

    // 🔴 WebSocket: изменения пользователей
    this.wsSubs.push(
      this.wsService.usersUpdated$.subscribe(() => {
        if (this.authService.isSupportOrAdmin) {
          this.loadRegisteredUsers();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.wsSubs.forEach(s => s.unsubscribe());
    this.wsService.disconnect();
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
      // Если admin/support уже залогинен — регистрируем пользователя напрямую без смены сессии
      if (this.authService.isSupportOrAdmin && this.currentUser) {
        const headers = this.authService.getAuthHeaders();
        this.http.post('/api/auth/register', {
          nickname: this.authNicknameInput.trim(),
          password: this.authPasswordInput.trim(),
          email: this.authEmailInput.trim() || undefined,
        }, headers).subscribe({
          next: () => {
            this.isAuthSubmitting = false;
            this.authSuccessMessage = `Пользователь "${this.authNicknameInput.trim()}" успешно добавлен!`;
            this.authNicknameInput = '';
            this.authPasswordInput = '';
            this.authEmailInput = '';
            // Обновляем список пользователей
            this.isLoadingUsers = false;
            this.loadRegisteredUsers();
            setTimeout(() => this.closeAuthModal(), 1200);
          },
          error: (err) => {
            this.isAuthSubmitting = false;
            this.authErrorMessage = err.error?.message || 'Ошибка при добавлении пользователя.';
          },
        });
      } else {
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
                err.error?.message || 'Ошибка при регистрации. Проверьте данные.';
            },
          });
      }
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
    this.submitSuccess = false;
    this.newTicket.category = cat;
  }
  isLoadingUsers = false;
  isLoadingTickets = false;
  deletingUserId: string | null = null;
  readonly DELETED_USERS_KEY = 'samurai_deleted_users_store_v1';

  private getDeletedUserKeys(): string[] {
    try {
      const raw = localStorage.getItem(this.DELETED_USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private addDeletedUserKey(key: string): void {
    try {
      const list = this.getDeletedUserKeys();
      const norm = key.toLowerCase().trim();
      if (norm && !list.includes(norm)) {
        list.push(norm);
        localStorage.setItem(this.DELETED_USERS_KEY, JSON.stringify(list));
      }
    } catch {}
  }

  loadRegisteredUsers(): void {
    if (this.isLoadingUsers) return;
    this.isLoadingUsers = true;
    const headers = this.authService.getAuthHeaders();
    let localUsers: any[] = [];
    try {
      const raw = localStorage.getItem('samurai_known_accounts_store');
      if (raw) {
        const obj = JSON.parse(raw);
        const deletedKeys = new Set(this.getDeletedUserKeys());
        localUsers = Object.values(obj).filter((u: any) => u && u.nickname && !deletedKeys.has(u.nickname.toLowerCase()) && !deletedKeys.has(u.id));
      }
    } catch {}
    if (localUsers.length > 0) {
      this.http.post<(User & { lastLogin?: string })[]>('/api/auth/sync_users', { users: localUsers }, headers).subscribe({
        next: (list) => {
          this.isLoadingUsers = false;
          if (Array.isArray(list)) {
            this.mergeUsersList(list);
          }
        },
        error: () => {
          this.isLoadingUsers = false;
          this.fetchServerUsersFallback(headers);
        },
      });
    } else {
      this.fetchServerUsersFallback(headers);
    }
  }

  private fetchServerUsersFallback(headers: any): void {
    this.http.get<(User & { lastLogin?: string })[]>('/api/auth/users', headers).subscribe({
      next: (list) => {
        this.isLoadingUsers = false;
        if (Array.isArray(list)) {
          this.mergeUsersList(list);
        }
      },
      error: () => {
        this.isLoadingUsers = false;
        this.mergeUsersList([]);
      },
    });
  }

  readonly DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.03-4.84-2.6.03-1.61 3.22-2.4 4.84-2.4 1.61 0 4.81.79 4.84 2.4C15.8 18.97 14.03 20 12 20z"/></svg>';

  onAvatarError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target && target.src !== this.DEFAULT_AVATAR) {
      target.src = this.DEFAULT_AVATAR;
    }
  }

  private mergeUsersList(serverUsers: (User & { lastLogin?: string })[]): void {
    const map = new Map<string, User & { lastLogin?: string }>();
    const deletedKeys = new Set(this.getDeletedUserKeys());
    // Seed-пользователи бэкенда которые не нужно показывать в панели
    const seedNicknames = new Set(['playerone', 'support_agent', 'admin_samurai']);
    const masterAdmins = new Set(['ren4ik284', 'mydaf0n62']);
    try {
      const raw = localStorage.getItem('samurai_known_accounts_store');
      if (raw) {
        const obj = JSON.parse(raw);
        for (const k of Object.keys(obj)) {
          const u = obj[k];
          if (u && u.nickname) {
            const nickKey = u.nickname.toLowerCase();
            if (deletedKeys.has(nickKey) || (u.id && deletedKeys.has(u.id))) continue;
            const avatar = (u.avatarUrl && !u.avatarUrl.includes('crafatar.com')) ? u.avatarUrl : this.DEFAULT_AVATAR;
            map.set(nickKey, {
              id: u.id || `usr-${nickKey}`,
              nickname: u.nickname,
              email: u.email || `${nickKey}@samuraiworld.ru`,
              role: masterAdmins.has(nickKey) ? 'admin' : u.role || 'user',
              avatarUrl: avatar,
              createdAt: u.createdAt || new Date().toISOString(),
              lastLogin: u.lastLogin || u.createdAt || new Date().toISOString(),
            });
          }
        }
      }
    } catch {}
    for (const u of serverUsers) {
      if (u && u.nickname) {
        const key = u.nickname.toLowerCase();
        if (deletedKeys.has(key) || (u.id && deletedKeys.has(u.id))) continue;
        // Пропускаем только seed-пользователей по умолчанию, если у них нет реального email
        if (seedNicknames.has(key) && (!u.email || u.email.endsWith('@samuraiworld.ru') || u.email.endsWith('@samuraiworld.local'))) continue;
        const existing = map.get(key);
        // Приоритет аватара: локальный (уже обновлённый пользователем) > серверный
        const localAvatar = existing?.avatarUrl;
        const serverAvatar = (u.avatarUrl && !u.avatarUrl.includes('crafatar.com')) ? u.avatarUrl : undefined;
        const finalAvatar = (localAvatar && localAvatar !== this.DEFAULT_AVATAR) ? localAvatar : (serverAvatar || this.DEFAULT_AVATAR);
        map.set(key, {
          ...existing,
          ...u,
          avatarUrl: finalAvatar,
          role: masterAdmins.has(key) ? 'admin' : u.role || existing?.role || 'user',
        });
      }
    }
    try {
      const cleanStore: any = {};
      map.forEach((user, key) => {
        cleanStore[key] = user;
      });
      localStorage.setItem('samurai_known_accounts_store', JSON.stringify(cleanStore));
    } catch {}
    const arr = Array.from(map.values())
      .sort((a, b) => {
        const timeA = new Date(a.lastLogin || a.createdAt || 0).getTime();
        const timeB = new Date(b.lastLogin || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    this.registeredUsers = arr;
  }

  get filteredRegisteredUsers(): (User & { lastLogin?: string })[] {
    if (!this.userSearchQuery.trim()) return this.registeredUsers;
    const q = this.userSearchQuery.toLowerCase().trim();
    return this.registeredUsers.filter(
      (u) => u.nickname.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q)
    );
  }

  changeUserRole(targetUser: User, newRole: 'user' | 'support' | 'admin'): void {
    if (!this.authService.isSupportOrAdmin) return;
    targetUser.role = newRole;
    const headers = this.authService.getAuthHeaders();
    this.http.patch(`/api/auth/users/${targetUser.id || targetUser.nickname}/role`, { role: newRole }, headers).subscribe({
      next: () => {
        try {
          const raw = localStorage.getItem('samurai_known_accounts_store');
          if (raw) {
            const obj = JSON.parse(raw);
            const k = targetUser.nickname.toLowerCase();
            if (obj[k]) {
              obj[k].role = newRole;
              localStorage.setItem('samurai_known_accounts_store', JSON.stringify(obj));
            }
          }
        } catch {}
      },
      error: () => {},
    });
  }

  deleteUser(targetUser: any): void {
    if (!this.authService.isAdmin && !this.authService.isSupportOrAdmin) {
      alert('Только администраторы могут удалять пользователей');
      return;
    }
    const cleanNick = (targetUser.nickname || '').toLowerCase();
    if (['ren4ik284', 'mydaf0n62'].includes(cleanNick)) {
      alert('Нельзя удалить главного администратора!');
      return;
    }
    if (!confirm(`Вы уверены, что хотите навсегда удалить пользователя "${targetUser.nickname}" из базы сайта?`)) {
      return;
    }

    this.deletingUserId = targetUser.id || cleanNick;
    this.addDeletedUserKey(cleanNick);
    if (targetUser.id) {
      this.addDeletedUserKey(targetUser.id);
    }

    // Immediately remove from UI state
    this.registeredUsers = this.registeredUsers.filter(
      (u) => u.id !== targetUser.id && u.nickname.toLowerCase() !== cleanNick
    );

    // Clean from known accounts local storage
    try {
      const raw = localStorage.getItem('samurai_known_accounts_store');
      if (raw) {
        const obj = JSON.parse(raw);
        delete obj[cleanNick];
        if (targetUser.id && obj[targetUser.id]) {
          delete obj[targetUser.id];
        }
        localStorage.setItem('samurai_known_accounts_store', JSON.stringify(obj));
      }
    } catch {}

    const headers = this.authService.getAuthHeaders();
    const identifier = encodeURIComponent(targetUser.id || cleanNick);
    this.http.delete(`/api/auth/users/${identifier}`, headers).subscribe({
      next: () => {
        this.deletingUserId = null;
      },
      error: () => {
        this.deletingUserId = null;
      },
    });
  }
  formatDateAgo(dateStr?: string): string {
    if (!dateStr) return 'Неизвестно';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Неизвестно';
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Только что';
    if (diff < 3600) return `${Math.floor(diff / 60)} мин. назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч. назад`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн. назад`;
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  readonly LOCAL_STORAGE_KEY = 'samurai_tickets_cache_v2';
  readonly GUEST_TICKETS_KEY = 'samurai_guest_ticket_ids_v2';
  readonly DELETED_TICKETS_KEY = 'samurai_deleted_ticket_ids_v2';
  private getGuestTicketIds(): string[] {
    try {
      const data = localStorage.getItem(this.GUEST_TICKETS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
  private addGuestTicketId(id: string): void {
    try {
      const ids = this.getGuestTicketIds();
      if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem(this.GUEST_TICKETS_KEY, JSON.stringify(ids));
      }
    } catch {}
  }
  private getDeletedTicketIds(): string[] {
    try {
      const data = localStorage.getItem(this.DELETED_TICKETS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
  private addDeletedTicketId(id: string): void {
    try {
      const ids = this.getDeletedTicketIds();
      if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem(this.DELETED_TICKETS_KEY, JSON.stringify(ids));
      }
    } catch {}
  }
  private loadLocalTicketsCache(): Ticket[] {
    try {
      const data = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      const deletedIds = this.getDeletedTicketIds();
      const list: Ticket[] = data ? JSON.parse(data) : [];
      return list.filter((t) => t && t.id && !deletedIds.includes(t.id));
    } catch {
      return [];
    }
  }
  private saveLocalTicketsCache(tickets: Ticket[]): void {
    try {
      const deletedIds = this.getDeletedTicketIds();
      const clean = tickets.filter((t) => t && t.id && !deletedIds.includes(t.id));
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(clean));
    } catch {}
  }
  loadTickets(silent: boolean = false): void {
    const headers = this.authService.getAuthHeaders();
    let url = this.API_TICKETS_URL;
    if (this.ticketsList.length === 0) {
      const localCache = this.loadLocalTicketsCache();
      if (localCache.length > 0) {
        this.ticketsList = localCache;
      } else if (!silent) {
        this.isLoadingTickets = true;
      }
    }
    this.http.get<Ticket[]>(url, headers).subscribe({
      next: (data) => {
        this.isLoadingTickets = false;
        if (Array.isArray(data)) {
          this.updateTicketsList(data);
        }
      },
      error: (err) => {
        this.isLoadingTickets = false;
        if (!silent) {
          console.warn('Ошибка загрузки тикетов с сервера:', err);
        }
      },
    });
  }
  private updateTicketsList(newList: Ticket[]): void {
    const deletedIds = new Set(this.getDeletedTicketIds());
    const activeList = (newList || []).filter(
      (t) => t && t.id && !deletedIds.has(t.id) && (!t.ticketNumber || !deletedIds.has(t.ticketNumber))
    );
    activeList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.ticketsList = activeList;
    this.saveLocalTicketsCache(activeList);
    this.syncSelectedTicket();
  }
  private syncSelectedTicket(): void {
    if (this.selectedTicket) {
      const updated = this.ticketsList.find(
        (t) => t.id === this.selectedTicket?.id || t.ticketNumber === this.selectedTicket?.ticketNumber
      );
      if (updated) {
        this.selectedTicket = {
          ...updated,
          messages: [...updated.messages],
        };
      } else {
        this.closeTicketDetails();
      }
    }
  }
  canUserReply(ticket: Ticket | null): boolean {
    return !!ticket;
  }
  submitTicket(): void {
    const nickname = (this.currentUser?.nickname || this.newTicket.nickname || 'Игрок').trim();
    if (!nickname || !this.newTicket.subject || !this.newTicket.description) {
      this.errorMessage = 'Заполните ваш никнейм, тему и описание проблемы.';
      return;
    }
    this.errorMessage = '';
    this.isSubmitting = true;
    const priorityToUse = this.authService.isSupportOrAdmin ? this.newTicket.priority : 'Средний';
    const dto = {
      nickname,
      contact: this.newTicket.contact || 'Не указан',
      category: this.newTicket.category,
      priority: priorityToUse,
      subject: this.newTicket.subject,
      description: this.newTicket.description,
    };
    const headers = this.authService.getAuthHeaders();
    this.http.post<Ticket>(this.API_TICKETS_URL, dto, headers).subscribe({
      next: (created) => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.createdTicketInfo = created;
        this.addGuestTicketId(created.id);
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
    this.submitSuccess = false;
    this.createdTicketInfo = null;
    this.errorMessage = '';
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
    const deletedIds = this.getDeletedTicketIds();
    let list = this.ticketsList.filter((t) => t && t.id && !deletedIds.includes(t.id));
    if (!this.authService.isSupportOrAdmin && this.viewMode !== 'admin') {
      if (this.currentUser) {
        const myNick = this.currentUser.nickname.toLowerCase();
        list = list.filter((t) => t.nickname.toLowerCase() === myNick || t.userId === this.currentUser?.id);
      } else {
        const guestIds = this.getGuestTicketIds();
        list = list.filter((t) => guestIds.includes(t.id));
      }
    } else if (this.viewMode === 'admin' && this.adminFilterStatus !== 'ВСЕ') {
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
    if (typeof document !== 'undefined') {
      document.body.classList.add('ticket-modal-open');
    }
  }
  closeTicketDetails(): void {
    this.selectedTicket = null;
    this.replyText = '';
    if (typeof document !== 'undefined') {
      document.body.classList.remove('ticket-modal-open');
    }
  }
  sendReply(): void {
    if (!this.replyText.trim() || !this.selectedTicket) return;
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
    if (!this.authService.isSupportOrAdmin) {
      alert('Изменение статуса тикета доступно только Администраторам!');
      return;
    }
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
    if (!this.authService.isSupportOrAdmin) {
      alert('Удаление тикетов доступно только Администраторам!');
      return;
    }
    if (!confirm('Вы действительно хотите закрыть и удалить этот тикет?')) return;
    const target = this.ticketsList.find((t) => t.id === ticketId);
    this.addDeletedTicketId(ticketId);
    if (target?.ticketNumber) {
      this.addDeletedTicketId(target.ticketNumber);
    }
    this.ticketsList = this.ticketsList.filter((t) => t && t.id !== ticketId && t.ticketNumber !== target?.ticketNumber);
    this.saveLocalTicketsCache(this.ticketsList);
    if (this.selectedTicket?.id === ticketId || (target?.ticketNumber && this.selectedTicket?.ticketNumber === target.ticketNumber)) {
      this.closeTicketDetails();
    }
    const headers = this.authService.getAuthHeaders();
    this.http.delete(`${this.API_TICKETS_URL}/${ticketId}`, headers).subscribe({
      next: () => {
        this.loadTickets(true);
      },
      error: (err) => {
        console.warn('Удалено локально:', err);
        this.loadTickets(true);
      },
    });
  }
  getStatusClass(status: TicketStatus): string {
    switch (status) {
      case 'Нерешенные':
      case 'Ожидает ответа':
        return 'status-pending';
      case 'В работе':
      case 'В обработке':
        return 'status-progress';
      case 'Выполненные':
      case 'Решено':
        return 'status-resolved';
      case 'Закрыто':
        return 'status-closed';
      default:
        return 'status-progress';
    }
  }
}
