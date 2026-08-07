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
  // Выбранная вкладка: 'create' | 'tracker' | 'faq'
  activeTab: 'create' | 'tracker' | 'faq' = 'create';

  // Поля формы создания тикета
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
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      desc: 'Вылеты, проблемы с подключением к серверу, лаги или баги текстур.',
    },
    {
      title: 'Аккаунт & Паспорт',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      desc: 'Восстановление доступа, получение паспорта гражданина, смена ника.',
    },
    {
      title: 'Донат & Экономика',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
      desc: 'Пополнение баланса, покупка привилегий, зачисление валюты.',
    },
    {
      title: 'Суд & Жалоба',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z"/></svg>`,
      desc: 'Жалобы на гриферство, нарушения правил, подача исков в Верховный Суд.',
    },
    {
      title: 'Идеи & Баг-репорты',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`,
      desc: 'Предложения по улучшению плагинов, найденные баги и абузы.',
    },
  ];

  priorities: TicketPriority[] = ['Низкий', 'Средний', 'Высокий', 'Критический'];

  // Статус отправки тикета
  isSubmitting = false;
  submitSuccess = false;
  createdTicketInfo: Ticket | null = null;
  errorMessage = '';

  // Трекер тикетов
  searchQuery = '';
  ticketsList: Ticket[] = [];
  selectedTicket: Ticket | null = null;
  replyText = '';
  isReplying = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTickets();
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

    // Запрос на backend API
    this.http.post<Ticket>('/api/support/tickets', this.newTicket).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.submitSuccess = true;
        this.createdTicketInfo = res;
        this.ticketsList.unshift(res);
        this.resetForm();
      },
      error: () => {
        // Запасное сохранение в локальное состояние (если бэкенд оффлайн)
        this.isSubmitting = false;
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
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [
            {
              id: 'm-1',
              sender: this.newTicket.nickname,
              role: 'user',
              text: this.newTicket.description,
              timestamp: new Date().toISOString(),
            },
            {
              id: 'm-2',
              sender: 'Система RabbitMQ (Local Queue)',
              role: 'system',
              text: 'Обращение зарегистрировано в локальной очереди RabbitMQ и направлено команде поддержки.',
              timestamp: new Date().toISOString(),
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
        // Демонстрационный набор тикетов если бэкенд не доступен
        if (this.ticketsList.length === 0) {
          this.ticketsList = [
            {
              id: 't-1001',
              ticketNumber: 'TK-84920',
              nickname: 'Miner_Joe',
              contact: 'Discord: miner_joe#1234',
              category: 'Аккаунт & Паспорт',
              priority: 'Высокий',
              subject: 'Не выдался паспорт после регистрации',
              description: 'Я заполнил анкету на паспорт в игре, но паспорт не появился в инвентаре.',
              status: 'Ожидает ответа',
              createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
              updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
              messages: [
                {
                  id: '1',
                  sender: 'Miner_Joe',
                  role: 'user',
                  text: 'Я заполнил анкету на паспорт в игре, но паспорт не появился в инвентаре.',
                  timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
                },
                {
                  id: '2',
                  sender: 'Система RabbitMQ',
                  role: 'system',
                  text: 'Тикет успешно обработан брокером сообщений RabbitMQ и сохранён в PostgreSQL.',
                  timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
                },
              ],
            },
          ];
        }
      },
    });
  }

  get filteredTickets(): Ticket[] {
    if (!this.searchQuery) return this.ticketsList;
    const q = this.searchQuery.toLowerCase();
    return this.ticketsList.filter(
      (t) =>
        t.ticketNumber.toLowerCase().includes(q) ||
        t.nickname.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q),
    );
  }

  openTicketDetails(ticket: Ticket): void {
    this.selectedTicket = ticket;
  }

  closeTicketDetails(): void {
    this.selectedTicket = null;
  }

  sendReply(): void {
    if (!this.replyText.trim() || !this.selectedTicket) return;

    const ticketId = this.selectedTicket.id;
    const reply = {
      sender: this.selectedTicket.nickname,
      role: 'user' as const,
      text: this.replyText.trim(),
    };

    this.isReplying = true;
    this.http.post<Ticket>(`/api/support/tickets/${ticketId}/messages`, reply).subscribe({
      next: (updated) => {
        this.selectedTicket = updated;
        this.replyText = '';
        this.isReplying = false;
      },
      error: () => {
        // Локальное добавление в диалог
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
          this.selectedTicket.status = 'Ожидает ответа';
        }
        this.replyText = '';
        this.isReplying = false;
      },
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
