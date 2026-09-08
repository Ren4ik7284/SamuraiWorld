import crypto from 'crypto';
import { grantVipInMinecraft, grantPassInMinecraft } from './mc-executor.js';

const YOOMONEY_SECRET_KEY = process.env.YOOMONEY_SECRET_KEY;

function verifyYooMoneySignature(params) {
  if (!YOOMONEY_SECRET_KEY) {
    // Если секретный ключ ещё не введён в кабинете ЮMoney, логируем предупреждение
    console.warn('[YooMoney Webhook] YOOMONEY_SECRET_KEY не задан в переменных окружения.');
    return true;
  }
  const receivedSha1 = params['sha1_hash'];
  if (!receivedSha1) return false;

  const sha1String = [
    params['notification_type'] || '',
    params['operation_id'] || '',
    params['amount'] || '',
    params['currency'] || '',
    params['datetime'] || '',
    params['sender'] || '',
    params['codepro'] || '',
    YOOMONEY_SECRET_KEY,
    params['label'] || '',
  ].join('&');

  const expectedSha1 = crypto.createHash('sha1').update(sha1String, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSha1, 'hex'), Buffer.from(receivedSha1, 'hex'));
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let params = req.body || {};
  if (typeof params === 'string') {
    try {
      params = JSON.parse(params);
    } catch (e) {
      const sp = new URLSearchParams(params);
      params = Object.fromEntries(sp.entries());
    }
  }

  if (!verifyYooMoneySignature(params)) {
    return res.status(403).json({ error: 'Invalid YooMoney signature' });
  }

  if (params['test_notification'] === 'true') {
    return res.status(200).json({ status: 'OK', message: 'Тестовое уведомление принято' });
  }

  if (params['unaccepted'] === 'true') {
    return res.status(200).json({ status: 'IGNORED', message: 'Перевод захолдирован' });
  }

  const orderId = (params['label'] || '').trim();
  const amount = parseFloat(params['amount'] || '0');

  // Защита от фейковых платежей меньше 35 руб
  if (amount < 35) {
    return res.status(200).json({ status: 'IGNORED', message: 'Сумма меньше минимальной' });
  }

  if (!orderId) {
    return res.status(200).json({ status: 'IGNORED', message: 'Label отсутствует' });
  }

  const vipMatch = orderId.match(/^YM-VIP-([A-Za-z0-9_]+)-\d+$/i);
  const passMatch = orderId.match(/^YM-PASS-([A-Za-z0-9_]+)-\d+$/i);

  try {
    if (vipMatch) {
      const playerNick = vipMatch[1];
      await grantVipInMinecraft(playerNick);
      return res.status(200).json({ status: 'SUCCESS', message: `VIP выдан игроку ${playerNick}` });
    } else if (passMatch) {
      const playerNick = passMatch[1];
      await grantPassInMinecraft(playerNick);
      return res.status(200).json({ status: 'SUCCESS', message: `Проходка выдана игроку ${playerNick}` });
    }
  } catch (err) {
    console.error('[YooMoney Webhook Exec Error]:', err.message);
  }

  return res.status(200).json({ status: 'OK', orderId });
}
