import net from 'net';

/**
 * Node.js Native RCON Client over TCP (Source RCON Protocol)
 */
export function sendRconCommand(host, port, password, command) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let authenticated = false;
    let responseData = '';
    const reqId = Math.floor(Math.random() * 100000) + 1;

    socket.setTimeout(6000);

    socket.on('connect', () => {
      // Step 1: Send Auth Packet (Type 3: SERVERDATA_AUTH)
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
            return reject(new Error('RCON Authentication Failed (Неверный пароль RCON в server.properties)'));
          }
          if (type === 2 || type === 0) {
            authenticated = true;
            // Step 2: Send Command Packet (Type 2: SERVERDATA_EXECCOMMAND)
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

/**
 * Pterodactyl / qwertyx.host Client API Command Dispatcher
 */
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

/**
 * Master VIP Grant function: tries Pterodactyl API first, then RCON.
 */
export async function grantVipInMinecraft(nickname, options = {}) {
  const nick = nickname.trim();
  const results = [];

  // Commands executed to grant VIP rank and announce it in game
  const commands = options.commands || [
    `luckperms user ${nick} parent add vip`,
    `lp user ${nick} parent add vip`,
    `manuadd ${nick} vip`,
    `say 🎉 [SamuraiWorld] Игрок ${nick} получил VIP статус! Спасибо за поддержку сервера!`,
    `title ${nick} title {"text":"VIP АКТИВИРОВАН!","color":"gold"}`
  ];

  // 1. Try Pterodactyl API (qwertyx.host)
  const pteroUrl = options.pteroUrl || process.env.PTERODACTYL_URL || 'https://qwertyx.host';
  const pteroKey = options.pteroKey || process.env.PTERODACTYL_API_KEY;
  const pteroServerId = options.pteroServerId || process.env.PTERODACTYL_SERVER_ID;

  if (pteroKey && pteroServerId) {
    try {
      for (const cmd of commands) {
        await sendPterodactylCommand(pteroUrl, pteroKey, pteroServerId, cmd);
      }
      results.push({
        driver: 'Pterodactyl API (qwertyx.host)',
        success: true,
        message: `VIP выдана игроку ${nick} через консоль хостинга!`
      });
    } catch (err) {
      results.push({
        driver: 'Pterodactyl API (qwertyx.host)',
        success: false,
        error: err.message
      });
    }
  }

  // 2. Try RCON
  const rconHost = options.rconHost || process.env.MINECRAFT_RCON_HOST;
  const rconPort = parseInt(options.rconPort || process.env.MINECRAFT_RCON_PORT || '25575', 10);
  const rconPassword = options.rconPassword || process.env.MINECRAFT_RCON_PASSWORD;

  if (rconHost && rconPassword) {
    try {
      const outputs = [];
      for (const cmd of commands) {
        const out = await sendRconCommand(rconHost, rconPort, rconPassword, cmd);
        outputs.push(out);
      }
      results.push({
        driver: 'RCON',
        success: true,
        message: `VIP выдана игроку ${nick} через RCON!`,
        output: outputs
      });
    } catch (err) {
      results.push({
        driver: 'RCON',
        success: false,
        error: err.message
      });
    }
  }

  return {
    nickname: nick,
    executedAt: new Date().toISOString(),
    driversExecuted: results.length,
    results
  };
}
