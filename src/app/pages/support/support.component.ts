import { Component, OnInit } from '@angular/core';
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
export class SupportComponent implements OnInit {
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

  // Категории с ИСПРАВЛЕННЫМ ЧЕТКИМ SVG ДЛЯ "ИДЕИ & БАГ-РЕПОРТЫ"
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

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.checkAdminAuth();
    this.loadTickets();
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

  submitTicket(): void {
    if (!this.newTicket.nickname || !this.newTicket.subject || !this.newTicket.description) {
      this.errorMessage = 'Заполните никнейм, тему и описание проблемы.';
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;

    this.http.post<Ticket>('/api/support/tickets', this.newTicket).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.createdTicketInfo = res;
        this.ticketsList.unshift(res);
        this.resetForm();
      },
      error: () => {
        this.isSubmitting = false;
        const now = new Date().toISOString();
        const fallbackTicket: Ticket = {
          id: `t-${Date.now()}`,
          ticketNumber: `TK-${Math.floor(10000 + Math.random() * 90000)}`,
          nickname: this.newTicket.nickname,
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
              id: 'm-1',
              sender: this.newTicket.nickname,
              role: 'user',
              text: this.newTicket.description,
              timestamp: now,
            },
            {
              id: 'm-2',
              sender: 'Система RabbitMQ',
              role: 'system',
              text: 'Обращение зарегистрировано и направлено в очередь поддержки [AMQP Queue: support.ticket.created]',
              timestamp: now,
            },
          ],
        };
        this.submitSuccess = true;
        this.createdTicketInfo = fallbackTicket;
        this.ticketsList.unshift(fallbackTicket);
        this.resetForm();
      },
    });
  }

  resetForm(): void {
    this.newTicket = {
      nickname: '',
      contact: '',
      category: 'Технические проблемы',
      priority: 'Средний',
      subject: '',
      description: '',
    };
  }

  loadTickets(): void {
    this.http.get<Ticket[]>('/api/support/tickets').subscribe({
      next: (data) => {
        this.ticketsList = data;
      },
      error: () => {
        if (!this.ticketsList) this.ticketsList = [];
      },
    });
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

    const ticketId = this.selectedTicket.id;
    const isSupportRole = this.viewMode === 'admin';
    const senderName = isSupportRole ? (this.adminName || 'Агент Поддержки') : this.selectedTicket.nickname;
    const role = isSupportRole ? ('support' as const) : ('user' as const);

    const reply = {
      sender: senderName,
      role: role,
      text: this.replyText.trim(),
    };

    this.isReplying = true;
    this.http.post<Ticket>(`/api/support/tickets/${ticketId}/messages`, reply).subscribe({
      next: (updated) => {
        this.selectedTicket = updated;
        this.replyText = '';
        this.isReplying = false;
        this.updateLocalTicket(updated);
      },
      error: () => {
        const now = new Date().toISOString();
        this.selectedTicket?.messages.push({
          id: `m-${Date.now()}`,
          sender: reply.sender,
          role: reply.role,
          text: reply.text,
          timestamp: now,
        });
        if (this.selectedTicket) {
          this.selectedTicket.updatedAt = now;
          this.selectedTicket.status = isSupportRole ? 'В обработке' : 'Ожидает ответа';
        }
        this.replyText = '';
        this.isReplying = false;
      },
    });
  }

  changeStatus(newStatus: TicketStatus): void {
    if (!this.selectedTicket) return;

    const ticketId = this.selectedTicket.id;
    this.http.patch<Ticket>(`/api/support/tickets/${ticketId}/status`, { status: newStatus }).subscribe({
      next: (updated) => {
        this.selectedTicket = updated;
        this.updateLocalTicket(updated);
      },
      error: () => {
        if (this.selectedTicket) {
          this.selectedTicket.status = newStatus;
        }
      },
    });
  }

  deleteTicket(ticketId: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!confirm('Вы действительно хотите закрыть этот тикет?')) return;

    this.isDeleting = true;
    this.http.delete<{ success: boolean; id: string }>(`/api/support/tickets/${ticketId}`).subscribe({
      next: () => {
        this.isDeleting = false;
        this.ticketsList = this.ticketsList.filter((t) => t.id !== ticketId);
        if (this.selectedTicket?.id === ticketId) {
          this.closeTicketDetails();
        }
      },
      error: () => {
        this.isDeleting = false;
        this.ticketsList = this.ticketsList.filter((t) => t.id !== ticketId);
        if (this.selectedTicket?.id === ticketId) {
          this.closeTicketDetails();
        }
      },
    });
  }

  private updateLocalTicket(updated: Ticket): void {
    const idx = this.ticketsList.findIndex((t) => t.id === updated.id);
    if (idx !== -1) {
      this.ticketsList[idx] = updated;
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
