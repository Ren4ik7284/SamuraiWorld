import { checkRateLimit } from '../security.js';
const YOOMONEY_WALLET = process.env.YOOMONEY_WALLET || '4100119307511784';
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
    const amount = 50;
    const orderId = `YM-PASS-${cleanNick.toUpperCase()}-${Date.now()}`;
    const params = new URLSearchParams({
      receiver: YOOMONEY_WALLET,
      'quickpay-form': 'shop',
      targets: `Покупка Проходки на сервер SamuraiWorld для ${cleanNick}`,
      paymentType: 'AC',
      sum: amount.toFixed(2),
      label: orderId,
      successURL: `https://samuraiworld.ru/store?payment=success&type=pass&nickname=${encodeURIComponent(cleanNick)}&order=${encodeURIComponent(orderId)}`,
    });
    const payUrl = `https://yoomoney.ru/quickpay/confirm?${params.toString()}`;
    return res.status(200).json({
      payUrl,
      orderId,
      amount,
      wallet: YOOMONEY_WALLET,
      message: 'Ссылка на оплату Проходки через ЮMoney сгенерирована',
    });
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
}
