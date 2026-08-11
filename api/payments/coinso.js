import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { checkRateLimit } from '../security.js';

const PROJECT_ID = process.env.COINSO_PROJECT_ID || '955394417';
const API_KEY = process.env.COINSO_API_KEY || '585c4cda8655ab5f9376947007b707d0';
const SECRET_KEY = process.env.COINSO_SECRET_KEY || 'b801ecbecba3d24836254fc6ec7e566a';
const TMP_USERS_FILE = path.join('/tmp', 'samurai_users_store.json');

function hashPassword(password) {
  const salt = 'samurai_salt_2026';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function updatePlayerVipStatus(nickname) {
  try {
    let users = [];
    if (fs.existsSync(TMP_USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(TMP_USERS_FILE, 'utf8'));
    }
    const cleanNick = (nickname || '').trim().toLowerCase();
    let user = users.find((u) => u.nickname?.toLowerCase() === cleanNick);

    if (user) {
      user.isVip = true;
      user.vipGrantedAt = new Date().toISOString();
    } else {
      user = {
        id: `usr-${Date.now()}`,
        nickname: nickname.trim(),
        email: `${cleanNick}@samuraiworld.local`,
        passwordHash: hashPassword('vip_user_2026'),
        plainPassword: 'Покупка VIP (Coinso Crypto)',
        role: 'user',
        isVip: true,
        vipGrantedAt: new Date().toISOString(),
        avatarUrl: `https://crafatar.com/avatars/${encodeURIComponent(nickname)}?overlay=true`,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      users.push(user);
    }
    fs.writeFileSync(TMP_USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    return user;
  } catch (e) {
    console.error('[Coinso] Error updating VIP status:', e);
    return null;
  }
}

export default function handler(req, res) {
  if (!checkRateLimit(req, res, req.method !== 'GET')) return;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url, method, body, query } = req;
  const pathName = url.split('?')[0];

  // 1. POST /api/payments/coinso/create — Создание криптовалютного счета
  if (method === 'POST' && (pathName.endsWith('/create') || pathName.endsWith('/coinso'))) {
    const { nickname, promoCode } = body || {};
    if (!nickname || !/^[a-zA-Z0-9_]{3,16}$/.test(nickname.trim())) {
      return res.status(400).json({ message: 'Укажите верный игровой никнейм Minecraft (3-16 символов)' });
    }

    let amount = 200;
    const cleanPromo = (promoCode || '').trim().toUpperCase();
    if (cleanPromo === 'SAMURAI' || cleanPromo === 'ROLLY' || cleanPromo === 'CRYPTO') {
      amount = 180; // 10% discount
    } else if (cleanPromo === 'START') {
      amount = 170; // 15% discount
    }

    const orderId = `COINSO-${nickname.trim().toUpperCase()}-${Date.now()}`;
    const signStr = `${PROJECT_ID}:${amount}:${orderId}:${SECRET_KEY}`;
    const signature = crypto.createHash('md5').update(signStr).digest('hex');

    // Прямой боевой шлюз оплаты Coinso (coinso.io)
    const realPayUrl = `https://coinso.io/pay/AQrbCqmv?project_id=${PROJECT_ID}&amount=${amount}&order_id=${encodeURIComponent(orderId)}&nickname=${encodeURIComponent(nickname.trim())}&sign=${signature}`;
    
    return res.status(200).json({
      payUrl: realPayUrl,
      orderId,
      amount,
      isTestMode: false
    });
  }

  // 2. GET /api/payments/coinso/test-pay — Симулятор тестовой оплаты Coinso Crypto
  if (method === 'GET' && pathName.endsWith('/test-pay')) {
    const { order_id, nickname, amount } = query || {};
    const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Coinso Crypto Payment — Sandbox</title>
      <style>
        body { background: #080b11; color: #f8fafc; font-family: 'Segoe UI', system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #0f172a; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 20px; width: 100%; max-width: 440px; padding: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.9); text-align: center; }
        .logo { font-size: 1.6rem; font-weight: 800; color: #38bdf8; letter-spacing: -0.5px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .badge { background: #2563eb; color: #fff; font-size: 0.7rem; padding: 3px 8px; border-radius: 6px; font-weight: 700; text-transform: uppercase; }
        .amount-box { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); padding: 16px; border-radius: 14px; margin: 16px 0; }
        .amount { font-size: 2.2rem; font-weight: 800; color: #38bdf8; }
        .details { text-align: left; background: #020617; padding: 14px; border-radius: 12px; margin-bottom: 20px; font-size: 0.88rem; color: #94a3b8; border: 1px solid rgba(255,255,255,0.08); }
        .details div { margin-bottom: 6px; display: flex; justify-content: space-between; }
        .details strong { color: #f1f5f9; }
        .crypto-chips { display: flex; justify-content: center; gap: 8px; margin-bottom: 16px; }
        .crypto-chip { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; color: #cbd5e1; }
        .btn { width: 100%; padding: 14px; border: none; border-radius: 12px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: all 0.2s; }
        .btn-success { background: linear-gradient(135deg, #0ea5e9, #2563eb); color: #fff; box-shadow: 0 4px 16px rgba(14, 165, 233, 0.4); margin-bottom: 10px; }
        .btn-success:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .btn-cancel { background: transparent; color: #64748b; border: 1px solid #334155; }
        .alert { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.2); color: #7dd3fc; font-size: 0.82rem; padding: 10px; border-radius: 10px; margin-bottom: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">
          <span>⚡ Coinso Pay</span>
          <span class="badge">CRYPTO GATEWAY</span>
        </div>
        
        <div class="alert">
          ℹ️ Тестовый шлюз оплаты криптовалютой Coinso (Project ID: 955394417).
        </div>

        <div class="crypto-chips">
          <span class="crypto-chip">USDT (TRC20)</span>
          <span class="crypto-chip">TON</span>
          <span class="crypto-chip">BTC</span>
        </div>

        <div class="amount-box">
          <div style="font-size: 0.85rem; color: #94a3b8;">Сумма к оплате</div>
          <div class="amount">${amount || 200} ₽</div>
        </div>

        <div class="details">
          <div><span>Сервер:</span> <strong>SamuraiWorld Minecraft</strong></div>
          <div><span>Игрок:</span> <strong>${nickname || 'Игрок'}</strong></div>
          <div><span>Услуга:</span> <strong>VIP Статус (Логи сундуков)</strong></div>
          <div><span>Заказ ID:</span> <strong style="font-family: monospace;">${order_id || 'COINSO-TEST'}</strong></div>
        </div>

        <form action="/api/payments/coinso" method="POST">
          <input type="hidden" name="event" value="payment.success">
          <input type="hidden" name="transaction_id" value="TX-${Date.now()}">
          <input type="hidden" name="amount" value="${amount || 200}">
          <input type="hidden" name="order_id" value="${order_id}">
          <input type="hidden" name="status" value="success">
          <input type="hidden" name="redirect" value="true">
          
          <button type="submit" class="btn btn-success">💎 Оплатить через Coinso Crypto</button>
        </form>
        <button type="button" class="btn btn-cancel" style="margin-top:8px;" onclick="window.location.href='/store'">Отмена</button>
      </div>
    </body>
    </html>
    `;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  // 3. POST /api/payments/coinso (Webhook прием платежей от Coinso)
  if (method === 'POST') {
    let payload = body || {};

    if (typeof body === 'string') {
      try {
        payload = JSON.parse(body);
      } catch (e) {
        const params = new URLSearchParams(body);
        payload = Object.fromEntries(params.entries());
      }
    }

    const { event, transaction_id, amount, status, order_id, redirect } = payload;

    if (status === 'success' || event === 'payment.success' || status === 'paid') {
      let nickname = 'Player';
      if (order_id && order_id.startsWith('COINSO-')) {
        const parts = order_id.split('-');
        if (parts.length >= 2) {
          nickname = parts[1];
        }
      }

      updatePlayerVipStatus(nickname);
      console.log(`[Coinso Webhook Success] VIP статус зачислен игроку: ${nickname} (Tx: ${transaction_id || 'N/A'})`);

      if (redirect) {
        res.setHeader('Location', `/store?payment=success&order=${order_id}&nickname=${encodeURIComponent(nickname)}`);
        return res.status(302).end();
      }

      return res.status(200).json({ status: 'OK', message: `VIP статус выдан игроку ${nickname}` });
    }

    return res.status(200).json({ status: 'IGNORED', message: 'Платеж в обработке' });
  }

  return res.status(404).json({ message: 'Endpoint not found' });
}
