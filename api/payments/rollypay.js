import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SHOP_ID = process.env.ROLLYPAY_SHOP_ID || 'TEST_SHOP_SAMURAI_2026';
const SECRET_KEY = process.env.ROLLYPAY_SECRET_KEY || 'TEST_SECRET_KEY_SAMURAI_2026';
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
        plainPassword: 'Покупка VIP',
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
    console.error('Error updating VIP status:', e);
    return null;
  }
}

export default function handler(req, res) {
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

  // 1. POST /api/payments/rollypay/create — Создание счета
  if (method === 'POST' && pathName.endsWith('/create')) {
    const { nickname, promoCode } = body || {};
    if (!nickname || !/^[a-zA-Z0-9_]{3,16}$/.test(nickname.trim())) {
      return res.status(400).json({ message: 'Укажите верный игровой никнейм Minecraft (3-16 символов)' });
    }

    let amount = 200;
    const cleanPromo = (promoCode || '').trim().toUpperCase();
    if (cleanPromo === 'SAMURAI' || cleanPromo === 'ROLLY') {
      amount = 180; // 10% discount
    } else if (cleanPromo === 'START') {
      amount = 170; // 15% discount
    }

    const orderId = `ROLLY-${nickname.trim().toUpperCase()}-${Date.now()}`;
    const isTestMode = !process.env.ROLLYPAY_SHOP_ID;

    // Цифровая подпись (MD5) по регламенту RollyPay
    const signStr = `${SHOP_ID}:${amount}:${orderId}:${SECRET_KEY}`;
    const signature = crypto.createHash('md5').update(signStr).digest('hex');

    if (isTestMode) {
      // В тестовом режиме открываем эмулированную страницу оплаты RollyPay
      const testPayUrl = `/api/payments/rollypay/test-pay?order_id=${encodeURIComponent(orderId)}&nickname=${encodeURIComponent(nickname.trim())}&amount=${amount}&sign=${signature}`;
      return res.status(200).json({
        payUrl: testPayUrl,
        orderId,
        amount,
        isTestMode: true,
        message: 'Тестовый режим RollyPay активен'
      });
    }

    // Рабочий режим: реальный шлюз RollyPay
    const realPayUrl = `https://rollypay.com/pay?shop_id=${SHOP_ID}&amount=${amount}&order_id=${encodeURIComponent(orderId)}&desc=${encodeURIComponent('VIP подписка SamuraiWorld для ' + nickname)}&sign=${signature}`;
    return res.status(200).json({
      payUrl: realPayUrl,
      orderId,
      amount,
      isTestMode: false
    });
  }

  // 2. GET /api/payments/rollypay/test-pay — Тестовая страница симулятора оплаты RollyPay
  if (method === 'GET' && pathName.endsWith('/test-pay')) {
    const { order_id, nickname, amount, sign } = query || {};
    const html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RollyPay Sandbox — Тестовая Оплата</title>
      <style>
        body { background: #0b0608; color: #f8fafc; font-family: 'Segoe UI', system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .card { background: #160c11; border: 1px solid rgba(212, 160, 23, 0.3); border-radius: 16px; width: 100%; max-width: 440px; padding: 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.8); text-align: center; }
        .logo { font-size: 1.5rem; font-weight: 800; color: #fde047; letter-spacing: -0.5px; margin-bottom: 20px; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .badge { background: #c0392b; color: #fff; font-size: 0.7rem; padding: 3px 8px; border-radius: 6px; font-weight: 700; text-transform: uppercase; }
        .amount-box { background: rgba(192, 57, 43, 0.12); border: 1px solid rgba(192, 57, 43, 0.3); padding: 16px; border-radius: 12px; margin: 16px 0; }
        .amount { font-size: 2.2rem; font-weight: 800; color: #fde047; }
        .details { text-align: left; background: #0b0608; padding: 14px; border-radius: 10px; margin-bottom: 20px; font-size: 0.88rem; color: #94a3b8; border: 1px solid rgba(255,255,255,0.06); }
        .details div { margin-bottom: 6px; display: flex; justify-content: space-between; }
        .details strong { color: #f1f5f9; }
        .btn { width: 100%; padding: 14px; border: none; border-radius: 10px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: all 0.2s; }
        .btn-success { background: #22c55e; color: #fff; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.4); margin-bottom: 10px; }
        .btn-success:hover { background: #16a34a; transform: translateY(-1px); }
        .btn-cancel { background: transparent; color: #64748b; border: 1px solid #334155; }
        .btn-cancel:hover { background: #334155; color: #f1f5f9; }
        .alert { background: rgba(234, 179, 8, 0.15); border: 1px solid rgba(234, 179, 8, 0.3); color: #fde047; font-size: 0.8rem; padding: 10px; border-radius: 8px; margin-bottom: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">
          <span>💳 RollyPay</span>
          <span class="badge">TEST MODE</span>
        </div>
        
        <div class="alert">
          ℹ️ Это тестовый эмулятор оплаты RollyPay. Реальные деньги списаны не будут.
        </div>

        <div class="amount-box">
          <div style="font-size: 0.85rem; color: #94a3b8;">Сумма к оплате</div>
          <div class="amount">${amount || 200} ₽</div>
        </div>

        <div class="details">
          <div><span>Магазин:</span> <strong>SamuraiWorld Minecraft</strong></div>
          <div><span>Игрок:</span> <strong>${nickname || 'Игрок'}</strong></div>
          <div><span>Товар:</span> <strong>VIP подписка (Логи сундуков)</strong></div>
          <div><span>Заказ ID:</span> <strong style="font-family: monospace;">${order_id || 'ROLLY-TEST'}</strong></div>
        </div>

        <form action="/api/payments/rollypay/webhook" method="POST">
          <input type="hidden" name="shop_id" value="${SHOP_ID}">
          <input type="hidden" name="amount" value="${amount || 100}">
          <input type="hidden" name="order_id" value="${order_id}">
          <input type="hidden" name="status" value="success">
          <input type="hidden" name="sign" value="${sign}">
          <input type="hidden" name="redirect" value="true">
          
          <button type="submit" class="btn btn-success">✅ Подтвердить тестовую оплату</button>
        </form>
        <button type="button" class="btn btn-cancel" onclick="window.close(); history.back();">Отмена</button>
      </div>
    </body>
    </html>
    `;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  // 3. POST /api/payments/rollypay/webhook — Прием уведомлений об оплате
  if (method === 'POST' && pathName.endsWith('/webhook')) {
    let payload = body || {};
    
    // Если приходит URL-encoded форма с тестовой страницы
    if (typeof body === 'string') {
      const params = new URLSearchParams(body);
      payload = Object.fromEntries(params.entries());
    }

    const { shop_id, amount, order_id, status, sign, redirect } = payload;

    // Проверка сигнатуры
    const signStr = `${shop_id || SHOP_ID}:${amount}:${order_id}:${SECRET_KEY}`;
    const expectedSign = crypto.createHash('md5').update(signStr).digest('hex');

    if (sign && sign !== expectedSign) {
      console.warn('[RollyPay Webhook] Invalid signature!');
    }

    if (status === 'success' || status === 'paid' || !status) {
      // Извлекаем никнейм из order_id: ROLLY-NICKNAME-TIMESTAMP
      let nickname = 'Player';
      if (order_id && order_id.startsWith('ROLLY-')) {
        const parts = order_id.split('-');
        if (parts.length >= 2) {
          nickname = parts[1];
        }
      }

      // Выдаем VIP в БД
      updatePlayerVipStatus(nickname);
      console.log(`[RollyPay Webhook Success] VIP зачислен игроку: ${nickname}`);

      if (redirect) {
        // Редиректим игрока обратно на страницу магазина с флагом успеха
        res.setHeader('Location', `/store?payment=success&order=${order_id}&nickname=${encodeURIComponent(nickname)}`);
        return res.status(302).end();
      }

      return res.status(200).json({ status: 'OK', message: `VIP успешно выдан игроку ${nickname}` });
    }

    return res.status(200).json({ status: 'IGNORED', message: 'Платеж не был завершен' });
  }

  return res.status(404).json({ message: 'Endpoint not found' });
}
