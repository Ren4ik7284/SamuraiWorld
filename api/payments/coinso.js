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

  // 2. POST /api/payments/coinso (Webhook прием платежей от Coinso)
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
