import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { checkRateLimit } from './security.js';

const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
if (!JWT_SECRET || !REFRESH_SECRET) {
  throw new Error('[auth.js] КРИТИЧНО: JWT_SECRET или REFRESH_SECRET не заданы в Vercel Environment Variables!');
}

const TMP_USERS_FILE = path.join('/tmp', 'samurai_users_store.json');
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.03-4.84-2.6.03-1.61 3.22-2.4 4.84-2.4 1.61 0 4.81.79 4.84 2.4C15.8 18.97 14.03 20 12 20z"/></svg>';

function getMasterAdmins() {
  if (process.env.MASTER_ADMINS) {
    return process.env.MASTER_ADMINS.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
  }
  return ['ren4ik284', 'mydaf0n62'];
}

function hashPassword(password) {
  const salt = process.env.PASSWORD_SALT || 'samurai_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !password) return false;
  const salt = process.env.PASSWORD_SALT || 'samurai_salt_2026';
  // Стандарт PBKDF2 sha512 (10000 итераций)
  const hash10k = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  if (storedHash === hash10k) return true;
  // Предыдущий стандарт PBKDF2 sha512 (1000 итераций)
  const hash1k = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  if (storedHash === hash1k) return true;
  // Совместимость с legacy plainPassword в облачной базе (будет мгновенно заменено на хеш при входе)
  if (storedHash === password) return true;
  return false;
}

function base64urlEncode(str) {
  return Buffer.from(str).toString('base64url');
}

function base64urlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

