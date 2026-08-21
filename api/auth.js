import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
const JWT_SECRET = process.env.JWT_SECRET || 'samuraiworld_super_secret_jwt_key_2026';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'samuraiworld_super_secret_refresh_key_2026';
const TMP_USERS_FILE = path.join('/tmp', 'samurai_users_store.json');
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.03-4.84-2.6.03-1.61 3.22-2.4 4.84-2.4 1.61 0 4.81.79 4.84 2.4C15.8 18.97 14.03 20 12 20z"/></svg>';
function hashPassword(password) {
  const salt = 'samurai_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}
function base64urlEncode(str) {
  return Buffer.from(str).toString('base64url');
}
function base64urlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

const verificationCodes = new Map();

let users = [
  {
    id: 'usr-ren4ik284-admin',
    nickname: 'Ren4ik284',
    email: 'ren4ik284@samuraiworld.ru',
    passwordHash: hashPassword('bebra228'),
    plainPassword: 'bebra228',
    role: 'admin',
    avatarUrl: DEFAULT_AVATAR,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLogin: '2026-08-10T12:00:00.000Z',
  },
];
const CLOUD_DB_URL = 'https://api.restful-api.dev/objects/ff8081819ff5b11001a00a9e7d362c35';

async function fetchCloudUsers() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(CLOUD_DB_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.data && Array.isArray(json.data.users)) {
        for (const u of json.data.users) {
          if (!u || !u.nickname) continue;
          const cleanNick = u.nickname.toLowerCase();
          if (['admin_samurai', 'support_agent', 'playerone'].includes(cleanNick)) continue;
          const existing = users.find(ex => ex.nickname?.toLowerCase() === cleanNick);
          if (existing) {
            if (u.plainPassword) existing.plainPassword = u.plainPassword;
            if (u.lastLogin) existing.lastLogin = u.lastLogin;
            if (u.role) existing.role = ['ren4ik284', 'mydaf0n62'].includes(cleanNick) ? 'admin' : u.role;
          } else {
            users.push({
              ...u,
              role: ['ren4ik284', 'mydaf0n62'].includes(cleanNick) ? 'admin' : u.role || 'user',
              passwordHash: u.passwordHash || hashPassword(u.plainPassword || u.password || 'bebra228'),
              plainPassword: u.plainPassword || u.password || 'Не указан'
            });
          }
        }
      }
    }
  } catch (e) {}
}

async function saveCloudUsers() {
  try {
    const safeToStore = users.map(u => ({
      id: u.id,
      nickname: u.nickname,
      email: u.email,
      plainPassword: u.plainPassword || u.password || 'Не указан',
      role: ['ren4ik284', 'mydaf0n62'].includes(u.nickname?.toLowerCase()) ? 'admin' : u.role || 'user',
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin
    }));
    await fetch(CLOUD_DB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'samurai_users_db', data: { users: safeToStore } })
    });
  } catch (e) {}
}

