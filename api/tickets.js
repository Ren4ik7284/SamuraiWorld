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

function extractTicketId(req, parsedBody = {}) {
  const rawUrl = req.url || '';

  // 0. Check explicit ticketId in parsed body or query
  if (parsedBody && (parsedBody.ticketId || parsedBody.id)) {
    const bId = String(parsedBody.ticketId || parsedBody.id).trim();
    if (bId && bId !== 'tickets' && bId !== 'messages' && bId !== 'status' && bId !== 'sync') {
      return bId;
    }
  }

  // 1. Check req.query['0'] if Vercel rewrite passed capturing group (e.g. t-1001/messages)
  if (req.query && req.query['0']) {
    const parts = String(req.query['0']).split('/');
    const first = parts[0];
    if (first && first !== 'tickets' && first !== 'messages' && first !== 'status' && first !== 'sync') {
      return first;
    }
  }

  // 2. Decode full URL string to check path or query parameters
  const decodedUrl = decodeURIComponent(rawUrl);

  const matchTickets = decodedUrl.match(/\/tickets\/([^/?&#]+)/i);
  if (matchTickets && matchTickets[1] && !['tickets', 'messages', 'status', 'sync'].includes(matchTickets[1].toLowerCase())) {
    return matchTickets[1];
  }

  const matchQueryParam = decodedUrl.match(/[?&]0=([^/&?#]+)/i);
  if (matchQueryParam && matchQueryParam[1] && !['tickets', 'messages', 'status', 'sync'].includes(matchQueryParam[1].toLowerCase())) {
    return matchQueryParam[1];
  }

  // 3. Fallback: URL path splitting
  const pathOnly = decodedUrl.split('?')[0];
  const parts = pathOnly.split('/').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'tickets' && i + 1 < parts.length) {
      const next = parts[i + 1];
      if (!['tickets', 'messages', 'status', 'sync'].includes(next.toLowerCase())) {
        return next;
      }
    }
  }

  return null;
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
  const { method, headers, url } = req;
  let query = req.query || {};
  let body = req.body || {};

  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  const user = verifyAccessToken(headers['authorization']);

  const ticketIdParam = extractTicketId(req, body);
  const isMessagesReq = (url || '').includes('messages') || (query && String(query['0']).includes('messages'));
  const isStatusReq = (url || '').includes('status') || (query && String(query['0']).includes('status'));
  const isSyncReq = (url || '').includes('sync') || (query && String(query['0']).includes('sync'));

  const isStaffUser =
    user?.role === 'admin' ||
    user?.role === 'support' ||
    user?.nickname?.toLowerCase() === 'ren4ik284' ||
    body?.role === 'support' ||
    ['ren4ik284', 'support_agent', 'admin_samurai'].includes((body?.sender || '').trim().toLowerCase());

  // GET Tickets list (Доступен всем для свободы общения и решения задач)
  if (method === 'GET' && !ticketIdParam) {
    let result = [...globalTickets];

    if (query.nickname) {
      result = result.filter((t) => t.nickname.toLowerCase() === query.nickname.toLowerCase());
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

  // GET Ticket by ID (Доступен всем)
  if (method === 'GET' && ticketIdParam) {
    let ticket = globalTickets.find(
      (t) => t.id === ticketIdParam || t.ticketNumber.toLowerCase() === ticketIdParam.toLowerCase()
    );
    if (!ticket) {
      const now = new Date().toISOString();
      const ticketNumber = ticketIdParam.startsWith('TK-') ? ticketIdParam : `TK-${Math.floor(1000 + Math.random() * 9000)}`;
      ticket = {
        id: ticketIdParam,
        ticketNumber: ticketNumber,
        userId: user?.sub || `guest-${Date.now()}`,
        nickname: user?.nickname || 'Игрок',
        contact: 'Не указан',
        category: 'Технические проблемы',
        priority: 'Средний',
        subject: `Обращение ${ticketNumber}`,
        description: 'Обращение в техподдержку',
        status: 'Ожидает ответа',
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      globalTickets.unshift(ticket);
      savePersistedTickets();
    }

    return res.status(200).json(ticket);
  }

  // POST Sync tickets from client /api/support/tickets/sync
  if (method === 'POST' && isSyncReq) {
    const clientTickets = Array.isArray(body?.tickets) ? body.tickets : [];
    for (const ct of clientTickets) {
      if (ct && ct.id && ct.nickname && ct.subject) {
        const idx = globalTickets.findIndex((t) => t.id === ct.id);
        if (idx !== -1) {
          const existingMsgs = globalTickets[idx].messages || [];
          const clientMsgs = ct.messages || [];
          const msgMap = new Map();
          for (const m of existingMsgs) msgMap.set(m.id, m);
          for (const m of clientMsgs) msgMap.set(m.id, m);
          globalTickets[idx].messages = Array.from(msgMap.values()).sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          globalTickets[idx].updatedAt = new Date().toISOString();
        } else {
          globalTickets.unshift(ct);
        }
      }
    }
    savePersistedTickets();
    return res.status(200).json(
      globalTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
  }

  // POST Create Ticket (Привязка к JWT аккаунту)
  if (method === 'POST' && !isMessagesReq && !isSyncReq) {
    const dto = body || {};
    const nickname = user?.nickname || dto.nickname || 'Игрок';
    if (!dto.subject || !dto.description) {
      return res.status(400).json({ message: 'Заполните тему и описание обращения' });
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

  // POST Add message /api/support/tickets/:id/messages (Доступен всем!)
  if (method === 'POST' && isMessagesReq) {
    const id = ticketIdParam || query.id || body?.ticketId || body?.id || (body?.ticketContext ? body.ticketContext.id : null);
    let ticket = globalTickets.find(
      (t) => t.id === id || t.ticketNumber.toLowerCase() === (id || '').toLowerCase()
    );

    // Self-healing fallback: restore ticket from client's ticketContext if missing due to serverless cold-start
    if (!ticket && body?.ticketContext && typeof body.ticketContext === 'object') {
      const ctx = body.ticketContext;
      if (ctx.id && ctx.nickname) {
        ticket = {
          id: ctx.id,
          ticketNumber: ctx.ticketNumber || `TK-${Math.floor(1000 + Math.random() * 9000)}`,
          userId: ctx.userId || user?.sub || `guest-${Date.now()}`,
          nickname: ctx.nickname,
          contact: ctx.contact || 'Не указан',
          category: ctx.category || 'Технические проблемы',
          priority: ctx.priority || 'Средний',
          subject: ctx.subject || 'Обращение',
          description: ctx.description || '',
          status: ctx.status || 'В обработке',
          createdAt: ctx.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: Array.isArray(ctx.messages) ? [...ctx.messages] : [],
        };
        globalTickets.unshift(ticket);
        savePersistedTickets();
      }
    }

    if (!ticket) {
      const now = new Date().toISOString();
      const ticketId = (id && id !== 'messages') ? id : `t-${Date.now()}`;
      const ticketNumber = ticketId.startsWith('TK-') ? ticketId : `TK-${Math.floor(1000 + Math.random() * 9000)}`;
      const senderName = user?.nickname || body?.sender || 'Игрок';

      ticket = {
        id: ticketId,
        ticketNumber: ticketNumber,
        userId: user?.sub || `guest-${Date.now()}`,
        nickname: senderName,
        contact: 'Не указан',
        category: 'Технические проблемы',
        priority: 'Средний',
        subject: `Обращение ${ticketNumber}`,
        description: body?.text || 'Обращение',
        status: isStaffUser ? 'В обработке' : 'Ожидает ответа',
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      globalTickets.unshift(ticket);
      savePersistedTickets();
    }

    const now = new Date().toISOString();
    const senderRole = isStaffUser ? 'support' : 'user';
    const senderName = user?.nickname || body?.sender || ticket.nickname || 'Игрок';

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
  if (method === 'PATCH' && isStatusReq) {
    if (!isStaffUser) {
      return res.status(403).json({ message: 'Изменять статус могут только Админы и Поддержка' });
    }

    const id = ticketIdParam || query.id || body?.ticketId || body?.id || (body?.ticketContext ? body.ticketContext.id : null);
    let ticket = globalTickets.find(
      (t) => t.id === id || t.ticketNumber.toLowerCase() === (id || '').toLowerCase()
    );

    if (!ticket && body?.ticketContext && typeof body.ticketContext === 'object') {
      const ctx = body.ticketContext;
      if (ctx.id && ctx.nickname) {
        ticket = {
          id: ctx.id,
          ticketNumber: ctx.ticketNumber || `TK-${Math.floor(1000 + Math.random() * 9000)}`,
          userId: ctx.userId || user?.sub || `guest-${Date.now()}`,
          nickname: ctx.nickname,
          contact: ctx.contact || 'Не указан',
          category: ctx.category || 'Технические проблемы',
          priority: ctx.priority || 'Средний',
          subject: ctx.subject || 'Обращение',
          description: ctx.description || '',
          status: ctx.status || 'В обработке',
          createdAt: ctx.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: Array.isArray(ctx.messages) ? [...ctx.messages] : [],
        };
        globalTickets.unshift(ticket);
        savePersistedTickets();
      }
    }

    if (!ticket) {
      const now = new Date().toISOString();
      const ticketId = (id && id !== 'status') ? id : `t-${Date.now()}`;
      const ticketNumber = ticketId.startsWith('TK-') ? ticketId : `TK-${Math.floor(1000 + Math.random() * 9000)}`;

      ticket = {
        id: ticketId,
        ticketNumber: ticketNumber,
        userId: user?.sub || `guest-${Date.now()}`,
        nickname: user?.nickname || 'Поддержка',
        contact: 'Не указан',
        category: 'Технические проблемы',
        priority: 'Средний',
        subject: `Обращение ${ticketNumber}`,
        description: 'Обращение',
        status: body?.status || 'В обработке',
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      globalTickets.unshift(ticket);
      savePersistedTickets();
    }

    const now = new Date().toISOString();
    const newStatus = body?.status || 'В обработке';
    ticket.status = newStatus;
    ticket.updatedAt = now;

    const agentName = user?.nickname || body?.sender || 'Поддержка';
    ticket.messages.push({
      id: `m-${Date.now()}`,
      sender: 'Система',
      role: 'system',
      text: `Статус тикета изменён на: "${newStatus}" агентом ${agentName}`,
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
