import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET || 'samuraiworld_super_secret_jwt_key_2026';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'samuraiworld_super_secret_refresh_key_2026';
const TMP_USERS_FILE = path.join('/tmp', 'samurai_users_store.json');

let users = [
  {
    id: 'usr-admin-1',
    nickname: 'Admin_Samurai',
    email: 'admin@samuraiworld.ru',
    passwordHash: hashPassword('admin123'),
    role: 'admin',
    avatarUrl: 'https://crafatar.com/avatars/Shogun_Kenji?overlay=true',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-support-1',
    nickname: 'Support_Agent',
    email: 'support@samuraiworld.ru',
    passwordHash: hashPassword('support123'),
    role: 'support',
    avatarUrl: 'https://crafatar.com/avatars/President_Alex?overlay=true',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'usr-player-1',
    nickname: 'PlayerOne',
    email: 'player@samuraiworld.ru',
    passwordHash: hashPassword('player123'),
    role: 'user',
    avatarUrl: 'https://crafatar.com/avatars/Miner_Joe?overlay=true',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

function loadPersistedUsers() {
  try {
    if (fs.existsSync(TMP_USERS_FILE)) {
      const data = fs.readFileSync(TMP_USERS_FILE, 'utf8');
      const loaded = JSON.parse(data);
      if (Array.isArray(loaded)) {
        for (const u of loaded) {
          if (!users.some((existing) => existing.id === u.id || existing.nickname.toLowerCase() === u.nickname.toLowerCase())) {
            users.push(u);
          }
        }
      }
    }
  } catch (e) {
    // Ignore tmp file read errors
  }
}

function savePersistedUsers() {
  try {
    fs.writeFileSync(TMP_USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    // Ignore tmp file write errors
  }
}

// Initial load
loadPersistedUsers();

function hashPassword(password) {
  const salt = 'samurai_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function base64urlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

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
  const THIRTY_DAYS = 30 * 86400; // 30 дней доступ без выхода
  const ONE_YEAR = 365 * 86400; // 1 год refresh

  const accessPayload = {
    sub: user.id,
    nickname: user.nickname,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    pwdHash: user.passwordHash,
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

  loadPersistedUsers();
  const { url, method, body, headers } = req;
  const path = url.split('?')[0];

  // POST /api/auth/register
  if (method === 'POST' && path.endsWith('/register')) {
    const { nickname, email, password } = body || {};

    if (!nickname || /\s/.test(nickname)) {
      return res.status(400).json({ message: 'Никнейм не может содержать пробелы!' });
    }
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(nickname)) {
      return res.status(400).json({ message: 'Никнейм должен содержать от 3 до 16 символов (только латинские буквы, цифры и _)' });
    }

    if (!password || /\s/.test(password)) {
      return res.status(400).json({ message: 'Пароль не может содержать пробелы!' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Пароль должен содержать минимум 8 символов!' });
    }
    if (!/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]{8,}$/.test(password)) {
      return res.status(400).json({ message: 'Пароль может содержать только латинские буквы, цифры и стандартные символы!' });
    }

    const existing = users.find((u) => u.nickname.toLowerCase() === nickname.toLowerCase());
    if (existing) {
      return res.status(409).json({ message: `Пользователь "${nickname}" уже существует` });
    }

    const newUser = {
      id: `usr-${Date.now()}`,
      nickname: nickname.trim(),
      email: email || `${nickname.toLowerCase()}@samuraiworld.local`,
      passwordHash: hashPassword(password),
      role: 'user',
      avatarUrl: `https://crafatar.com/avatars/${encodeURIComponent(nickname)}?overlay=true`,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    savePersistedUsers();

    const tokens = generateTokens(newUser);
    const { passwordHash, ...safeUser } = newUser;
    return res.status(201).json({ user: safeUser, tokens });
  }

  // POST /api/auth/login
  if (method === 'POST' && path.endsWith('/login')) {
    const { nickname, password, clientUser } = body || {};
    if (!nickname || !password) {
      return res.status(400).json({ message: 'Введите никнейм и пароль' });
    }

    const cleanNick = nickname.trim().toLowerCase();
    const pwdHash = hashPassword(password);
    let user = users.find((u) => u.nickname.toLowerCase() === cleanNick);

    // Восстановление аккаунта из клиентского кэша при повторном деплое/холодном старте
    if (!user && clientUser && clientUser.nickname?.toLowerCase() === cleanNick) {
      if (clientUser.passwordHash === pwdHash || clientUser.password === password) {
        user = {
          id: clientUser.id || `usr-${Date.now()}`,
          nickname: nickname.trim(),
          email: clientUser.email || `${cleanNick}@samuraiworld.local`,
          passwordHash: pwdHash,
          role: clientUser.role || 'user',
          avatarUrl: clientUser.avatarUrl || `https://crafatar.com/avatars/${encodeURIComponent(nickname)}?overlay=true`,
          createdAt: clientUser.createdAt || new Date().toISOString(),
        };
        users.push(user);
        savePersistedUsers();
      }
    }

    if (!user || user.passwordHash !== pwdHash) {
      return res.status(401).json({ message: 'Неверный никнейм или пароль' });
    }

    const tokens = generateTokens(user);
    const { passwordHash: p, ...safeUser } = user;
    return res.status(200).json({ user: safeUser, tokens });
  }

  // POST /api/auth/refresh
  if (method === 'POST' && path.endsWith('/refresh')) {
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
        role: payload.role || 'user',
        avatarUrl: payload.avatarUrl || `https://crafatar.com/avatars/${encodeURIComponent(payload.nickname)}?overlay=true`,
        createdAt: payload.createdAt || new Date().toISOString(),
      };
      users.push(user);
      savePersistedUsers();
    }

    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }

    const tokens = generateTokens(user);
    return res.status(200).json(tokens);
  }

  // GET /api/auth/me
  if (method === 'GET' && path.endsWith('/me')) {
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
        role: payload.role || 'user',
        avatarUrl: payload.avatarUrl || `https://crafatar.com/avatars/${encodeURIComponent(payload.nickname)}?overlay=true`,
        createdAt: payload.createdAt || new Date().toISOString(),
      };
      users.push(user);
      savePersistedUsers();
    }

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const { passwordHash: p, pwdHash: ph, ...safeUser } = user;
    return res.status(200).json(safeUser);
  }

  return res.status(404).json({ message: 'Endpoint not found' });
}
