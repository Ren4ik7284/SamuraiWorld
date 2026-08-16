import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { checkRateLimit } from '../security.js';
import { grantVipInMinecraft, grantPassInMinecraft } from './mc-executor.js';
const TERMINAL_ID = process.env.ROLLYPAY_TERMINAL_ID || 'f59246c9-bd38-4402-9082-6f1350d163fc';
const API_KEY = process.env.ROLLYPAY_API_KEY || 'bwpUuj_o2yTEqou74rTtFy1Yyl9EW54cX6quRxDN2qE';
const SIGNING_SECRET = process.env.ROLLYPAY_SIGNING_SECRET || '3tcPyhKtcbbeT_3AjKxfnWnB-INxRD3vBqiwVK_9psk';
const TMP_USERS_FILE = path.join('/tmp', 'samurai_users_store.json');
function verifyRollypaySignature(req, rawBodyStr, secret) {
  if (!secret) return true;
  const signature = req.headers['x-signature'] || req.headers['X-Signature'];
  const timestamp = req.headers['x-timestamp'] || req.headers['X-Timestamp'];
  if (!signature || !timestamp) return true;
  try {
    const payload = `${timestamp}.${rawBodyStr}`;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (e) {
    console.error('[RollyPay Signature Error]:', e.message);
    return false;
  }
}
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
        plainPassword: 'Покупка (RollyPay)',
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
    const { nickname, promoCode, paymentMethod, status, event_type, order_id, metadata, redirect, type } = payload;
    if (nickname) {
      const cleanNick = nickname.trim();
      if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanNick)) {
        return res.status(400).json({ message: 'Укажите верный игровой никнейм Minecraft (3-16 символов)' });
      }
      const isPass = type === 'pass' || payload.itemType === 'pass';
      let amount = 50;
      if (!isPass) {
        const cleanPromo = (promoCode || '').trim().toUpperCase();
        if (cleanPromo === 'SAMURAI' || cleanPromo === 'ROLLY') {
          amount = 45; 
        } else if (cleanPromo === 'START') {
          amount = 40; 
        }
      }
      const orderPrefix = isPass ? 'ROLLY-PASS' : 'ROLLY-VIP';
      const orderId = `${orderPrefix}-${cleanNick.toUpperCase()}-${Date.now()}`;
      let payUrl = '';
      if (API_KEY) {
        const pPayload = {
          terminal_id: TERMINAL_ID,
          amount: `${amount}.00`,
          payment_currency: 'RUB',
          order_id: orderId,
          description: isPass
            ? `Покупка Проходки на SamuraiWorld для ${cleanNick}`
            : `Покупка VIP статуса на SamuraiWorld для ${cleanNick}`,
          success_redirect_url: `https://my-minecraft-site.vercel.app/store?payment=success${isPass ? '&type=pass' : ''}&nickname=${encodeURIComponent(cleanNick)}&order=${orderId}`,
          fail_redirect_url: `https://my-minecraft-site.vercel.app/store?payment=fail${isPass ? '&type=pass' : ''}`,
          metadata: {
            nickname: cleanNick,
            type: isPass ? 'pass' : 'vip'
          }
        };
        const apiUrls = [
          'https://api.rollypay.io/api/v1/payments',
          'https://rollypay.io/api/v1/payments'
        ];
        for (const url of apiUrls) {
          try {
            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'X-Nonce': crypto.randomUUID()
              },
              body: JSON.stringify(pPayload)
            });
            if (response.ok) {
              const data = await response.json();
              payUrl = data.pay_url || data.url || '';
              if (payUrl) break;
            } else {
              const errText = await response.text();
              console.error(`[RollyPay API Error (${url})]:`, response.status, errText);
            }
          } catch (err) {
            console.error(`[RollyPay API Request Failed (${url})]:`, err);
          }
        }
      }
      if (!payUrl) {
        return res.status(200).json({
          payUrl: '',
          orderId,
          amount,
          terminalId: TERMINAL_ID,
          needsApiKey: !API_KEY,
          message: !API_KEY
            ? 'Для генерации формы оплаты укажите API-ключ RollyPay.'
            : 'Не удалось получить ссылку от RollyPay API. Проверьте правильность API-ключа.'
        });
      }
      return res.status(200).json({
        payUrl,
        orderId,
        amount,
        terminalId: TERMINAL_ID
      });
    }
    const rawBodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(payload);
    if (!verifyRollypaySignature(req, rawBodyStr, SIGNING_SECRET)) {
      console.error('[RollyPay Webhook] Invalid X-Signature header');
      return res.status(403).json({ error: 'Invalid signature' });
    }
    const isPaid = status === 'paid' || event_type === 'payment.paid' || status === 'success';
    if (isPaid) {
      let nick = metadata?.nickname || 'Player';
      const isPassOrder = metadata?.type === 'pass' || (order_id && order_id.includes('-PASS-'));
      if (order_id && order_id.startsWith('ROLLY-')) {
        const parts = order_id.split('-');
        if (parts.length >= 3) {
          nick = parts[2];
        } else if (parts.length >= 2) {
          nick = parts[1];
        }
      }
      updatePlayerVipStatus(nick);
      let mcDelivery = null;
      try {
        if (isPassOrder) {
          mcDelivery = await grantPassInMinecraft(nick);
        } else {
          mcDelivery = await grantVipInMinecraft(nick);
        }
      } catch (err) {
        console.error('[RollyPay Minecraft Grant Error]:', err);
      }
      const itemLabel = isPassOrder ? 'Проходка' : 'VIP статус';
      console.log(`[RollyPay Webhook Success] ${itemLabel} зачислена игроку: ${nick} (Order: ${order_id || 'N/A'})`);
      if (redirect) {
        res.setHeader('Location', `/store?payment=success${isPassOrder ? '&type=pass' : ''}&order=${order_id}&nickname=${encodeURIComponent(nick)}`);
        return res.status(302).end();
      }
      return res.status(200).json({
        status: 'OK',
        message: `${itemLabel} успешно выдан(а) игроку ${nick}`,
        minecraftDelivery: mcDelivery
      });
    }
    return res.status(200).json({ status: 'IGNORED', message: 'Платеж в обработке' });
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
}
