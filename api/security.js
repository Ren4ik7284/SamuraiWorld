import crypto from 'crypto';

const ipRequestStore = new Map();
const ipMutationStore = new Map();
const loginLockoutStore = new Map();

const ALLOWED_ORIGINS = new Set([
  'https://samuraiworld.site',
  'https://www.samuraiworld.site',
  'https://samuraiworld.ru',
  'https://www.samuraiworld.ru',
  'https://my-minecraft-site.vercel.app',
  'http://localhost:4200',
  'http://localhost:3000',
]);

export function getClientIp(req) {
  const headers = req.headers || {};
  const forwarded = headers['x-forwarded-for'] || headers['x-real-ip'] || headers['cf-connecting-ip'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function handleCors(req, res) {
  const origin = req.headers?.origin;
  const isVercelDomain = origin && /^https:\/\/[a-z0-9-]+(?:-ren4ik7284s-projects)?\.vercel\.app$/.test(origin);

  if (origin && (ALLOWED_ORIGINS.has(origin) || isVercelDomain)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://samuraiworld.site');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Internal-Secret'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return false;
  }
  return true;
}

export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; img-src 'self' data: https: blob:; font-src 'self' https: data:;"
  );
}

export function checkRateLimit(req, res, isMutation = false) {
  applySecurityHeaders(res);
  if (!handleCors(req, res)) return false;

  const headers = req.headers || {};
  const contentLength = parseInt(headers['content-length'] || '0', 10);
  if (contentLength > 512 * 1024) {
    res.status(413).json({ error: 'Payload Too Large', message: 'Размер запроса превышает допустимый лимит (500 KB).' });
    return false;
  }
  const clientIp = getClientIp(req);
  const now = Date.now();
  const genWindow = 60000;
  const genMax = 120;
  let genData = ipRequestStore.get(clientIp);
  if (!genData || now - genData.resetTime > genWindow) {
    genData = { count: 1, resetTime: now };
  } else {
    genData.count += 1;
  }
  ipRequestStore.set(clientIp, genData);
  if (genData.count > genMax) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Зафиксирована аномальная активность. Доступ временно ограничен системой защиты от DDoS/DoS атак. Попробуйте через 1 минуту.',
    });
    return false;
  }
  if (isMutation && ['POST', 'PATCH', 'DELETE', 'PUT'].includes(req.method)) {
    const mutWindow = 30000;
    const mutMax = 25;
    let mutData = ipMutationStore.get(clientIp);
    if (!mutData || now - mutData.resetTime > mutWindow) {
      mutData = { count: 1, resetTime: now };
    } else {
      mutData.count += 1;
    }
    ipMutationStore.set(clientIp, mutData);
    if (mutData.count > mutMax) {
      res.setHeader('Retry-After', '30');
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Слишком много действий за короткий промежуток времени (Защита от спама и флуда). Подождите 30 секунд.',
      });
      return false;
    }
  }
  return true;
}

export function checkLoginLockout(nickname) {
  if (!nickname) return null;
  const key = String(nickname).toLowerCase().trim();
  const entry = loginLockoutStore.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (entry.lockedUntil && now < entry.lockedUntil) {
    const minutesLeft = Math.ceil((entry.lockedUntil - now) / 60000);
    return `Слишком много неверных попыток входа для аккаунта "${nickname}". Аккаунт временно заблокирован в целях безопасности. Повторите попытку через ${minutesLeft} мин.`;
  }
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    loginLockoutStore.delete(key);
  }
  return null;
}

export function recordFailedLogin(nickname) {
  if (!nickname) return;
  const key = String(nickname).toLowerCase().trim();
  const now = Date.now();
  const entry = loginLockoutStore.get(key) || { count: 0, firstFail: now };
  if (now - entry.firstFail > 15 * 60 * 1000) {
    entry.count = 1;
    entry.firstFail = now;
  } else {
    entry.count += 1;
  }
  if (entry.count >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000;
  }
  loginLockoutStore.set(key, entry);
}

export function clearFailedLogin(nickname) {
  if (!nickname) return;
  loginLockoutStore.delete(String(nickname).toLowerCase().trim());
}

export function encryptPayload(data, secretKey) {
  if (!secretKey) return null;
  try {
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let enc = cipher.update(JSON.stringify(data), 'utf8', 'base64');
    enc += cipher.final('base64');
    const tag = cipher.getAuthTag().toString('base64');
    return {
      _enc: 1,
      ciphertext: enc,
      iv: iv.toString('base64'),
      tag,
    };
  } catch (e) {
    console.error('[Security AES-GCM Encrypt error]:', e.message);
    return null;
  }
}

export function decryptPayload(payload, secretKey) {
  if (!payload || !payload._enc || !payload.ciphertext || !payload.iv || !payload.tag || !secretKey) {
    return null;
  }
  try {
    const key = crypto.createHash('sha256').update(secretKey).digest();
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let dec = decipher.update(payload.ciphertext, 'base64', 'utf8');
    dec += decipher.final('utf8');
    return JSON.parse(dec);
  } catch (e) {
    console.warn('[Security AES-GCM Decrypt]: Защита отклонила поддельные или повреждённые данные:', e.message);
    return null;
  }
}