async function sendEmailOtp(toEmail, code) {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || 'samuraiworldmine@gmail.com';
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS || process.env.EMAIL_PASSWORD;

  if (smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"SamuraiWorld" <${smtpUser}>`,
        to: toEmail,
        subject: `Код подтверждения: ${code} — SamuraiWorld`,
        html: `
          <div style="background:#0d0e14;color:#f8fafc;padding:32px 24px;font-family:Arial,sans-serif;border-radius:12px;max-width:520px;margin:0 auto;border:1px solid rgba(212,160,23,0.3);">
            <h2 style="color:#d4a017;margin-top:0;font-size:22px;text-align:center;">🏯 SamuraiWorld Minecraft</h2>
            <p style="font-size:15px;color:#cbd5e1;line-height:1.5;">Здравствуйте! Вы запросили код для подтверждения регистрации аккаунта на сервере <strong>SamuraiWorld</strong>.</p>
            <div style="background:rgba(212,160,23,0.12);border:1px solid #d4a017;padding:16px;border-radius:8px;text-align:center;margin:24px 0;">
              <span style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#f8fafc;">${code}</span>
            </div>
            <p style="font-size:13px;color:#94a3b8;margin-bottom:0;">Код действителен в течение 15 минут. Если вы не запрашивали данный код, просто проигнорируйте это письмо.</p>
          </div>
        `,
      });
      console.log(`[EmailService] Email dispatched to ${toEmail}`);
      return true;
    } catch (err) {
      console.error(`[EmailService] Failed to send email via SMTP:`, err.message);
      return false;
    }
  } else {
    console.warn(`[EmailService] SMTP_PASS not set. Email not sent.`);
    return false;
  }
}

const verificationCodes = new Map();

const initialAdminPass = process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');
let users = [
  {
    id: 'usr-ren4ik284-admin',
    nickname: 'Ren4ik284',
    email: 'ren4ik284@samuraiworld.ru',
    passwordHash: hashPassword(initialAdminPass),
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
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(CLOUD_DB_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.data && Array.isArray(json.data.users)) {
        const masters = getMasterAdmins();
        for (const u of json.data.users) {
          if (!u || !u.nickname) continue;
          const cleanNick = u.nickname.toLowerCase();
          if (['admin_samurai', 'support_agent', 'playerone'].includes(cleanNick)) continue;
          const resolvedHash = u.passwordHash || (u.plainPassword ? hashPassword(u.plainPassword) : null);
          const existing = users.find((ex) => ex.nickname?.toLowerCase() === cleanNick);
          if (existing) {
            if (u.lastLogin) existing.lastLogin = u.lastLogin;
            if (u.role) existing.role = masters.includes(cleanNick) ? 'admin' : u.role;
            if (resolvedHash) existing.passwordHash = resolvedHash;
          } else {
            users.push({
              id: u.id,
              nickname: u.nickname,
              email: u.email,
              role: masters.includes(cleanNick) ? 'admin' : u.role || 'user',
              passwordHash: resolvedHash || crypto.randomBytes(32).toString('hex'),
              avatarUrl: u.avatarUrl || DEFAULT_AVATAR,
              createdAt: u.createdAt,
              lastLogin: u.lastLogin,
            });
          }
        }
      }
    }
  } catch (e) {}
}

async function saveCloudUsers() {
  try {
    const masters = getMasterAdmins();
    const safeToStore = users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      email: u.email,
      passwordHash: u.passwordHash,
      role: masters.includes(u.nickname?.toLowerCase()) ? 'admin' : u.role || 'user',
      avatarUrl: u.avatarUrl || DEFAULT_AVATAR,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
    }));
    await fetch(CLOUD_DB_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'samurai_users_db', data: { users: safeToStore } }),
    });
  } catch (e) {}
}

async function purgeUserTickets(userId, nickname) {
  try {
    const CLOUD_TICKETS_DB_URL = 'https://api.restful-api.dev/objects/ff8081819ff5b11001a023f7f7486be0';
    const resp = await fetch(CLOUD_TICKETS_DB_URL);
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.data && Array.isArray(json.data.tickets)) {
        const nick = (nickname || '').toLowerCase();
        const remaining = json.data.tickets.filter(
          (t) => t && t.userId !== userId && (t.nickname || '').toLowerCase() !== nick
        );
        await fetch(CLOUD_TICKETS_DB_URL, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'samurai_tickets_db',
            data: {
              tickets: remaining,
              deletedTicketIds: json.data.deletedTicketIds || [],
            },
          }),
        });
      }
    }
  } catch (e) {}
}

function loadPersistedUsers() {
  const masters = getMasterAdmins();
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
          if (masters.includes(u.nickname.toLowerCase())) {
            u.role = 'admin';
          }
          if (!users.some((existing) => existing.id === u.id || existing.nickname.toLowerCase() === u.nickname.toLowerCase())) {
            users.push(u);
          }
        }
      }
    }
  } catch (e) {}
  users = users.filter((u) => !['admin_samurai', 'support_agent', 'playerone'].includes(u.nickname?.toLowerCase()));
  users.forEach((u) => {
    if (masters.includes(u.nickname?.toLowerCase())) {
      u.role = 'admin';
    }
  });
}

function savePersistedUsers() {
  try {
    fs.writeFileSync(TMP_USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {}
  saveCloudUsers().catch(() => {});
}

loadPersistedUsers();
fetchCloudUsers().catch(() => {});

function signToken(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64url');
  return `${signatureInput}.${signature}`;
}

function verifyToken(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(signatureInput).digest('base64url');
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

function getAuthUser(headers) {
  const authHeader = headers?.['authorization'] || headers?.['Authorization'];
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const payload = verifyToken(parts[1], JWT_SECRET);
  if (!payload || payload.type !== 'access') return null;
  return payload;
}

function isAdmin(userPayload) {
  if (!userPayload) return false;
  if (userPayload.role === 'admin') return true;
  return getMasterAdmins().includes((userPayload.nickname || '').toLowerCase());
}

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
  const qPath = (Array.isArray(query.path) ? query.path.join('/') : query.path || '').toLowerCase();
  const fullPath = `${rawPath}/${qPath}`;

  const isSendCode =
    rawPath.endsWith('/send_code') ||
    rawPath.endsWith('/send-code') ||
    qPath.includes('send_code') ||
    qPath.includes('send-code') ||
    fullPath.includes('send_code') ||
    fullPath.includes('send-code');
  const isVerifyEmail =
    rawPath.endsWith('/verify_email') ||
    rawPath.endsWith('/verify-email') ||
    qPath.includes('verify_email') ||
    qPath.includes('verify-email') ||
    fullPath.includes('verify_email') ||
    fullPath.includes('verify-email');
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
    // Создаем криптографический verificationToken (HMAC) для независимости от памяти между серверами Vercel
    const hmacSig = crypto.createHmac('sha256', JWT_SECRET).update(`${cleanEmail}:${code}:${expiresAt}`).digest('hex');
    const verificationToken = `${expiresAt}:${hmacSig}`;
    const emailSent = await sendEmailOtp(cleanEmail, code);
    return res.status(200).json({
      success: true,
      message: emailSent
        ? `Код подтверждения отправлен на ${cleanEmail} (проверьте Входящие или Спам)`
        : `Код подтверждения успешно сгенерирован для ${cleanEmail}`,
      verificationToken,
      testCode: emailSent ? undefined : code,
    });
  }

  // POST /api/auth/verify_email
  if (method === 'POST' && isVerifyEmail) {
    const cleanEmail = (body?.email || '').trim().toLowerCase();
    const code = (body?.code || '').trim();
    const verificationToken = body?.verificationToken;
    let valid = false;
    if (verificationToken && typeof verificationToken === 'string') {
      const [expStr, sig] = verificationToken.split(':');
      const exp = parseInt(expStr, 10);
      if (exp && Date.now() <= exp) {
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${cleanEmail}:${code}:${exp}`).digest('hex');
        if (sig === expectedSig) valid = true;
      }
    }
    if (!valid) {
      const entry = verificationCodes.get(cleanEmail);
      if (entry && Date.now() <= entry.expiresAt && entry.code === code) {
        valid = true;
        verificationCodes.delete(cleanEmail);
      }
    }
    if (!valid) {
      return res.status(400).json({ message: 'Неверный код подтверждения или срок его действия истек.' });
    }
    return res.status(200).json({ success: true, message: 'Email успешно подтвержден' });
  }

  // POST /api/auth/register
  if (method === 'POST' && isRegister) {
    const { nickname, email, password, verificationCode, verificationToken } = body || {};
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
      let codeValid = false;
      const cleanCode = String(verificationCode).trim();
      if (verificationToken && typeof verificationToken === 'string') {
        const [expStr, sig] = verificationToken.split(':');
        const exp = parseInt(expStr, 10);
        if (exp && Date.now() <= exp) {
          const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${cleanEmail}:${cleanCode}:${exp}`).digest('hex');
          if (sig === expectedSig) {
            codeValid = true;
          }
        }
      }
      if (!codeValid) {
        const entry = verificationCodes.get(cleanEmail);
        if (entry && Date.now() <= entry.expiresAt && entry.code === cleanCode) {
          codeValid = true;
          verificationCodes.delete(cleanEmail);
        }
      }
      if (!codeValid) {
        return res.status(400).json({ message: 'Неверный код подтверждения из письма!' });
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
    const masters = getMasterAdmins();
    const isSuperAdmin = masters.includes(cleanNick.toLowerCase());
    const newUser = {
      id: `usr-${Date.now()}`,
      nickname: cleanNick,
      email: cleanEmail,
      passwordHash: hashPassword(password),
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
    const { nickname, password } = body || {};
    if (!nickname || !password) {
      return res.status(400).json({ message: 'Введите никнейм и пароль' });
    }
    const cleanNick = nickname.trim().toLowerCase();
    const user = users.find((u) => u.nickname.toLowerCase() === cleanNick);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: 'Неверный никнейм или пароль' });
    }
    // Автоматический апгрейд хеша до современного 10000 PBKDF2
    const currentHash = hashPassword(password);
    if (user.passwordHash !== currentHash) {
      user.passwordHash = currentHash;
    }
    if (getMasterAdmins().includes(user.nickname.toLowerCase())) {
      user.role = 'admin';
    }
    user.lastLogin = new Date().toISOString();
    savePersistedUsers();
    const tokens = generateTokens(user);
    const { passwordHash: _p, ...safeUser } = user;
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
    let user = users.find((u) => u.id === payload.sub || u.nickname.toLowerCase() === (payload.nickname || '').toLowerCase());
    if (!user) {
      // Восстанавливаем пользователя из валидного токена
      const masters = getMasterAdmins();
      user = {
        id: payload.sub,
        nickname: payload.nickname,
        email: payload.email || `${(payload.nickname || '').toLowerCase()}@samuraiworld.local`,
        role: masters.includes((payload.nickname || '').toLowerCase()) ? 'admin' : payload.role || 'user',
        avatarUrl: payload.avatarUrl || DEFAULT_AVATAR,
        createdAt: payload.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      users.push(user);
      savePersistedUsers();
    } else {
      if (getMasterAdmins().includes(user.nickname.toLowerCase())) {
        user.role = 'admin';
      }
      user.lastLogin = new Date().toISOString();
      savePersistedUsers();
    }
    const tokens = generateTokens(user);
    return res.status(200).json(tokens);
  }

  // GET /api/auth/me
  if (method === 'GET' && isMe) {
    const authUser = getAuthUser(headers);
    if (!authUser) {
      return res.status(401).json({ message: 'Недействительный или истекший JWT токен' });
    }
    let user = users.find((u) => u.id === authUser.sub || u.nickname.toLowerCase() === authUser.nickname.toLowerCase());
    if (!user) {
      // Пользователь криптографически верифицирован — восстанавливаем профиль
      const masters = getMasterAdmins();
      user = {
        id: authUser.sub,
        nickname: authUser.nickname,
        email: authUser.email || `${authUser.nickname.toLowerCase()}@samuraiworld.local`,
        role: masters.includes(authUser.nickname.toLowerCase()) ? 'admin' : authUser.role || 'user',
        avatarUrl: authUser.avatarUrl || DEFAULT_AVATAR,
        createdAt: authUser.createdAt || new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      users.push(user);
      savePersistedUsers();
    } else {
      if (getMasterAdmins().includes(user.nickname.toLowerCase())) {
        user.role = 'admin';
      }
      user.lastLogin = new Date().toISOString();
    }
    const { passwordHash: _p, ...safeUser } = user;
    return res.status(200).json(safeUser);
  }

  // GET /api/auth/users — Список всех зарегистрированных пользователей (доступно только Администраторам)
  if (method === 'GET' && isUsers) {
    const authUser = getAuthUser(headers);
    if (!isAdmin(authUser)) {
      return res.status(403).json({ message: 'Доступ разрешен только Администраторам' });
    }
    const masters = getMasterAdmins();
    const safeUsers = users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      email: u.email,
      role: masters.includes(u.nickname?.toLowerCase()) ? 'admin' : u.role || 'user',
      avatarUrl: u.avatarUrl || DEFAULT_AVATAR,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin || u.createdAt || new Date().toISOString(),
    }));
    return res.status(200).json(safeUsers);
  }

  // POST /api/auth/sync_users — Синхронизация (доступна только Администраторам)
  if (method === 'POST' && isSyncUsers) {
    const authUser = getAuthUser(headers);
    if (!isAdmin(authUser)) {
      return res.status(403).json({ message: 'Синхронизация базы разрешена только Администраторам' });
    }
    const masters = getMasterAdmins();
    const { users: clientUsers } = body || {};
    if (Array.isArray(clientUsers)) {
      for (const u of clientUsers) {
        if (!u || !u.nickname) continue;
        const cleanNick = u.nickname.toLowerCase();
        if (['admin_samurai', 'support_agent', 'playerone'].includes(cleanNick)) continue;
        const existing = users.find((ex) => ex.nickname.toLowerCase() === cleanNick);
        if (existing) {
          if (u.lastLogin) existing.lastLogin = u.lastLogin;
          if (masters.includes(cleanNick)) existing.role = 'admin';
        } else {
          users.push({
            id: u.id || `usr-${Date.now()}`,
            nickname: u.nickname.trim(),
            email: u.email || `${cleanNick}@samuraiworld.local`,
            passwordHash: u.passwordHash || crypto.randomBytes(32).toString('hex'),
            role: masters.includes(cleanNick) ? 'admin' : u.role || 'user',
            avatarUrl: u.avatarUrl || DEFAULT_AVATAR,
            createdAt: u.createdAt || new Date().toISOString(),
            lastLogin: u.lastLogin || new Date().toISOString(),
          });
        }
      }
      savePersistedUsers();
    }
    const safeUsers = users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      email: u.email,
      role: masters.includes(u.nickname?.toLowerCase()) ? 'admin' : u.role || 'user',
      avatarUrl: u.avatarUrl || DEFAULT_AVATAR,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin || u.createdAt || new Date().toISOString(),
    }));
    return res.status(200).json(safeUsers);
  }

  // PATCH /api/auth/users/:id/role — Изменение роли пользователя администратором
  if (method === 'PATCH' && (rawPath.includes('/users') || qPath.includes('users'))) {
    const authUser = getAuthUser(headers);
    if (!isAdmin(authUser)) {
      return res.status(403).json({ message: 'Изменение роли разрешено только Администраторам' });
    }
    const parts = (qPath || rawPath).split('/');
    const targetId = parts[parts.length - 1] === 'role' ? parts[parts.length - 2] : parts[parts.length - 1];
    const user = users.find((u) => u.id === targetId || u.nickname.toLowerCase() === targetId.toLowerCase());
    if (user) {
      const allowedRoles = ['user', 'support', 'admin'];
      if (body?.role && allowedRoles.includes(body.role)) {
        user.role = body.role;
        savePersistedUsers();
      }
      const { passwordHash: _p, ...safeUser } = user;
      return res.status(200).json(safeUser);
    }
    return res.status(404).json({ message: 'Пользователь не найден' });
  }

  // DELETE /api/auth/users/:id — Удаление пользователя администратором
  if (method === 'DELETE' && (rawPath.includes('/users') || qPath.includes('users'))) {
    const authUser = getAuthUser(headers);
    if (!isAdmin(authUser)) {
      return res.status(403).json({ message: 'Удаление пользователя разрешено только Администраторам' });
    }
    const parts = (qPath || rawPath).split('/');
    const targetId = parts[parts.length - 1];
    const userIndex = users.findIndex((u) => u.id === targetId || u.nickname?.toLowerCase() === targetId.toLowerCase());
    if (userIndex !== -1) {
      const deletedUser = users[userIndex];
      if (getMasterAdmins().includes(deletedUser.nickname?.toLowerCase())) {
        return res.status(403).json({ message: 'Нельзя удалить главного администратора' });
      }
      users.splice(userIndex, 1);
      savePersistedUsers();
      purgeUserTickets(deletedUser.id, deletedUser.nickname).catch(() => {});
      return res.status(200).json({ success: true, message: `Пользователь ${deletedUser.nickname} успешно удален` });
    }
    return res.status(404).json({ message: 'Пользователь не найден' });
  }

  // POST / PATCH /api/auth/avatar — Изменение аватарки пользователя
  if ((method === 'POST' || method === 'PATCH') && isAvatar) {
    const authUser = getAuthUser(headers);
    if (!authUser) {
      return res.status(401).json({ message: 'Необходима авторизация' });
    }
    const { avatarUrl, nickname } = body || {};
    if (!avatarUrl || typeof avatarUrl !== 'string' || avatarUrl.trim().length > 1000) {
      return res.status(400).json({ message: 'Укажите верную ссылку на аватарку' });
    }
    const targetNick = (nickname || authUser.nickname || '').toLowerCase();
    if (targetNick !== authUser.nickname.toLowerCase() && !isAdmin(authUser)) {
      return res.status(403).json({ message: 'Вы можете изменять только собственную аватарку' });
    }
    const targetUser = users.find((u) => u.nickname?.toLowerCase() === targetNick);
    if (targetUser) {
      targetUser.avatarUrl = avatarUrl.trim();
      savePersistedUsers();
      const { passwordHash: _p, ...safeUser } = targetUser;
      return res.status(200).json(safeUser);
    }
    return res.status(404).json({ message: 'Пользователь не найден' });
  }

  return res.status(404).json({ message: 'Endpoint not found' });
}
