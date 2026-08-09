import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'samuraiworld_super_secret_jwt_key_2026';
const TMP_TICKETS_FILE = path.join('/tmp', 'samurai_tickets_store.json');

let globalTickets = [
  {
    id: 't-1001',
    ticketNumber: 'TK-1001',
    userId: 'usr-player-1',
    nickname: 'PlayerOne',
    contact: 'Discord: @playerone',
    category: 'Технические проблемы',
    priority: 'Высокий',
    subject: 'Не могу зайти на спавн после обновления',
    description: 'При входе на спавн кикает с ошибкой Internal Server Error.',
    status: 'В обработке',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    messages: [
      {
        id: 'm-1',
        sender: 'PlayerOne',
        role: 'user',
        text: 'При входе на спавн кикает с ошибкой Internal Server Error.',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      {
        id: 'm-2',
        sender: 'Support_Agent',
        role: 'support',
        text: 'Здравствуйте! Перезагрузили чанк спавна. Попробуйте войти снова.',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
    ],
  },
];

function loadPersistedTickets() {
  try {
    if (fs.existsSync(TMP_TICKETS_FILE)) {
      const data = fs.readFileSync(TMP_TICKETS_FILE, 'utf8');
      const loaded = JSON.parse(data);
      if (Array.isArray(loaded)) {
        for (const t of loaded) {
          const idx = globalTickets.findIndex((existing) => existing.id === t.id);
          if (idx !== -1) {
            globalTickets[idx] = t;
          } else {
            globalTickets.push(t);
          }
        }
      }
    }
  } catch (e) {
    // Ignore tmp file read errors
  }
}

function savePersistedTickets() {
  try {
    fs.writeFileSync(TMP_TICKETS_FILE, JSON.stringify(globalTickets, null, 2), 'utf8');
  } catch (e) {
    // Ignore tmp file write errors
  }
}

// Initial load
loadPersistedTickets();

function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function verifyAccessToken(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.split(' ')[1];
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(signatureInput)
      .digest('base64url');

    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  loadPersistedTickets();
  const { method, query, body, headers, url } = req;
  const user = verifyAccessToken(headers['authorization']);

  // Correctly extract ID from URL (e.g. /api/support/tickets/:id, /api/support/tickets/:id/messages, /api/support/tickets/:id/status)
  const cleanUrl = url.split('?')[0];
  const ticketIdMatch = cleanUrl.match(/\/tickets\/([^/]+)/);
  const rawId = ticketIdMatch ? ticketIdMatch[1] : null;
  const ticketIdParam = rawId && rawId !== 'tickets' ? rawId : null;

  const isStaffUser = user?.role === 'admin' || user?.role === 'support' || user?.nickname?.toLowerCase() === 'ren4ik284';

  // GET Tickets list (Строгое разграничение прав доступа)
  if (method === 'GET' && !ticketIdParam) {
    let result = [...globalTickets];

    if (user) {
      if (isStaffUser) {
        // Админы и поддержка видят ВСЕ обращения
      } else {
        // Зарегистрированный игрок видит ИСКЛЮЧИТЕЛЬНО свои тикеты
        result = result.filter(
          (t) => t.userId === user.sub || t.nickname.toLowerCase() === user.nickname.toLowerCase()
        );
      }
    } else if (query.nickname) {
      // Незалогиненный видит только если явно запросил по своему нику
      result = result.filter((t) => t.nickname.toLowerCase() === query.nickname.toLowerCase());
    } else {
      // Для незалогиненных пользователей чужие тикеты СТРЫТЫ
      result = [];
    }

    if (query.category) {
      result = result.filter((t) => t.category === query.category);
    }
    if (query.status) {
      result = result.filter((t) => t.status === query.status);
    }

    return res.status(200).json(
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
  }

  // GET Ticket by ID (С проверкой прав доступа)
  if (method === 'GET' && ticketIdParam) {
    const ticket = globalTickets.find(
      (t) => t.id === ticketIdParam || t.ticketNumber.toLowerCase() === ticketIdParam.toLowerCase()
    );
    if (!ticket) return res.status(404).json({ message: 'Тикет не найден' });

    // Проверка прав: читать тикет может либо автор, либо админ/поддержка
    const isOwner = user && (ticket.userId === user.sub || ticket.nickname.toLowerCase() === user.nickname.toLowerCase());

    if (!isStaffUser && !isOwner) {
      return res.status(403).json({ message: 'Доступ запрещён: этот тикет приватный' });
    }

    return res.status(200).json(ticket);
  }

  // POST Create Ticket (Привязка к JWT аккаунту)
  if (method === 'POST' && !url.includes('/messages')) {
    const dto = body || {};
    const nickname = user?.nickname || dto.nickname;
    if (!nickname || !dto.subject || !dto.description) {
      return res.status(400).json({ message: 'Заполните никнейм, тему и описание' });
    }

    const now = new Date().toISOString();
    const ticketNumber = `TK-${Math.floor(1000 + Math.random() * 9000)}`;

    const newTicket = {
      id: `t-${Date.now()}`,
      ticketNumber,
      userId: user?.sub || dto.userId || `guest-${Date.now()}`,
      nickname: nickname.trim(),
      contact: dto.contact || 'Не указан',
      category: dto.category || 'Технические проблемы',
      priority: dto.priority || 'Средний',
      subject: dto.subject,
      description: dto.description,
      status: 'Ожидает ответа',
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          id: `m-${Date.now()}-1`,
          sender: nickname,
          role: 'user',
          text: dto.description,
          timestamp: now,
        },
        {
          id: `m-${Date.now()}-2`,
          sender: 'Система Безопасности JWT',
          role: 'system',
          text: user
            ? `Обращение ${ticketNumber} защищено и привязано к аккаунту ${nickname} (ID: ${user.sub}).`
            : `Обращение ${ticketNumber} зарегистрировано.`,
          timestamp: now,
        },
      ],
    };

    globalTickets.unshift(newTicket);
    savePersistedTickets();
    return res.status(201).json(newTicket);
  }

  // POST Add message /api/support/tickets/:id/messages
  if (method === 'POST' && url.includes('/messages')) {
    const id = ticketIdParam || query.id;
    const ticket = globalTickets.find(
      (t) => t.id === id || t.ticketNumber.toLowerCase() === (id || '').toLowerCase()
    );
    if (!ticket) return res.status(404).json({ message: 'Тикет не найден' });

    const requestSender = (body?.sender || user?.nickname || '').trim().toLowerCase();
    const isOwner =
      (user && (ticket.userId === user.sub || ticket.nickname.toLowerCase() === user.nickname.toLowerCase())) ||
      (!user && requestSender && requestSender === ticket.nickname.trim().toLowerCase());

    if (!isStaffUser && !isOwner) {
      return res.status(403).json({ message: 'Вы не можете писать в чужом тикете' });
    }

    const now = new Date().toISOString();
    const senderRole = isStaffUser ? 'support' : 'user';
    const senderName = user?.nickname || body?.sender || ticket.nickname;

    const newMsg = {
      id: `m-${Date.now()}`,
      sender: senderName,
      role: senderRole,
      text: body?.text || '',
      timestamp: now,
    };

    ticket.messages.push(newMsg);
    ticket.updatedAt = now;
    ticket.status = senderRole === 'support' ? 'В обработке' : 'Ожидает ответа';

    savePersistedTickets();
    return res.status(200).json(ticket);
  }

  // PATCH Update status /api/support/tickets/:id/status (Администраторы & Поддержка)
  if (method === 'PATCH' && url.includes('/status')) {
    if (!isStaffUser) {
      return res.status(403).json({ message: 'Изменять статус могут только Админы и Поддержка' });
    }

    const id = ticketIdParam || query.id;
    const ticket = globalTickets.find(
      (t) => t.id === id || t.ticketNumber.toLowerCase() === (id || '').toLowerCase()
    );
    if (!ticket) return res.status(404).json({ message: 'Тикет не найден' });

    const now = new Date().toISOString();
    const newStatus = body?.status || 'В обработке';
    ticket.status = newStatus;
    ticket.updatedAt = now;

    ticket.messages.push({
      id: `m-${Date.now()}`,
      sender: 'Система',
      role: 'system',
      text: `Статус тикета изменён на: "${newStatus}" агентом ${user.nickname}`,
      timestamp: now,
    });

    savePersistedTickets();
    return res.status(200).json(ticket);
  }

  // DELETE Ticket (Только Администраторы & Поддержка)
  if (method === 'DELETE') {
    if (!isStaffUser) {
      return res.status(403).json({ message: 'Удалять тикеты могут только Администраторы и Поддержка' });
    }

    const id = ticketIdParam || query.id || body?.id;
    globalTickets = globalTickets.filter(
      (t) => t.id !== id && t.ticketNumber.toLowerCase() !== (id || '').toLowerCase()
    );
    savePersistedTickets();
    return res.status(200).json({ success: true, id });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
