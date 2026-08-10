export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  return res.status(200).json([
    { id: '1', title: 'SamuraiWorld открыт — начинается новая эпоха!', content: 'Сервер запущен. Мир чист, ресурсы нетронуты. Именно сейчас решается, кто станет первым президентом и какие законы будут действовать.', date: '2025-08-01', tag: 'Открытие', author: 'Администрация' },
    { id: '2', title: 'Первые выборы президента уже скоро', content: 'Через неделю после старта сервера состоятся первые президентские выборы. Успей собрать поддержку, создать партию и объявить свою программу.', date: '2025-08-03', tag: 'Политика', author: 'Избирком' },
    { id: '3', title: 'Документооборот и гражданство в разработке', content: 'Система игровых документов — паспорт, лицензия на бизнес, договоры — добавлена в API.', date: '2025-08-04', tag: 'Анонс', author: 'Разработчики' }
  ]);
}
