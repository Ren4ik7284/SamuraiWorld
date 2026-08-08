import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'samuraiworld_super_secret_jwt_key_2026';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'samuraiworld_super_secret_refresh_key_2026';

let users = [
  {
    id: 'usr-admin-1',
    nickname: 'Admin_Samurai',
    email: 'admin@samuraiworld.ru',
    passwordHash: hashPassword('admin123'),
    role: 'admin',
    avatarUrl: 'https://crafatar.com/avatars/Shogun_Kenji?overlay=true',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-support-1',
    nickname: 'Support_Agent',
    email: 'support@samuraiworld.ru',
    passwordHash: hashPassword('support123'),
    role: 'support',
    avatarUrl: 'https://crafatar.com/avatars/President_Alex?overlay=true',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr-player-1',
    nickname: 'PlayerOne',
    email: 'player@samuraiworld.ru',
    passwordHash: hashPassword('player123'),
    role: 'user',
    avatarUrl: 'https://crafatar.com/avatars/Miner_Joe?overlay=true',
    createdAt: new Date().toISOString(),
  },
];

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
  const accessPayload = {
    sub: user.id,
    nickname: user.nickname,
    email: user.email,
    role: user.role,
    type: 'access',
    iat: now,
    exp: now + 3600,
  };
  const refreshPayload = {
    sub: user.id,
    nickname: user.nickname,
    email: user.email,
    role: user.role,
    type: 'refresh',
    iat: now,
    exp: now + 7 * 86400,
  };

  return {
    accessToken: signToken(accessPayload, JWT_SECRET),
    refreshToken: signToken(refreshPayload, REFRESH_SECRET),
    tokenType: 'Bearer',
    expiresIn: 3600,
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

  const { url, method, body, headers } = req;
  const path = url.split('?')[0];

  // POST /api/auth/register
  if (method === 'POST' && path.endsWith('/register')) {
    const { nickname, email, password } = body || {};
    if (!nickname || nickname.length < 3) {
      return res.status(400).json({ message: 'Никнейм должен содержать не менее 3 символов' });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ message: 'Пароль должен содержать не менее 4 символов' });
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
    const tokens = generateTokens(newUser);
    const { passwordHash, ...safeUser } = newUser;
    return res.status(201).json({ user: safeUser, tokens });
  }

  // POST /api/auth/login
  if (method === 'POST' && path.endsWith('/login')) {
    const { nickname, password } = body || {};
    if (!nickname || !password) {
      return res.status(400).json({ message: 'Введите никнейм и пароль' });
    }

    const user = users.find((u) => u.nickname.toLowerCase() === nickname.trim().toLowerCase());
    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ message: 'Неверный никнейм или пароль' });
    }

    const tokens = generateTokens(user);
    const { passwordHash, ...safeUser } = user;
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

    const user = users.find((u) => u.id === payload.sub);
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

    const user = users.find((u) => u.id === payload.sub || u.nickname === payload.nickname);
    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    const { passwordHash, ...safeUser } = user;
    return res.status(200).json(safeUser);
  }

  return res.status(404).json({ message: 'Endpoint not found' });
}
