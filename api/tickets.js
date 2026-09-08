import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { checkRateLimit } from './security.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('[tickets.js] КРИТИЧНО: JWT_SECRET не задан в Vercel Environment Variables!');
}

const TMP_TICKETS_FILE = path.join('/tmp', 'samurai_tickets_store.json');
let globalTickets = [];
let globalDeletedTicketIds = new Set();
const CLOUD_TICKETS_DB_URL = 'https://api.restful-api.dev/objects/ff8081819ff5b11001a023f7f7486be0';

function getMasterAdmins() {
  if (process.env.MASTER_ADMINS) {
    return process.env.MASTER_ADMINS.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
  }
  return ['ren4ik284', 'mydaf0n62'];
}

function isStaff(user) {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'support') return true;
  return getMasterAdmins().includes((user.nickname || '').toLowerCase());
}

async function fetchCloudTickets() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(CLOUD_TICKETS_DB_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.data && Array.isArray(json.data.tickets)) {
        if (Array.isArray(json.data.deletedTicketIds)) {
          for (const dId of json.data.deletedTicketIds) {
            if (dId) globalDeletedTicketIds.add(String(dId));
          }
        }
        for (const t of json.data.tickets) {
          if (!t || !t.id) continue;
          if (globalDeletedTicketIds.has(t.id) || (t.ticketNumber && globalDeletedTicketIds.has(t.ticketNumber))) {
            continue;
          }
          if (['playerone', 'support_agent', 'admin_samurai'].includes(t.nickname?.toLowerCase())) {
            continue;
          }
          const idx = globalTickets.findIndex((existing) => existing.id === t.id);
          if (idx !== -1) {
            const existingMsgs = globalTickets[idx].messages || [];
            const cloudMsgs = t.messages || [];
            const msgMap = new Map();
            for (const m of existingMsgs) if (m && m.id) msgMap.set(m.id, m);
            for (const m of cloudMsgs) if (m && m.id) msgMap.set(m.id, m);
            globalTickets[idx] = {
              ...t,
              ...globalTickets[idx],
              status:
                t.updatedAt && new Date(t.updatedAt) > new Date(globalTickets[idx].updatedAt || 0)
                  ? t.status
                  : globalTickets[idx].status,
              messages: Array.from(msgMap.values()).sort(
                (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
              ),
            };
          } else {
            globalTickets.push(t);
          }
        }
      }
    }
  } catch (e) {}
}

async function saveCloudTickets() {
  try {
    const safeTickets = globalTickets.filter(
      (t) => t && t.id && !globalDeletedTicketIds.has(t.id) && !globalDeletedTicketIds.has(t.ticketNumber)
    );
    await fetch(CLOUD_TICKETS_DB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'samurai_tickets_db',
        data: {
          tickets: safeTickets,
          deletedTicketIds: Array.from(globalDeletedTicketIds),
        },
      }),
    });
  } catch (e) {}
}

function loadPersistedTickets() {
  try {
    if (fs.existsSync(TMP_TICKETS_FILE)) {
      const data = fs.readFileSync(TMP_TICKETS_FILE, 'utf8');
      const loaded = JSON.parse(data);
      if (loaded && typeof loaded === 'object') {
        const ticketList = Array.isArray(loaded) ? loaded : loaded.tickets || [];
        const deletedArr = Array.isArray(loaded.deletedTicketIds) ? loaded.deletedTicketIds : [];
        for (const dId of deletedArr) {
          if (dId) globalDeletedTicketIds.add(String(dId));
        }
        for (const t of ticketList) {
          if (!t || !t.id) continue;
          if (globalDeletedTicketIds.has(t.id) || (t.ticketNumber && globalDeletedTicketIds.has(t.ticketNumber))) {
            continue;
          }
          if (['playerone', 'support_agent', 'admin_samurai'].includes(t.nickname?.toLowerCase())) {
            continue;
          }
          const idx = globalTickets.findIndex((existing) => existing.id === t.id);
          if (idx !== -1) {
            globalTickets[idx] = t;
          } else {
            globalTickets.push(t);
          }
        }
      }
    }
  } catch (e) {}
  globalTickets = globalTickets.filter(
    (t) =>
      t &&
      t.id &&
      !globalDeletedTicketIds.has(t.id) &&
      !globalDeletedTicketIds.has(t.ticketNumber) &&
      !['playerone', 'support_agent', 'admin_samurai'].includes(t.nickname?.toLowerCase())
  );
}

