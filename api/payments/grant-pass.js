import { grantPassInMinecraft } from './mc-executor.js';
import { checkRateLimit } from '../security.js';
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
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) {}
    }
    const { nickname, pteroKey, pteroServerId, pteroUrl, rconHost, rconPort, rconPassword, customCommand } = payload;
    if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 3) {
      return res.status(400).json({ error: 'Укажите правильный игровой никнейм Minecraft' });
    }
    const cleanNick = nickname.trim();
    const options = {};
    if (pteroKey) options.pteroKey = pteroKey;
    if (pteroServerId) options.pteroServerId = pteroServerId;
    if (pteroUrl) options.pteroUrl = pteroUrl;
    if (rconHost) options.rconHost = rconHost;
    if (rconPort) options.rconPort = rconPort;
    if (rconPassword) options.rconPassword = rconPassword;
    if (customCommand) {
      const formattedCmd = customCommand
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
          message: 'Проходка записана в базу, но соединения с сервером не настроены (не указаны PTERODACTYL_API_KEY или MINECRAFT_RCON_PASSWORD в Vercel).',
          result: execResult
        });
      }
      const hasSuccess = execResult.results.some(r => r.success);
      const errorsList = execResult.results.map(r => r.error).filter(Boolean).join(' | ');
      return res.status(hasSuccess ? 200 : 400).json({
        status: hasSuccess ? 'SUCCESS' : 'ERROR',
        message: hasSuccess
          ? `Проходка успешно активирована в Minecraft для игрока ${cleanNick} (команда swl add)!`
          : `Не удалось выполнить команду на сервере: ${errorsList || 'Нет ответа от сервера'}`,
        result: execResult
      });
    } catch (err) {
      return res.status(500).json({ error: 'Ошибка при отправке команды на сервер: ' + err.message });
    }
  }
  return res.status(405).json({ error: 'Method Not Allowed' });
}
