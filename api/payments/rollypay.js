import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { checkRateLimit } from '../security.js';
import { grantVipInMinecraft } from './mc-executor.js';

const TERMINAL_ID = process.env.ROLLYPAY_TERMINAL_ID || 'f59246c9-bd38-4402-9082-6f1350d163fc';
const API_KEY = process.env.ROLLYPAY_API_KEY || '';
const SIGNING_SECRET = process.env.ROLLYPAY_SIGNING_SECRET || '';
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
        plainPassword: 'Покупка VIP (RollyPay)',
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
    console.error('[RollyPay] Error updating VIP status:', e);
    return null;
  }
}

export default async function handler(req, res) {
  if (!checkRateLimit(req, res, req.method !== 'GET')) return;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Signature, X-Timestamp'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    let payload = req.body || {};

    if (typeof req.body === 'string') {
      try {
        payload = JSON.parse(req.body);
      } catch (e) {
        const params = new URLSearchParams(req.body);
        payload = Object.fromEntries(params.entries());
      }
    }

    const { nickname, promoCode, paymentMethod, status, event_type, order_id, metadata, redirect } = payload;

    // 1. Создание счета на оплату через RollyPay API
    if (nickname) {
      const cleanNick = nickname.trim();
      if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanNick)) {
        return res.status(400).json({ message: 'Укажите верный игровой никнейм Minecraft (3-16 символов)' });
      }

      let amount = 200;
      const cleanPromo = (promoCode || '').trim().toUpperCase();
      if (cleanPromo === 'SAMURAI' || cleanPromo === 'ROLLY') {
        amount = 180;
      } else if (cleanPromo === 'START') {
        amount = 170;
      }

      const orderId = `ROLLY-${cleanNick.toUpperCase()}-${Date.now()}`;
      let payUrl = '';

      // Если API Key доступен, делаем официальный запрос к RollyPay API
      if (API_KEY) {
        try {
          const response = await fetch('https://rollypay.io/api/v1/payments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': API_KEY,
              'X-Nonce': crypto.randomUUID()
            },
            body: JSON.stringify({
              amount: `${amount}.00`,
              payment_currency: 'RUB',
              payment_method: paymentMethod || 'sbp',
              order_id: orderId,
              terminal_id: TERMINAL_ID,
              description: `Покупка VIP статуса на SamuraiWorld для ${cleanNick}`,
              success_redirect_url: `https://my-minecraft-site.vercel.app/store?payment=success&nickname=${encodeURIComponent(cleanNick)}&order=${orderId}`,
              fail_redirect_url: `https://my-minecraft-site.vercel.app/store?payment=fail`,
              metadata: {
                nickname: cleanNick
              }
            })
          });

          if (response.ok) {
            const data = await response.json();
            payUrl = data.pay_url || '';
          } else {
            const errText = await response.text();
            console.error('[RollyPay API Error]:', response.status, errText);
          }
        } catch (err) {
          console.error('[RollyPay API Request Failed]:', err);
        }
      }

      // Прямая ссылка-фоллбек или от RollyPay
      if (!payUrl) {
        payUrl = `https://panel.rollypay.io`;
      }

      return res.status(200).json({
        payUrl,
        orderId,
        amount,
        terminalId: TERMINAL_ID
      });
    }

    // 2. Webhook приём оплат от RollyPay
    const isPaid = status === 'paid' || event_type === 'payment.paid' || status === 'success';

    if (isPaid) {
      let nick = metadata?.nickname || 'Player';
      if (order_id && order_id.startsWith('ROLLY-')) {
        const parts = order_id.split('-');
        if (parts.length >= 2) {
          nick = parts[1];
        }
      }

      updatePlayerVipStatus(nick);

      // Авто-выдача VIP статуса на сервере Minecraft через RCON/Pterodactyl
      let mcDelivery = null;
      try {
        mcDelivery = await grantVipInMinecraft(nick);
      } catch (err) {
        console.error('[RollyPay Minecraft Grant Error]:', err);
      }

      console.log(`[RollyPay Webhook Success] VIP статус зачислен игроку: ${nick} (Order: ${order_id || 'N/A'})`);

      if (redirect) {
        res.setHeader('Location', `/store?payment=success&order=${order_id}&nickname=${encodeURIComponent(nick)}`);
        return res.status(302).end();
      }

      return res.status(200).json({
        status: 'OK',
        message: `VIP статус успешно выдан игроку ${nick}`,
        minecraftDelivery: mcDelivery
      });
    }

    return res.status(200).json({ status: 'IGNORED', message: 'Платеж в обработке' });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
