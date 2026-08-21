import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface WsTicketEvent {
  type: 'created' | 'updated' | 'deleted';
  data: any;
}

/**
 * Real-time WebSocket сервис на базе Socket.IO.
 * Автоматически подключается к бэкенду и расшаривает события тикетов.
 *
 * Использование:
 *   this.wsService.ticketEvents$.subscribe(event => { ... })
 */
@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly _connected$ = new BehaviorSubject<boolean>(false);
  private readonly _ticketCreated$ = new Subject<any>();
  private readonly _ticketUpdated$ = new Subject<any>();
  private readonly _ticketDeleted$ = new Subject<{ id: string }>();
  private readonly _usersUpdated$ = new Subject<void>();

  public readonly connected$ = this._connected$.asObservable();
  public readonly ticketCreated$ = this._ticketCreated$.asObservable();
  public readonly ticketUpdated$ = this._ticketUpdated$.asObservable();
  public readonly ticketDeleted$ = this._ticketDeleted$.asObservable();
  public readonly usersUpdated$ = this._usersUpdated$.asObservable();

  /** Возвращает текущее состояние подключения */
  get isConnected(): boolean {
    return this._connected$.value;
  }

  connect(serverUrl?: string): void {
    if (this.socket?.connected) return;

    // Определяем URL: в dev — ws://localhost:3000, в prod — текущий origin
    const url = serverUrl || (typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:3000');

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[WS] Connected:', this.socket?.id);
      this._connected$.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
      this._connected$.next(false);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[WS] Connection error:', err.message);
      this._connected$.next(false);
    });

    // ── Ticket events ────────────────────────────────────────────────────────
    this.socket.on('ticket:created', (data: any) => {
      this._ticketCreated$.next(data);
    });

    this.socket.on('ticket:updated', (data: any) => {
      this._ticketUpdated$.next(data);
    });

    this.socket.on('ticket:deleted', (data: { id: string }) => {
      this._ticketDeleted$.next(data);
    });

    // ── User events ──────────────────────────────────────────────────────────
    this.socket.on('users:updated', () => {
      this._usersUpdated$.next();
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this._connected$.next(false);
    }
  }

  /** Подписаться на события конкретного тикета (room) */
  joinTicket(ticketId: string): void {
    this.socket?.emit('join_ticket', ticketId);
  }

  /** Отписаться от конкретного тикета */
  leaveTicket(ticketId: string): void {
    this.socket?.emit('leave_ticket', ticketId);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