function savePersistedTickets() {
  try {
    const payload = {
      tickets: globalTickets.filter(
        (t) => t && t.id && !globalDeletedTicketIds.has(t.id) && !globalDeletedTicketIds.has(t.ticketNumber)
      ),
      deletedTicketIds: Array.from(globalDeletedTicketIds),
    };
    fs.writeFileSync(TMP_TICKETS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {}
  saveCloudTickets().catch(() => {});
}

loadPersistedTickets();
fetchCloudTickets().catch(() => {});

function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function verifyAccessToken(authHeader) {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const token = parts[1];
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = tokenParts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest('base64url');
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
  if (parsedBody && (parsedBody.ticketId || parsedBody.id || parsedBody.ticketContext?.id)) {
    const bId = String(parsedBody.ticketId || parsedBody.id || parsedBody.ticketContext?.id).trim();
    if (bId && !['tickets', 'messages', 'status', 'sync'].includes(bId.toLowerCase())) {
      return bId;
    }
  }
  if (req.query) {
    const queryVals = Object.values(req.query).flatMap((v) => (Array.isArray(v) ? v : [String(v)]));
    for (const val of queryVals) {
      const parts = String(val).split('/');
      for (const p of parts) {
        if (
          p &&
          !['tickets', 'messages', 'status', 'sync', 'api', 'support', 'undefined', 'null'].includes(p.toLowerCase())
        ) {
          return p;
        }
      }
    }
  }
  const decodedUrl = decodeURIComponent(req.url || '');
  const parts = decodedUrl.split('?')[0].split('/').filter(Boolean);
  for (const p of parts) {
    if (
      p &&
      !['tickets', 'messages', 'status', 'sync', 'api', 'support', 'tickets.js'].includes(p.toLowerCase())
    ) {
      return p;
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (!checkRateLimit(req, res, req.method !== 'GET')) return;
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
  await fetchCloudTickets();
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
  const user = verifyAccessToken(headers['authorization'] || headers['Authorization']);
  const ticketIdParam = extractTicketId(req, body);
  const fullUrlAndQuery = (url || '') + ' ' + JSON.stringify(query);
  const isMessagesReq = fullUrlAndQuery.includes('messages');
  const isStatusReq = fullUrlAndQuery.includes('status');
  const isSyncReq = fullUrlAndQuery.includes('sync');
  const isStaffUser = isStaff(user);

  // GET /api/tickets — Список тикетов
  if (method === 'GET' && !ticketIdParam) {
    if (!user) {
      return res.status(401).json({ message: 'Необходима авторизация для просмотра обращений' });
    }
    let result = [...globalTickets];
    if (!isStaffUser) {
      const userNick = (user.nickname || '').toLowerCase();
      result = result.filter(
        (t) => (t.userId && t.userId === user.sub) || (t.nickname && t.nickname.toLowerCase() === userNick)
      );
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

  // GET /api/tickets/:id — Просмотр конкретного тикета
  if (method === 'GET' && ticketIdParam) {
    if (!user) {
      return res.status(401).json({ message: 'Необходима авторизация для просмотра обращения' });
    }
    const ticket = globalTickets.find(
      (t) => t.id === ticketIdParam || (t.ticketNumber && t.ticketNumber.toLowerCase() === ticketIdParam.toLowerCase())
    );
    if (!ticket) {
      return res.status(404).json({ message: 'Тикет не найден' });
    }
    if (!isStaffUser) {
      const userNick = (user.nickname || '').toLowerCase();
      const isOwner = (ticket.userId && ticket.userId === user.sub) || (ticket.nickname && ticket.nickname.toLowerCase() === userNick);
      if (!isOwner) {
        return res.status(403).json({ message: 'У вас нет доступа к чужому тикету' });
      }
    }
    return res.status(200).json(ticket);
  }

  // POST /api/tickets/sync — Синхронизация (только Staff)
  if (method === 'POST' && isSyncReq) {
    if (!isStaffUser) {
      return res.status(403).json({ message: 'Синхронизация тикетов доступна только сотрудникам поддержки' });
    }
    const clientTickets = Array.isArray(body?.tickets) ? body.tickets : [];
    for (const ct of clientTickets) {
      if (ct && ct.id && ct.nickname && ct.subject) {
        if (globalDeletedTicketIds.has(ct.id) || (ct.ticketNumber && globalDeletedTicketIds.has(ct.ticketNumber))) {
          continue;
        }
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
    const result = globalTickets.filter(
      (t) => !globalDeletedTicketIds.has(t.id) && (!t.ticketNumber || !globalDeletedTicketIds.has(t.ticketNumber))
    );
    return res.status(200).json(
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
  }

  // POST /api/tickets — Создание нового тикета
  if (method === 'POST' && !isMessagesReq && !isSyncReq) {
    if (!user) {
      return res.status(401).json({ message: 'Необходима авторизация для создания обращения' });
    }
    const dto = body || {};
    if (!dto.subject || !dto.description || typeof dto.subject !== 'string' || typeof dto.description !== 'string') {
      return res.status(400).json({ message: 'Заполните тему и описание обращения' });
    }
    const cleanSubject = dto.subject.trim().slice(0, 150);
    const cleanDescription = dto.description.trim().slice(0, 3000);
    if (!cleanSubject || !cleanDescription) {
      return res.status(400).json({ message: 'Тема и описание не могут быть пустыми' });
    }
    const now = new Date().toISOString();
    const ticketNumber = `TK-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket = {
      id: `t-${Date.now()}`,
      ticketNumber,
      userId: user.sub,
      nickname: user.nickname,
      contact: typeof dto.contact === 'string' ? dto.contact.trim().slice(0, 100) : 'Не указан',
      category: typeof dto.category === 'string' ? dto.category.trim().slice(0, 50) : 'Технические проблемы',
      priority: isStaffUser && dto.priority ? String(dto.priority).slice(0, 20) : 'Средний',
      subject: cleanSubject,
      description: cleanDescription,
      status: 'Ожидает ответа',
      createdAt: now,
      updatedAt: now,
      messages: [
        {
          id: `m-${Date.now()}-1`,
          sender: user.nickname,
          role: 'user',
          text: cleanDescription,
          timestamp: now,
        },
        {
          id: `m-${Date.now()}-2`,
          sender: 'Система',
          role: 'system',
          text: `Обращение ${ticketNumber} создано и привязано к аккаунту ${user.nickname}.`,
          timestamp: now,
        },
      ],
    };
    globalTickets.unshift(newTicket);
    savePersistedTickets();
    return res.status(201).json(newTicket);
  }

  // POST /api/tickets/messages — Отправка сообщения в тикет
  if (method === 'POST' && isMessagesReq) {
    if (!user) {
      return res.status(401).json({ message: 'Необходима авторизация для отправки сообщений' });
    }
    const id = ticketIdParam || query.id || body?.ticketId || body?.id;
    const ticket = globalTickets.find(
      (t) => t.id === id || (t.ticketNumber && t.ticketNumber.toLowerCase() === (id || '').toLowerCase())
    );
    if (!ticket) {
      return res.status(404).json({ message: 'Тикет не найден' });
    }
    if (!isStaffUser) {
      const userNick = (user.nickname || '').toLowerCase();
      const isOwner = (ticket.userId && ticket.userId === user.sub) || (ticket.nickname && ticket.nickname.toLowerCase() === userNick);
      if (!isOwner) {
        return res.status(403).json({ message: 'У вас нет доступа к чужому тикету' });
      }
    }
    const rawText = (body?.text || '').trim();
    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ message: 'Текст сообщения не может быть пустым' });
    }
    const text = rawText.slice(0, 3000);
    const now = new Date().toISOString();
    const senderRole = isStaffUser ? 'support' : 'user';
    const senderName = user.nickname;
    const newMsg = {
      id: `m-${Date.now()}`,
      sender: senderName,
      role: senderRole,
      text,
      timestamp: now,
    };
    ticket.messages.push(newMsg);
    ticket.updatedAt = now;
    ticket.status = senderRole === 'support' ? 'В обработке' : 'Ожидает ответа';
    savePersistedTickets();
    return res.status(200).json(ticket);
  }

  // PATCH /api/tickets/status — Изменение статуса тикета (только Staff)
  if (method === 'PATCH' && isStatusReq) {
    if (!isStaffUser) {
      return res.status(403).json({ message: 'Изменение статуса тикета разрешено только Администраторам и Поддержке!' });
    }
    const id = ticketIdParam || query.id || body?.ticketId || body?.id;
    const ticket = globalTickets.find(
      (t) => t.id === id || (t.ticketNumber && t.ticketNumber.toLowerCase() === (id || '').toLowerCase())
    );
    if (!ticket) {
      return res.status(404).json({ message: 'Тикет не найден' });
    }
    const allowedStatuses = [
      'Ожидает ответа', 'Нерешенные',
      'В обработке', 'В работе',
      'Решен', 'Решено', 'Выполненные',
      'Закрыт', 'Закрыто'
    ];
    let newStatus = body?.status;
    if (!newStatus || !allowedStatuses.includes(newStatus)) {
      newStatus = 'В обработке';
    }
    const now = new Date().toISOString();
    ticket.status = newStatus;
    ticket.updatedAt = now;
    ticket.messages.push({
      id: `m-${Date.now()}`,
      sender: 'Система',
      role: 'system',
      text: `Статус тикета изменён на: "${newStatus}" сотрудником ${user.nickname}`,
      timestamp: now,
    });
    savePersistedTickets();
    return res.status(200).json(ticket);
  }

  // DELETE /api/tickets/:id — Удаление тикета (только Staff)
  if (method === 'DELETE') {
    if (!isStaffUser) {
      return res.status(403).json({ message: 'Удаление тикетов разрешено только Администраторам!' });
    }
    const id = ticketIdParam || query.id || body?.id;
    if (id) {
      const target = globalTickets.find(
        (t) => t.id === id || (t.ticketNumber && t.ticketNumber.toLowerCase() === String(id).toLowerCase())
      );
      if (target) {
        globalDeletedTicketIds.add(target.id);
        if (target.ticketNumber) globalDeletedTicketIds.add(target.ticketNumber);
      }
      globalDeletedTicketIds.add(String(id));
      globalTickets = globalTickets.filter(
        (t) => t.id !== id && (!t.ticketNumber || t.ticketNumber.toLowerCase() !== String(id).toLowerCase())
      );
      savePersistedTickets();
    }
    return res.status(200).json({ success: true, id });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
