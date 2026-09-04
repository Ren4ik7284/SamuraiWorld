import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Real-time WebSocket Gateway для SamuraiWorld.
 * Клиенты подключаются через Socket.IO и получают live-события:
 *  - ticket:created      — новый тикет создан
 *  - ticket:updated      — тикет обновлён (ответ, смена статуса)
 *  - ticket:deleted      — тикет удалён
 *  - users:updated       — список пользователей изменён
 */
@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:4200',
      'http://localhost:4201',
      'https://samuraiworld.site',
      'https://www.samuraiworld.site',
      /\.vercel\.app$/,
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`[WS] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS] Client disconnected: ${client.id}`);
  }

  /** Клиент подписывается на события конкретного тикета */
  @SubscribeMessage('join_ticket')
  handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() ticketId: string,
  ) {
    client.join(`ticket:${ticketId}`);
  }

  /** Клиент отписывается от тикета */
  @SubscribeMessage('leave_ticket')
  handleLeaveTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() ticketId: string,
  ) {
    client.leave(`ticket:${ticketId}`);
  }

  // ─── Методы для отправки событий из сервисов ───────────────────────────────

  /** Оповестить всех о новом тикете */
  emitTicketCreated(ticket: any) {
    this.server.emit('ticket:created', ticket);
  }

  /** Оповестить всех об обновлении тикета (новое сообщение / смена статуса) */
  emitTicketUpdated(ticket: any) {
    this.server.emit('ticket:updated', ticket);
    // Также шлём в комнату конкретного тикета
    this.server.to(`ticket:${ticket.id}`).emit('ticket:updated', ticket);
  }

  /** Оповестить всех об удалении тикета */
  emitTicketDeleted(ticketId: string) {
    this.server.emit('ticket:deleted', { id: ticketId });
  }

  /** Оповестить всех об изменении пользователей (роль, удаление) */
  emitUsersUpdated() {
    this.server.emit('users:updated');
  }
}
