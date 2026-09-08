import crypto from 'crypto';
import { grantPassInMinecraft } from './mc-executor.js';
import { checkRateLimit } from '../security.js';

const JWT_SECRET = process.env.JWT_SECRET;
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

function getMasterAdmins() {
  if (process.env.MASTER_ADMINS) {
    return process.env.MASTER_ADMINS.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
  }
  return ['ren4ik284', 'mydaf0n62'];
}

function base64urlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function verifyAccessToken(authHeader) {
  if (!authHeader || !JWT_SECRET) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const token = parts[1];
  try {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = tokenParts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(signatureInput).digest('base64url');
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function isAuthorized(req) {
  const secretHeader = req.headers['x-internal-secret'];
  if (INTERNAL_API_SECRET && secretHeader === INTERNAL_API_SECRET) {
    return true;
  }
  const user = verifyAccessToken(req.headers['authorization'] || req.headers['Authorization']);
  if (!user) return false;
  if (user.role === 'admin') return true;
  return getMasterAdmins().includes((user.nickname || '').toLowerCase());
}

export default async function handler(req, res) {
  if (!checkRateLimit(req, res, req.method !== 'GET')) return;
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Internal-Secret'
  );
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method === 'POST') {
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Прямая выдача привилегий разрешена только Администраторам сервера' });
    }

    let payload = req.body || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) {}
    }
    const { nickname, customCommand } = payload;
    if (!nickname || typeof nickname !== 'string' || !/^[a-zA-Z0-9_]{3,16}$/.test(nickname.trim())) {
      return res.status(400).json({ error: 'Укажите верный игровой никнейм Minecraft (3-16 символов, только латиница/цифры/_)' });
    }
    const cleanNick = nickname.trim();
    const options = {};
    if (customCommand && typeof customCommand === 'string') {
      const sanitized = customCommand.replace(/[\r\n]/g, ' ').trim();
      const formattedCmd = sanitized
        .replace(/\{player\}/gi, cleanNick)
        .replace(/%player%/gi, cleanNick)
        .replace(/\{nickname\}/gi, cleanNick);
      options.commands = [
        formattedCmd,
        `say 🎉 Игрок ${cleanNick} получил Проходку на сервер!`
      ];
    }
    try {
      const execResult = await grantPassInMinecraft(cleanNick, options);
      if (execResult.driversExecuted === 0) {
        return res.status(200).json({
          status: 'CONFIG_NEEDED',
          message: 'Проходка записана в базу, но соединения с сервером не настроены (не указаны PTERODACTYL_API_KEY или MINECRAFT_RCON_PASSWORD).',
          result: execResult
        });
      }
      const hasSuccess = execResult.results.some(r => r.success);
      const errorsList = execResult.results.map(r => r.error).filter(Boolean).join(' | ');
      return res.status(hasSuccess ? 200 : 400).json({
        status: hasSuccess ? 'SUCCESS' : 'ERROR',
        message: hasSuccess
          ? `Проходка успешно активирована в Minecraft для игрока ${cleanNick}!`
          : `Не удалось выполнить команду на сервере: ${errorsList || 'Нет ответа от сервера'}`,
        result: execResult
      });
    } catch (err) {
      return res.status(500).json({ error: 'Ошибка при отправке команды на сервер: ' + err.message });
    }
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
}
