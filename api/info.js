export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  return res.status(200).json({
    name: 'SamuraiWorld',
    ip: 'b1.qwertyx.host:26687',
    version: '1.21',
    mode: 'Ванильное выживание',
    description: 'Ванильный Minecraft с политической системой — выбирай президента, принимай законы, строй экономику',
    status: 'online',
    politicalSystem: 'Демократическая Республика',
    playersOnline: 14,
    maxPlayers: 60,
    onlinePlayers: [
      { name: 'Ren4ik284', id: '1', skinUrl: 'https://crafatar.com/avatars/Ren4ik284?overlay=true' },
      { name: 'Mydaf0n62', id: '2', skinUrl: 'https://crafatar.com/avatars/Mydaf0n62?overlay=true' }
    ]
  });
}
