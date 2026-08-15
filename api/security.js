const ipRequestStore = new Map();
const ipMutationStore = new Map();
export function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.headers['cf-connecting-ip'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
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
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
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
    const mutMax = 15;
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