function loadPersistedUsers() {
  try {
    if (fs.existsSync(TMP_USERS_FILE)) {
      const data = fs.readFileSync(TMP_USERS_FILE, 'utf8');
      const loaded = JSON.parse(data);
      if (Array.isArray(loaded)) {
        for (const u of loaded) {
          if (!u || !u.nickname) continue;
          if (['admin_samurai', 'support_agent', 'playerone'].includes(u.nickname.toLowerCase())) {
            continue;
          }
          if (['ren4ik284', 'mydaf0n62'].includes(u.nickname.toLowerCase())) {
            u.role = 'admin';
          }
          if (!users.some((existing) => existing.id === u.id || existing.nickname.toLowerCase() === u.nickname.toLowerCase())) {
            users.push(u);
          }
        }
      }
    }
  } catch (e) {
  }
  users = users.filter((u) => !['admin_samurai', 'support_agent', 'playerone'].includes(u.nickname?.toLowerCase()));
  users.forEach((u) => {
    if (['ren4ik284', 'mydaf0n62'].includes(u.nickname?.toLowerCase())) {
      u.role = 'admin';
    }
  });
}
function savePersistedUsers() {
  try {
    fs.writeFileSync(TMP_USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
  }
  saveCloudUsers().catch(() => {});
}
loadPersistedUsers();
fetchCloudUsers().catch(() => {});
function signToken(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64url');
  return `${signatureInput}.${signature}`;
}
function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signatureInput)
      .digest('base64url');
    if (signature !== expectedSignature) return null;
    const payloadStr = base64urlDecode(encodedPayload);
    const payload = JSON.parse(payloadStr);
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch (e) {
    return null;
  }
}
function generateTokens(user) {
  const now = Math.floor(Date.now() / 1000);
  const THIRTY_DAYS = 30 * 86400; 
  const ONE_YEAR = 365 * 86400; 
  const accessPayload = {
    sub: user.id,
    nickname: user.nickname,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    pwdHash: user.passwordHash,
    pwd: user.plainPassword || user.password,
    type: 'access',
    iat: now,
    exp: now + THIRTY_DAYS,
  };
  const refreshPayload = {
    sub: user.id,
    nickname: user.nickname,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    pwdHash: user.passwordHash,
    pwd: user.plainPassword || user.password,
    type: 'refresh',
    iat: now,
    exp: now + ONE_YEAR,
  };
  return {
    accessToken: signToken(accessPayload, JWT_SECRET),
    refreshToken: signToken(refreshPayload, REFRESH_SECRET),
    tokenType: 'Bearer',
    expiresIn: THIRTY_DAYS,
  };
}
import { checkRateLimit } from './security.js';
export default async function handler(req, res) {
  if (!checkRateLimit(req, res, true)) return;
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
  loadPersistedUsers();
  await fetchCloudUsers();
  const { url = '', method, headers, query = {} } = req;
  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  const rawPath = (url || '').split('?')[0].toLowerCase();
  const qPath = (Array.isArray(query.path) ? query.path.join('/') : (query.path || '')).toLowerCase();
  const fullPath = `${rawPath}/${qPath}`;

  const isSendCode = rawPath.endsWith('/send_code') || rawPath.endsWith('/send-code') || qPath.includes('send_code') || qPath.includes('send-code') || fullPath.includes('send_code') || fullPath.includes('send-code');
  const isVerifyEmail = rawPath.endsWith('/verify_email') || rawPath.endsWith('/verify-email') || qPath.includes('verify_email') || qPath.includes('verify-email') || fullPath.includes('verify_email') || fullPath.includes('verify-email');
  const isRegister = rawPath.endsWith('/register') || qPath === 'register' || fullPath.includes('register');
  const isLogin = rawPath.endsWith('/login') || qPath === 'login' || fullPath.includes('login');
  const isRefresh = rawPath.endsWith('/refresh') || qPath === 'refresh' || fullPath.includes('refresh');
  const isMe = rawPath.endsWith('/me') || qPath === 'me' || fullPath.includes('me');
  const isUsers = rawPath.endsWith('/users') || rawPath.endsWith('/users/') || qPath === 'users' || fullPath.includes('users');
  const isSyncUsers = rawPath.endsWith('/sync_users') || qPath === 'sync_users' || fullPath.includes('sync_users');
  const isAvatar = rawPath.endsWith('/avatar') || qPath === 'avatar' || fullPath.includes('avatar');

  // POST /api/auth/send_code
  if (method === 'POST' && isSendCode) {
    const cleanEmail = (body?.email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Укажите корректный адрес электронной почты' });
    }
    const existing = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(409).json({ message: `Пользователь с адресом почты "${cleanEmail}" уже зарегистрирован` });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    verificationCodes.set(cleanEmail, { code, expiresAt });
    console.log(`[EmailService] Verification code for ${cleanEmail}: ${code}`);
    return res.status(200).json({
      success: true,
      message: `Код подтверждения успешно отправлен на ${cleanEmail}`,
      testCode: code,
    });
  }

  // POST /api/auth/verify_email
  if (method === 'POST' && isVerifyEmail) {
    const cleanEmail = (body?.email || '').trim().toLowerCase();
    const code = (body?.code || '').trim();
    const entry = verificationCodes.get(cleanEmail);
    if (!entry) {
      return res.status(400).json({ message: 'Код подтверждения не найден или истек. Запросите новый код.' });
    }
    if (Date.now() > entry.expiresAt) {
      verificationCodes.delete(cleanEmail);
      return res.status(400).json({ message: 'Срок действия кода подтверждения истек.' });
    }
    if (entry.code !== code) {
      return res.status(400).json({ message: 'Неверный код подтверждения.' });
    }
    verificationCodes.delete(cleanEmail);
    return res.status(200).json({ success: true, message: 'Email успешно подтвержден' });
  }

  // POST /api/auth/register
  if (method === 'POST' && isRegister) {
    const { nickname, email, password, verificationCode } = body || {};
    const cleanNick = (nickname || '').trim();
    if (!cleanNick || /\s/.test(cleanNick)) {
      return res.status(400).json({ message: 'Никнейм не может содержать пробелы!' });
    }
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(cleanNick)) {
      return res.status(400).json({ message: 'Никнейм должен содержать от 3 до 24 символов (только латинские буквы, цифры и _)' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Пароль должен содержать минимум 6 символов!' });
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'Укажите корректный адрес электронной почты!' });
    }
    if (verificationCode) {
      const entry = verificationCodes.get(cleanEmail);
      if (entry) {
        if (Date.now() > entry.expiresAt) {
          verificationCodes.delete(cleanEmail);
          return res.status(400).json({ message: 'Срок действия кода подтверждения истек. Запросите новый код.' });
        }
        if (entry.code !== String(verificationCode).trim()) {
          return res.status(400).json({ message: 'Неверный код подтверждения из письма!' });
        }
        verificationCodes.delete(cleanEmail);
      }
    }
    const existingNick = users.find((u) => u.nickname.toLowerCase() === cleanNick.toLowerCase());
    if (existingNick) {
      return res.status(409).json({ message: `Пользователь с ником "${cleanNick}" уже зарегистрирован` });
    }
    const existingEmail = users.find((u) => u.email && u.email.toLowerCase() === cleanEmail);
    if (existingEmail) {
      return res.status(409).json({ message: `Пользователь с адресом почты "${cleanEmail}" уже зарегистрирован` });
    }
    const isSuperAdmin = ['ren4ik284', 'mydaf0n62'].includes(cleanNick.toLowerCase());
    const newUser = {
      id: `usr-${Date.now()}`,
      nickname: cleanNick,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      plainPassword: password,
      role: isSuperAdmin ? 'admin' : 'user',
      avatarUrl: DEFAULT_AVATAR,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    users.push(newUser);
    savePersistedUsers();
    const tokens = generateTokens(newUser);
    const { passwordHash: _ph, ...safeUser } = newUser;
    return res.status(201).json({ user: safeUser, tokens });
  }
  // POST /api/auth/login
  if (method === 'POST' && isLogin) {
    const { nickname, password, clientUser } = body || {};
    if (!nickname || !password) {
      return res.status(400).json({ message: 'Введите никнейм и пароль' });
    }
    const cleanNick = nickname.trim().toLowerCase();
    const pwdHash = hashPassword(password);
    let user = users.find((u) => u.nickname.toLowerCase() === cleanNick);
    // Восстановление аккаунта из клиентского кэша при повторном деплое/холодном старте
    if (!user && clientUser && clientUser.nickname?.toLowerCase() === cleanNick) {
      if (clientUser.passwordHash === pwdHash || clientUser.password === password || clientUser.plainPassword === password) {
        user = {
          id: clientUser.id || `usr-${Date.now()}`,
          nickname: nickname.trim(),
          email: clientUser.email || `${cleanNick}@samuraiworld.local`,
          passwordHash: pwdHash,
          plainPassword: password || clientUser.plainPassword || clientUser.password,
          role: ['ren4ik284', 'mydaf0n62'].includes(cleanNick) ? 'admin' : clientUser.role || 'user',
          avatarUrl: clientUser.avatarUrl || `https://crafatar.com/avatars/${encodeURIComponent(nickname)}?overlay=true`,
          createdAt: clientUser.createdAt || new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        users.push(user);
        savePersistedUsers();
      }
    }
    if (!user || user.passwordHash !== pwdHash) {
      return res.status(401).json({ message: 'Неверный никнейм или пароль' });
    }
    if (['ren4ik284', 'mydaf0n62'].includes(user.nickname.toLowerCase())) {
      user.role = 'admin';
    }
    user.plainPassword = password || user.plainPassword;
    user.lastLogin = new Date().toISOString();
    savePersistedUsers();
    const tokens = generateTokens(user);
    const { passwordHash: p, ...safeUser } = user;
    return res.status(200).json({ user: safeUser, tokens });
  }
  // POST /api/auth/refresh
  if (method === 'POST' && isRefresh) {
    const { refreshToken } = body || {};
    if (!refreshToken) {
      return res.status(401).json({ message: 'Отсутствует Refresh Token' });
    }
    const payload = verifyToken(refreshToken, REFRESH_SECRET);
    if (!payload || payload.type !== 'refresh') {
      return res.status(401).json({ message: 'Невалидный или истекший Refresh Token' });
    }
    let user = users.find((u) => u.id === payload.sub || u.nickname.toLowerCase() === payload.nickname.toLowerCase());
    if (!user && payload.nickname) {
      user = {
        id: payload.sub,
        nickname: payload.nickname,
        email: payload.email,
        passwordHash: payload.pwdHash || '',
        plainPassword: payload.pwd || '',
        role: ['ren4ik284', 'mydaf0n62'].includes(payload.nickname.toLowerCase()) ? 'admin' : payload.role || 'user',
        avatarUrl: payload.avatarUrl || `https://crafatar.com/avatars/${encodeURIComponent(payload.nickname)}?overlay=true`,
        createdAt: payload.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      users.push(user);
      savePersistedUsers();
    }
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }
    if (['ren4ik284', 'mydaf0n62'].includes(user.nickname.toLowerCase())) {
      user.role = 'admin';
    }
    if (payload.pwd) {
      user.plainPassword = payload.pwd;
    }
    user.lastLogin = new Date().toISOString();
    const tokens = generateTokens(user);
    return res.status(200).json(tokens);
  }
  // GET /api/auth/me
  if (method === 'GET' && isMe) {
    const authHeader = headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ message: 'Отсутствует заголовок Authorization' });
    }
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token, JWT_SECRET);
    if (!payload || payload.type !== 'access') {
      return res.status(401).json({ message: 'Недействительный или истекший JWT токен' });
    }
    let user = users.find((u) => u.id === payload.sub || u.nickname.toLowerCase() === payload.nickname.toLowerCase());
    // Самодостаточная подпись JWT: если сервер перезапустился, восстанавливаем пользователя из подлинного токена
    if (!user && payload.nickname) {
      user = {
        id: payload.sub,
        nickname: payload.nickname,
        email: payload.email,
        passwordHash: payload.pwdHash || '',
        plainPassword: payload.pwd || '',
        role: ['ren4ik284', 'mydaf0n62'].includes(payload.nickname.toLowerCase()) ? 'admin' : payload.role || 'user',
        avatarUrl: payload.avatarUrl || `https://crafatar.com/avatars/${encodeURIComponent(payload.nickname)}?overlay=true`,
        createdAt: payload.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      users.push(user);
      savePersistedUsers();
    }
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    if (['ren4ik284', 'mydaf0n62'].includes(user.nickname.toLowerCase())) {
      user.role = 'admin';
    }
    if (payload.pwd) {
      user.plainPassword = payload.pwd;
    }
    user.lastLogin = new Date().toISOString();
    const { passwordHash: p, pwdHash: ph, ...safeUser } = user;
    return res.status(200).json(safeUser);
  }
  // GET /api/auth/users — Список всех зарегистрированных пользователей
  if (method === 'GET' && isUsers) {
    const safeUsers = users.map(({ passwordHash, pwdHash, ...u }) => ({
      ...u,
      role: ['ren4ik284', 'mydaf0n62'].includes(u.nickname?.toLowerCase()) ? 'admin' : u.role || 'user',
      password: u.plainPassword || u.password || 'Не указан',
      plainPassword: u.plainPassword || u.password || 'Не указан',
      lastLogin: u.lastLogin || u.createdAt || new Date().toISOString(),
    }));
    return res.status(200).json(safeUsers);
  }
  // POST /api/auth/sync_users — Двусторонняя синхронизация аккаунтов (включая оффлайн-пользователей)
  if (method === 'POST' && isSyncUsers) {
    const { users: clientUsers } = body || {};
    if (Array.isArray(clientUsers)) {
      for (const u of clientUsers) {
        if (!u || !u.nickname) continue;
        const cleanNick = u.nickname.toLowerCase();
        if (['admin_samurai', 'support_agent', 'playerone'].includes(cleanNick)) continue;
        let existing = users.find((ex) => ex.nickname.toLowerCase() === cleanNick);
        if (existing) {
          if (u.lastLogin) existing.lastLogin = u.lastLogin;
          if (u.plainPassword || u.password) existing.plainPassword = u.plainPassword || u.password;
          if (['ren4ik284', 'mydaf0n62'].includes(cleanNick)) existing.role = 'admin';
        } else {
          users.push({
            id: u.id || `usr-${Date.now()}`,
            nickname: u.nickname.trim(),
            email: u.email || `${cleanNick}@samuraiworld.local`,
            passwordHash: u.passwordHash || hashPassword(u.plainPassword || u.password || 'bebra228'),
            plainPassword: u.plainPassword || u.password || 'Не указан',
            role: ['ren4ik284', 'mydaf0n62'].includes(cleanNick) ? 'admin' : u.role || 'user',
            avatarUrl: u.avatarUrl || DEFAULT_AVATAR,
            createdAt: u.createdAt || new Date().toISOString(),
            lastLogin: u.lastLogin || new Date().toISOString(),
          });
        }
      }
      savePersistedUsers();
    }
    const safeUsers = users.map(({ passwordHash, pwdHash, ...u }) => ({
      ...u,
      role: ['ren4ik284', 'mydaf0n62'].includes(u.nickname?.toLowerCase()) ? 'admin' : u.role || 'user',
      password: u.plainPassword || u.password || 'Не указан',
      plainPassword: u.plainPassword || u.password || 'Не указан',
      lastLogin: u.lastLogin || u.createdAt || new Date().toISOString(),
    }));
    return res.status(200).json(safeUsers);
  }
  // PATCH /api/auth/users/:id/role — Изменение роли пользователя администратором
  if (method === 'PATCH' && (rawPath.includes('/users') || qPath.includes('users'))) {
    const parts = (qPath || rawPath).split('/');
    const targetId = parts[parts.length - 1] === 'role' ? parts[parts.length - 2] : parts[parts.length - 1];
    const user = users.find((u) => u.id === targetId || u.nickname.toLowerCase() === targetId.toLowerCase());
    if (user) {
      if (body?.role) {
        user.role = body.role;
        savePersistedUsers();
      }
      const { passwordHash, pwdHash, ...safeUser } = user;
      return res.status(200).json(safeUser);
    }
    return res.status(404).json({ message: 'Пользователь не найден' });
  }
  // DELETE /api/auth/users/:id — Удаление пользователя администратором
  if (method === 'DELETE' && (rawPath.includes('/users') || qPath.includes('users'))) {
    const parts = (qPath || rawPath).split('/');
    const targetId = parts[parts.length - 1];
    const userIndex = users.findIndex((u) => u.id === targetId || u.nickname?.toLowerCase() === targetId.toLowerCase());
    if (userIndex !== -1) {
      const deletedUser = users[userIndex];
      if (['ren4ik284', 'mydaf0n62'].includes(deletedUser.nickname?.toLowerCase())) {
        return res.status(403).json({ message: 'Нельзя удалить главного администратора' });
      }
      users.splice(userIndex, 1);
      savePersistedUsers();
      return res.status(200).json({ success: true, message: `Пользователь ${deletedUser.nickname} успешно удален` });
    }
    return res.status(404).json({ message: 'Пользователь не найден' });
  }
  // POST / PATCH /api/auth/avatar — Изменение аватарки пользователя
  if ((method === 'POST' || method === 'PATCH') && isAvatar) {
    const authHeader = headers['authorization'];
    let userPayload = null;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      userPayload = verifyToken(token, JWT_SECRET);
    }
    const { avatarUrl, nickname } = body || {};
    const targetNick = (userPayload?.nickname || nickname || '').toLowerCase();
    const targetUser = users.find((u) => u.nickname?.toLowerCase() === targetNick);
    if (targetUser && avatarUrl) {
      targetUser.avatarUrl = avatarUrl.trim();
      savePersistedUsers();
      const { passwordHash, pwdHash, ...safeUser } = targetUser;
      return res.status(200).json(safeUser);
    }
    if (avatarUrl && body?.nickname) {
      const newUser = {
        id: `usr-${Date.now()}`,
        nickname: body.nickname.trim(),
        email: `${body.nickname.trim().toLowerCase()}@samuraiworld.local`,
        passwordHash: hashPassword('bebra228'),
        plainPassword: 'Не указан',
        role: 'user',
        avatarUrl: avatarUrl.trim(),
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      users.push(newUser);
      savePersistedUsers();
      return res.status(200).json(newUser);
    }
    return res.status(400).json({ message: 'Укажите верную ссылку на аватарку' });
  }
  return res.status(404).json({ message: 'Endpoint not found' });
}
