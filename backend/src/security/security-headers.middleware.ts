import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Remove server signature
    res.removeHeader('X-Powered-By');

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Protect against clickjacking
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Enable cross-site scripting filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Strict Transport Security (HSTS)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data: https: blob:",
        "style-src 'self' 'unsafe-inline' https:",   // unsafe-inline нужен для Angular/CSS-in-JS
        "script-src 'self'",                          // убрали unsafe-inline и unsafe-eval
        "connect-src 'self' https: wss:",
        "font-src 'self' https: data:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    );

    // Permissions policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    next();
  }
}
