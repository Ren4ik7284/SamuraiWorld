import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { NewsItemDto } from './dto/news-item.dto';
import { CreateNewsDto } from './dto/create-news.dto';
@Injectable()
export class NewsService {
  private news: NewsItemDto[] = [
    {
      id: uuidv4(),
      title: 'SamuraiWorld открыт — начинается новая эпоха!',
      content: 'Сервер запущен. Мир чист, ресурсы нетронуты. Именно сейчас решается, кто станет первым президентом и какие законы будут действовать.',
      date: new Date().toISOString().split('T')[0],
      tag: 'Открытие',
    },
    {
      id: uuidv4(),
      title: 'Первые выборы президента уже скоро',
      content: 'Через неделю после старта сервера состоятся первые президентские выборы. Успей собрать поддержку, создать партию и объявить свою программу.',
      date: new Date().toISOString().split('T')[0],
      tag: 'Политика',
    },
    {
      id: uuidv4(),
      title: 'Система документооборота в разработке',
      content: 'Паспорт гражданина, лицензия на бизнес, договоры аренды и труда — всё появится в ближайшем обновлении. Готовьтесь строить государство.',
      date: new Date().toISOString().split('T')[0],
      tag: 'Анонс',
    },
  ];
  findAll(): NewsItemDto[] {
    return [...this.news].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }
  findOne(id: string): NewsItemDto {
    const item = this.news.find((n) => n.id === id);
    if (!item) throw new NotFoundException(`Новость с id ${id} не найдена`);
    return { ...item };
  }
  create(dto: CreateNewsDto): NewsItemDto {
    const newItem: NewsItemDto = {
      id: uuidv4(),
      title: dto.title,
      content: dto.content,
      tag: dto.tag,
      date: new Date().toISOString().split('T')[0],
    };
    this.news.unshift(newItem);
    return { ...newItem };
  }
  remove(id: string): void {
    const index = this.news.findIndex((n) => n.id === id);
    if (index === -1) throw new NotFoundException(`Новость с id ${id} не найдена`);
    this.news.splice(index, 1);
  }
}
