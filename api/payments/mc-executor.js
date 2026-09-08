import net from 'net';

export function sendRconCommand(host, port, password, command) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let authenticated = false;
    let responseData = '';
    const reqId = Math.floor(Math.random() * 100000) + 1;

    socket.setTimeout(6000);

    socket.on('connect', () => {
      sendPacket(socket, reqId, 3, password);
    });

    socket.on('data', (data) => {
      let offset = 0;
      while (offset < data.length) {
        if (data.length - offset < 12) break;
        const length = data.readInt32LE(offset);
        const id = data.readInt32LE(offset + 4);
        const type = data.readInt32LE(offset + 8);
        const body = data.toString('utf8', offset + 12, offset + 4 + length - 2);
        offset += 4 + length;

        if (!authenticated) {
          if (id === -1) {
            socket.destroy();
            return reject(new Error('RCON Authentication Failed (Неверный пароль RCON)'));
          }
          if (type === 2 || type === 0) {
            authenticated = true;
            sendPacket(socket, reqId + 1, 2, command);
          }
        } else {
          responseData += body;
          socket.end();
        }
      }
    });

    socket.on('end', () => {
      resolve(responseData.trim());
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`RCON Таймаут соединения (${host}:${port})`));
    });

    socket.on('error', (err) => {
      reject(new Error(`RCON Ошибка сети: ${err.message}`));
    });

    socket.connect(port, host);
  });
}

function sendPacket(socket, id, type, body) {
  const bodyBuf = Buffer.from(body, 'utf8');
  const length = 4 + 4 + bodyBuf.length + 2;
  const buffer = Buffer.alloc(4 + length);

  buffer.writeInt32LE(length, 0);
  buffer.writeInt32LE(id, 4);
  buffer.writeInt32LE(type, 8);
  bodyBuf.copy(buffer, 12);
  buffer.writeInt8(0, 12 + bodyBuf.length);
  buffer.writeInt8(0, 12 + bodyBuf.length + 1);

  socket.write(buffer);
}

export async function sendPterodactylCommand(panelUrl, apiKey, serverId, command) {
  const cleanUrl = panelUrl.replace(/\/+$/, '');
  const url = `${cleanUrl}/api/client/servers/${serverId}/command`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ command })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Pterodactyl API error (${response.status}): ${text}`);
  }
  return true;
}

export async function grantVipInMinecraft(nickname, options = {}) {
  const nick = (nickname || '').trim();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(nick)) {
    throw new Error('Некорректный никнейм Minecraft (допустимы только буквы, цифры и _, от 3 до 16 символов)');
  }

  const results = [];
  const rawCommands = options.commands || [
    `lp user ${nick} parent addtemp vip 30d`,
    `luckperms user ${nick} parent addtemp vip 30d`,
    `say 🎉 [SamuraiWorld] Игрок ${nick} получил VIP статус на 30 дней! Спасибо за поддержку сервера!`,
    `title ${nick} title {"text":"VIP 30 ДНЕЙ АКТИВИРОВАН!","color":"gold"}`
  ];

  const commands = rawCommands
    .map(cmd => String(cmd).replace(/[\r\n]/g, ' ').trim())
    .filter(Boolean)
    .map(cmd =>
      cmd.replace(/\{player\}/gi, nick)
         .replace(/%player%/gi, nick)
         .replace(/\{nickname\}/gi, nick)
    );

  const pteroUrl = process.env.PTERODACTYL_URL || options.pteroUrl || 'https://qwertyx.host';
  const pteroKey = process.env.PTERODACTYL_API_KEY || '';
  const pteroServerId = process.env.PTERODACTYL_SERVER_ID || options.pteroServerId || '451a0a34';

  if (!pteroKey) {
    results.push({
      driver: 'Pterodactyl API (qwertyx.host)',
      success: false,
      error: 'Ключ PTERODACTYL_API_KEY не добавлен в переменные окружения!'
    });
  } else {
    try {
      for (const cmd of commands) {
        await sendPterodactylCommand(pteroUrl, pteroKey, pteroServerId, cmd);
      }
      results.push({
        driver: 'Pterodactyl API (qwertyx.host)',
        success: true,
        message: `Команда выполнена в консоли сервера для игрока ${nick}!`
      });
    } catch (err) {
      results.push({
        driver: 'Pterodactyl API (qwertyx.host)',
        success: false,
        error: `Ошибка API хостинга: ${err.message}`
      });
    }
  }

  const rconHost = process.env.MINECRAFT_RCON_HOST || '';
  const rconPassword = process.env.MINECRAFT_RCON_PASSWORD || '';
  const portsToTry = process.env.MINECRAFT_RCON_PORT ? [parseInt(process.env.MINECRAFT_RCON_PORT, 10)] : [26800, 25575, 26687];

  if (rconHost && rconPassword) {
    for (const port of portsToTry) {
      try {
        const outputs = [];
        for (const cmd of commands) {
          const out = await sendRconCommand(rconHost, port, rconPassword, cmd);
          outputs.push(out);
        }
        results.push({
          driver: `RCON (${rconHost}:${port})`,
          success: true,
          message: `Команды отправлены игроку ${nick} через RCON!`,
          output: outputs
        });
        break;
      } catch (err) {
        results.push({
          driver: `RCON (${rconHost}:${port})`,
          success: false,
          error: err.message
        });
      }
    }
  }

  return {
    nickname: nick,
    executedAt: new Date().toISOString(),
    driversExecuted: results.length,
    results
  };
}

export async function grantPassInMinecraft(nickname, options = {}) {
  const nick = (nickname || '').trim();
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(nick)) {
    throw new Error('Некорректный никнейм Minecraft (допустимы только буквы, цифры и _, от 3 до 16 символов)');
  }
  const rawCommands = options.commands || [
    `swl add ${nick}`,
    `simplewhitelist add ${nick}`,
    `whitelist add ${nick}`,
    `lp user ${nick} parent set member`,
    `luckperms user ${nick} parent set member`,
    `lp user ${nick} parent add member`,
    `luckperms user ${nick} parent add member`,
    `say 🎉 [SamuraiWorld] Игрок ${nick} получил Проходку на сервер! Добро пожаловать!`,
    `title ${nick} title {"text":"ПРОХОДКА АКТИВИРОВАНА!","color":"aqua"}`
  ];
  return grantVipInMinecraft(nick, { ...options, commands: rawCommands });
}
