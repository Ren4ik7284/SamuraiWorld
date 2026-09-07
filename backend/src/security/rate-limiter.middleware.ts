import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
  recentSecondTimestamps: number[];
  registerTimestamps: number[];
}

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly ipMap = new Map<string, RateLimitRecord>();
  private readonly windowMs = 60 * 1000; // 1 minute window
  private readonly maxPerSecond = 8; // Burst protection: max 8 requests/sec per IP

  // Specific limits per endpoint category
  private getLimitForPath(path: string): number {
    const p = path.toLowerCase();
    if (p.includes('/api/auth/register')) {
      return 5; // Max 5 registrations per minute per IP
    }
    if (p.includes('/api/auth/login')) {
      return 10; // Max 10 login attempts per minute (brute-force protection)
    }
    if (p.includes('/api/payments')) {
      return 30; // Max 30 requests per minute
    }
    return 120; // 120 requests per minute for general API
  }

  use(req: Request, res: Response, next: NextFunction) {
    const clientIp = this.getClientIp(req);
    const now = Date.now();
    const url = (req.originalUrl || req.url).toLowerCase();
    const limit = this.getLimitForPath(url);

    // Clean up old entries periodically
    if (this.ipMap.size > 10000) {
      this.cleanup(now);
    }

    let record = this.ipMap.get(clientIp);
    if (!record) {
      record = { timestamps: [], recentSecondTimestamps: [], registerTimestamps: [] };
      this.ipMap.set(clientIp, record);
    }

    // 1. BURST FLOOD PROTECTION (Anti-DDoS: drops 128 req/s attacks instantly)
    record.recentSecondTimestamps = record.recentSecondTimestamps.filter((t) => now - t < 1000);
    if (record.recentSecondTimestamps.length >= this.maxPerSecond) {
      res.setHeader('Retry-After', '2');
      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Обнаружен слишком частый поток запросов (Anti-Flood). Пожалуйста, сбавьте темп.',
      });
    }

    // 2. REGISTRATION FLOOD PROTECTION (Max 3 registrations per 5 minutes per IP)
    if (url.includes('/api/auth/register') && req.method === 'POST') {
      record.registerTimestamps = record.registerTimestamps.filter((t) => now - t < 5 * 60 * 1000);
      if (record.registerTimestamps.length >= 3) {
        const retryAfterSec = Math.ceil((record.registerTimestamps[0] + 5 * 60 * 1000 - now) / 1000);
        res.setHeader('Retry-After', retryAfterSec.toString());
        return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          message: 'Слишком много регистраций с вашего IP. Повторите попытку через несколько минут.',
          retryAfter: retryAfterSec,
        });
      }
      record.registerTimestamps.push(now);
    }

    // 3. STANDARD SLIDING WINDOW RATE LIMIT
    record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);
    const currentCount = record.timestamps.length;
    const remaining = Math.max(0, limit - currentCount - 1);
    const resetTime = Math.ceil((now + this.windowMs) / 1000);

    res.setHeader('RateLimit-Limit', limit.toString());
    res.setHeader('RateLimit-Remaining', remaining.toString());
    res.setHeader('RateLimit-Reset', resetTime.toString());

    if (currentCount >= limit) {
      const retryAfterSec = Math.ceil((record.timestamps[0] + this.windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec.toString());
      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Превышен лимит запросов. Пожалуйста, повторите попытку через минуту.',
        retryAfter: retryAfterSec,
      });
    }

    record.timestamps.push(now);
    record.recentSecondTimestamps.push(now);
    next();
  }

  private getClientIp(req: Request): string {
    const socketIp = req.socket?.remoteAddress || '127.0.0.1';
    // Доверяем X-Forwarded-For ТОЛЬКО от доверенного прокси (Nginx в Docker-сети: 127.0.0.1 или 172.x.x.x)
    const isTrustedProxy =
      socketIp === '127.0.0.1' ||
      socketIp === '::1' ||
      socketIp.startsWith('172.') ||
      socketIp.startsWith('10.') ||
      socketIp.startsWith('192.168.');
    if (isTrustedProxy) {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        const ip = forwarded.split(',')[0].trim();
        // Базовая валидация — не пустая строка и не явный подлог
        if (ip && ip !== 'unknown' && ip.length < 45) {
          return ip;
        }
      }
    }
    return socketIp;
  }

  private cleanup(now: number): void {
    for (const [ip, record] of this.ipMap.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < this.windowMs);
      record.recentSecondTimestamps = record.recentSecondTimestamps.filter((t) => now - t < 1000);
      record.registerTimestamps = record.registerTimestamps.filter((t) => now - t < 5 * 60 * 1000);
      if (record.timestamps.length === 0 && record.recentSecondTimestamps.length === 0 && record.registerTimestamps.length === 0) {
        this.ipMap.delete(ip);
      }
    }
  }
}
