import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from '../../modules/auth/auth.service';
import { EventsGateway } from '../../gateway/events.gateway';

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

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsNotEmpty()
  nickname: string;

  @IsString()
  @IsOptional()
  contact?: string;

  @IsString()
  @IsNotEmpty()
  category: TicketCategory;

  @IsString()
  @IsOptional()
  priority?: TicketPriority;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}

export class AddMessageDto {
  @IsString()
  @IsNotEmpty()
  sender: string;

  @IsString()
  @IsOptional()
  role?: 'user' | 'support';

  @IsString()
  @IsNotEmpty()
  text: string;
}

@Injectable()
export class SupportService {
  private tickets: Ticket[] = [];
  private deletedTicketIds = new Set<string>();
  private ticketCounter = 1001;

  constructor(
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {
    this.tickets = [];
  }

  createTicket(dto: CreateTicketDto, currentUser?: JwtPayload): Ticket {
    const now = new Date().toISOString();
    const ticketId = `t-${Date.now()}`;
    const ticketNumber = `TK-${this.ticketCounter++}`;
    const nickname = currentUser?.nickname || dto.nickname;
    const userId = currentUser?.sub || dto.userId;
    const newTicket: Ticket = {
      id: ticketId,
      ticketNumber,
      userId,
      nickname,
      contact: dto.contact || 'Не указан',
      category: dto.category,
      priority: dto.priority || 'Средний',
      subject: dto.subject,
      description: dto.description,
      status: 'Ожидает ответа',
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          id: uuidv4(),
          sender: nickname,
          role: 'user',
          text: dto.description,
          timestamp: now,
        },
        {
          id: uuidv4(),
          sender: 'Система JWT',
          role: 'system',
          text: `Обращение ${ticketNumber} зарегистрировано в системе (JWT auth binding: ${nickname})`,
          timestamp: now,
        },
      ],
    };
    this.tickets.unshift(newTicket);
    console.log(`[SupportService] Ticket created: ${ticketNumber} by ${nickname} (userId: ${userId || 'anon'})`);

    // 🔴 Real-time: оповестить всех подключённых клиентов
    try { this.eventsGateway.emitTicketCreated(newTicket); } catch {}

    return newTicket;
  }

  getTickets(currentUser?: JwtPayload, query?: { nickname?: string; category?: string; status?: string }): Ticket[] {
    let result = [...this.tickets];
    if (currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'support') {
        // admin/support видит всё
      } else {
        result = result.filter(
          (t) =>
            t.userId === currentUser.sub ||
            t.nickname.toLowerCase() === currentUser.nickname.toLowerCase(),
        );
      }
    } else if (query?.nickname) {
      result = result.filter(
        (t) => t.nickname.toLowerCase() === query.nickname!.toLowerCase(),
      );
    }
    if (query?.category) {
      result = result.filter((t) => t.category === query.category);
    }
    if (query?.status) {
      result = result.filter((t) => t.status === query.status);
    }
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getTicketById(id: string, currentUser?: JwtPayload): Ticket {
    const ticket = this.tickets.find(
      (t) => t.id === id || t.ticketNumber.toLowerCase() === id.toLowerCase(),
    );
    if (!ticket) {
      throw new NotFoundException(`Тикет ${id} не найден`);
    }
    if (currentUser && currentUser.role === 'user') {
      const isOwner =
        ticket.userId === currentUser.sub ||
        ticket.nickname.toLowerCase() === currentUser.nickname.toLowerCase();
      if (!isOwner) {
        throw new ForbiddenException('У вас нет доступа к просмотру чужого тикета');
      }
    }
    return ticket;
  }

  addMessage(ticketId: string, dto: AddMessageDto, currentUser?: JwtPayload): Ticket {
    const ticket = this.getTicketById(ticketId, currentUser);
    const now = new Date().toISOString();
    const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'support';
    const senderRole = dto.role || (isStaff ? 'support' : 'user');
    const senderName = currentUser?.nickname || dto.sender;
    const newMessage: TicketMessage = {
      id: uuidv4(),
      sender: senderName,
      role: senderRole,
      text: dto.text,
      timestamp: now,
    };
    ticket.messages.push(newMessage);
    ticket.updatedAt = now;
    if (senderRole === 'support') {
      ticket.status = 'В обработке';
    } else {
      ticket.status = 'Ожидает ответа';
    }
    console.log(`[SupportService] Message added to ${ticket.ticketNumber} by ${senderName} (${senderRole})`);

    // 🔴 Real-time
    try { this.eventsGateway.emitTicketUpdated(ticket); } catch {}

    return ticket;
  }

  updateStatus(ticketId: string, status: TicketStatus, currentUser?: JwtPayload): Ticket {
    const ticket = this.getTicketById(ticketId, currentUser);
    if (currentUser && currentUser.role === 'user') {
      if (status !== 'Закрыто') {
        throw new ForbiddenException('Игрок может только закрыть свое обращение');
      }
    }
    const now = new Date().toISOString();
    ticket.status = status;
    ticket.updatedAt = now;
    ticket.messages.push({
      id: uuidv4(),
      sender: 'Система',
      role: 'system',
      text: `Статус тикета изменён на: "${status}"`,
      timestamp: now,
    });
    console.log(`[SupportService] Status updated for ${ticket.ticketNumber} -> ${status}`);

    // 🔴 Real-time
    try { this.eventsGateway.emitTicketUpdated(ticket); } catch {}

    return ticket;
  }

  deleteTicket(id: string, currentUser?: JwtPayload): { success: boolean; id: string } {
    const ticket = this.getTicketById(id, currentUser);
    if (currentUser && currentUser.role === 'user') {
      const isOwner =
        ticket.userId === currentUser.sub ||
        ticket.nickname.toLowerCase() === currentUser.nickname.toLowerCase();
      if (!isOwner) {
        throw new ForbiddenException('Вы не можете удалить чужой тикет');
      }
    }
    this.deletedTicketIds.add(id);
    if (ticket.id) this.deletedTicketIds.add(ticket.id);
    if (ticket.ticketNumber) this.deletedTicketIds.add(ticket.ticketNumber);
    const index = this.tickets.findIndex((t) => t.id === ticket.id || t.id === id);
    if (index !== -1) {
      this.tickets.splice(index, 1);
    }
    console.log(`[SupportService] Ticket deleted: ${id}`);

    // 🔴 Real-time
    try { this.eventsGateway.emitTicketDeleted(id); } catch {}

    return { success: true, id };
  }
}
