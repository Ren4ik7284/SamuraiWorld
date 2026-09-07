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
import * as crypto from 'crypto';

/**
 * Real-time WebSocket Gateway для SamuraiWorld.
 * Клиенты подключаются через Socket.IO и получают live-события:
 *  - ticket:created      — новый тикет создан
 *  - ticket:updated      — тикет обновлён (ответ, смена статуса)
 *  - ticket:deleted      — тикет удалён
 *  - users:updated       — список пользователей изменён
 *
 * Аутентификация: передайте JWT-токен в query-параметре ?token=<JWT>
 * или в заголовке Authorization: Bearer <JWT>.
 * Без токена подключение к закрытым комнатам тикетов не допускается.
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

  /** Валидирует JWT и возвращает payload или null */
  private validateJwt(token: string): Record<string, any> | null {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret || !token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [header, payload, signature] = parts;
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url');
      const sigBuf = Buffer.from(signature, 'base64url');
      const expBuf = Buffer.from(expected, 'base64url');
      if (sigBuf.length !== expBuf.length) return null;
      if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
      return decoded;
    } catch {
      return null;
    }
  }

  handleConnection(client: Socket) {
    const token: string =
      (client.handshake.query['token'] as string) ||
      (client.handshake.headers['authorization'] || '').replace(/^Bearer\s+/i, '');

    const user = this.validateJwt(token);
    if (user) {
      // Авторизованный пользователь — сохраняем данные в данных сокета
      (client as any).authenticatedUser = user;
      console.log(`[WS] Authenticated client connected: ${client.id} (user: ${user['nickname'] ?? user['sub']})`);
    } else {
      // Неавторизованный — помечаем как гостя (публичные события доступны)
      (client as any).authenticatedUser = null;
      console.log(`[WS] Guest client connected: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`[WS] Client disconnected: ${client.id}`);
  }

  /** Клиент подписывается на события конкретного тикета — требует аутентификации */
  @SubscribeMessage('join_ticket')
  handleJoinTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() ticketId: string,
  ) {
    const user = (client as any).authenticatedUser;
    if (!user) {
      client.emit('error', { message: 'Аутентификация обязательна для подписки на тикеты' });
      return;
    }
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
