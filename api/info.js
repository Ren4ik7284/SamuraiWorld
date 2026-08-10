export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let isOnline = false;
  let onlinePlayersCount = 0;
  let maxPlayersCount = 60;
  let motdText = 'Ванильный Minecraft с политической системой';
  let serverVersion = '1.21.4';
  let onlinePlayerList = [];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const response = await fetch('https://api.mcstatus.io/v2/status/java/b1.qwertyx.host:26687', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      isOnline = Boolean(data.online);
      if (isOnline && data.players) {
        onlinePlayersCount = data.players.online || 0;
        maxPlayersCount = data.players.max || 60;
        if (Array.isArray(data.players.list)) {
          onlinePlayerList = data.players.list.map((p, idx) => ({
            name: p.name_clean || p.name || 'Игрок',
            id: String(idx + 1),
            skinUrl: `https://crafatar.com/avatars/${encodeURIComponent(p.name_clean || p.name)}?overlay=true`
          }));
        }
      }
      if (data.version && data.version.name_clean) {
        serverVersion = data.version.name_clean.replace('Vanilla by MrDrag0nXYT ', '');
      }
      if (data.motd && data.motd.clean) {
        motdText = data.motd.clean.trim();
      }
    }
  } catch (e) {
    isOnline = false;
  }

  return res.status(200).json({
    name: 'SamuraiWorld',
    ip: 'b1.qwertyx.host:26687',
    version: serverVersion,
    mode: 'Ванильное выживание',
    description: motdText,
    status: isOnline ? 'online' : 'offline',
    statusText: isOnline ? 'ОТКРЫТ (ОНЛАЙН)' : 'ЗАКРЫТ (ТЕХРАБОТЫ)',
    politicalSystem: 'Демократическая Республика',
    playersOnline: onlinePlayersCount,
    maxPlayers: maxPlayersCount,
    hardware: {
      cpu: 'AMD Ryzen 7 5700X (3 ядра)',
      ram: '8 ГБ DDR4',
      storage: '80 ГБ M.2 NVMe'
    },
    onlinePlayers: onlinePlayerList
  });
}
