import { checkRateLimit } from '../security.js';
import { grantVipInMinecraft, grantPassInMinecraft } from './mc-executor.js';

const YOOMONEY_ACCESS_TOKEN = process.env.YOOMONEY_ACCESS_TOKEN;
const grantedOrders = new Set();

export default async function handler(req, res) {
  if (!checkRateLimit(req, res, false)) return;
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let orderId = req.query?.orderId || req.query?.id;
  if (!orderId) {
    const parts = (req.url || '').split('?')[0].split('/').filter(Boolean);
    orderId = parts[parts.length - 1];
    if (orderId === 'check-payment' || orderId === 'check-payment.js') {
      orderId = null;
    }
  }

  if (!orderId) {
    return res.status(400).json({ error: 'Укажите orderId для проверки платежа' });
  }

  const cleanOrderId = String(orderId).trim();

  if (YOOMONEY_ACCESS_TOKEN) {
    try {
      const params = new URLSearchParams({
        type: 'deposition',
        label: cleanOrderId,
        records: '10',
      });
      const resp = await fetch('https://yoomoney.ru/api/operation-history', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${YOOMONEY_ACCESS_TOKEN}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (resp.ok) {
        const data = await resp.json();
        const operations = data.operations || [];
        const found = operations.find((op) => op.label === cleanOrderId && op.status === 'success');

        if (found) {
          if (!grantedOrders.has(cleanOrderId)) {
            grantedOrders.add(cleanOrderId);
            const isPass = cleanOrderId.includes('-PASS-');
            const nickMatch = cleanOrderId.match(/YM-(?:VIP|PASS)-([A-Za-z0-9_]+)-\d+/i);
            const playerNick = nickMatch ? nickMatch[1] : null;
            if (playerNick) {
              try {
                if (isPass) {
                  await grantPassInMinecraft(playerNick);
                } else {
                  await grantVipInMinecraft(playerNick);
                }
              } catch (e) {
                console.error('[CheckPayment AutoGrant] Error:', e.message);
              }
            }
          }

          return res.status(200).json({
            orderId: cleanOrderId,
            isPaid: true,
            message: 'Платёж подтверждён! Привилегия успешно активирована в игре.',
          });
        }
      }
    } catch (e) {
      console.warn('[CheckPayment] YooMoney API error:', e.message);
    }
  }

  const alreadyGranted = grantedOrders.has(cleanOrderId);
  return res.status(200).json({
    orderId: cleanOrderId,
    isPaid: alreadyGranted,
    message: alreadyGranted
      ? 'Платёж подтверждён! Привилегия успешно активирована в игре.'
      : 'Платёж обрабатывается платежной системой ЮMoney.',
  });
}
