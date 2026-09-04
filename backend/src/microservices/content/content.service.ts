import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
export interface NewsItem {
  id: string;
  title: string;
  content: string;
  date: string;
  tag: string;
  author?: string;
}
export interface RuleItem {
  id: number;
  category: string;
  title: string;
  description: string;
}
@Injectable()
export class ContentService {
  private news: NewsItem[] = [
    {
      id: uuidv4(),
      title: 'SamuraiWorld открыт — начинается новая эпоха!',
      content: 'Сервер запущен. Мир чист, ресурсы нетронуты. Именно сейчас решается, кто станет первым президентом и какие законы будут действовать.',
      date: new Date().toISOString().split('T')[0],
      tag: 'Открытие',
      author: 'Администрация SamuraiWorld',
    },
    {
      id: uuidv4(),
      title: 'Первые президентские выборы уже близко!',
      content: 'Через неделю после старта сервера состоятся первые президентские выборы. Успей собрать поддержку, создать партию и объявить программу.',
      date: new Date().toISOString().split('T')[0],
      tag: 'Политика',
      author: 'Избирательная Комиссия',
    },
    {
      id: uuidv4(),
      title: 'Система документооборота и паспортов запущены',
      content: 'Паспорт гражданина, лицензия на бизнес, договоры аренды и труда — всё доступно в вашем профиле.',
      date: new Date().toISOString().split('T')[0],
      tag: 'Анонс',
      author: 'Разработчики',
    },
  ];
  private rules: RuleItem[] = [
    { id: 1, category: 'Политика', title: 'Честные выборы', description: 'Запрещено принуждать других игроков голосовать за кандидата. Выборы должны быть свободными и прозрачными.' },
    { id: 2, category: 'Политика', title: 'Уважай законы', description: 'Законы, принятые правительством, обязательны для всех. Нарушение — дело для суда или импичмента.' },
    { id: 3, category: 'Экономика', title: 'Честная торговля', description: 'Мошенничество при торговле, фальшивые документы и скам запрещены.' },
    { id: 4, category: 'Экономика', title: 'Налоги', description: 'Каждый игрок обязан платить налоги государству. Ставку устанавливает правительство.' },
    { id: 5, category: 'Общество', title: 'Уважай других', description: 'Гриферство, оскорбления и токсичное поведение наказываются — как администрацией, так и игровым судом.' },
    { id: 6, category: 'Общество', title: 'Без читов', description: 'Использование читов, дюпов и эксплойтов — бессрочный бан.' },
  ];
  getNews(): NewsItem[] {
    return [...this.news].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  getNewsById(id: string): NewsItem {
    const item = this.news.find((n) => n.id === id);
    if (!item) throw new NotFoundException(`Новость ${id} не найдена`);
    return item;
  }
  createNews(dto: { title: string; content: string; tag: string; author?: string }): NewsItem {
    const newItem: NewsItem = {
      id: uuidv4(),
      title: dto.title,
      content: dto.content,
      tag: dto.tag,
      author: dto.author ?? 'Администрация',
      date: new Date().toISOString().split('T')[0],
    };
    this.news.unshift(newItem);
    return newItem;
  }
  getRules(): RuleItem[] {
    return this.rules;
  }
}
