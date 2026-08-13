import crypto from 'crypto';
import { checkRateLimit } from '../security.js';

const TERMINAL_ID = process.env.ROLLYPAY_TERMINAL_ID || 'f59246c9-bd38-4402-9082-6f1350d163fc';
const API_KEY = process.env.ROLLYPAY_API_KEY || 'bwpUuj_o2yTEqou74rTtFy1Yyl9EW54cX6quRxDN2qE';

export default async function handler(req, res) {
  if (!checkRateLimit(req, res, req.method !== 'GET')) return;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
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

    const { nickname } = payload;

    if (!nickname) {
      return res.status(400).json({ message: 'Укажите никнейм игрока' });
    }

    const cleanNick = nickname.trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(cleanNick)) {
      return res.status(400).json({ message: 'Укажите верный игровой никнейм Minecraft (3-16 символов)' });
    }

    const amount = 150;
    const orderId = `ROLLY-PASS-${cleanNick.toUpperCase()}-${Date.now()}`;
    let payUrl = '';

    if (API_KEY) {
      const pPayload = {
        terminal_id: TERMINAL_ID,
        amount: `${amount}.00`,
        payment_currency: 'RUB',
        order_id: orderId,
        description: `Покупка Проходки на SamuraiWorld для ${cleanNick}`,
        success_redirect_url: `https://my-minecraft-site.vercel.app/store?payment=success&type=pass&nickname=${encodeURIComponent(cleanNick)}&order=${orderId}`,
        fail_redirect_url: `https://my-minecraft-site.vercel.app/store?payment=fail&type=pass`,
        metadata: {
          nickname: cleanNick,
          type: 'pass'
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
            console.error(`[RollyPay Pass API Error (${url})]:`, response.status, errText);
          }
        } catch (err) {
          console.error(`[RollyPay Pass API Request Failed (${url})]:`, err);
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

  return res.status(405).json({ error: 'Method Not Allowed' });
}
