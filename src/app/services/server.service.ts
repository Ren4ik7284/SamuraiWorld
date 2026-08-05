import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface ServerInfo {
  name: string;
  ip: string;
  version: string;
  mode: string;
  description: string;
  status: 'online' | 'offline';
}

export interface Rule {
  id: number;
  category: string;
  title: string;
  description: string;
  svgIcon?: string;
}

export interface NewsItem {
  id: number;
  title: string;
  content: string;
  date: string;
  tag: string;
}

@Injectable({ providedIn: 'root' })
export class ServerService {
  private apiUrl = 'http://localhost:3000/api';

  private defaultServerInfo: ServerInfo = {
    name: 'SamuraiWorld',
    ip: 'play.samuraiworld.ru',
    version: '1.21',
    mode: 'Ванильное выживание',
    description: 'Ванильный Minecraft с политической системой — выбирай президента, принимай законы, строй экономику',
    status: 'online'
  };

  constructor(private http: HttpClient) {}

  getServerInfo(): Observable<ServerInfo> {
    return this.http.get<ServerInfo>(`${this.apiUrl}/info`).pipe(
      catchError(() => of(this.defaultServerInfo))
    );
  }

  getRules(): Observable<Rule[]> {
    return this.http.get<Rule[]>(`${this.apiUrl}/rules`).pipe(
      catchError(() => of(this.getDefaultRules()))
    );
  }

  getNews(): Observable<NewsItem[]> {
    return this.http.get<NewsItem[]>(`${this.apiUrl}/news`).pipe(
      catchError(() => of(this.getDefaultNews()))
    );
  }

  private getDefaultRules(): Rule[] {
    return [
      { id: 1, category: 'Политика', title: 'Честные выборы', description: 'Запрещено принуждать других игроков голосовать за кандидата. Выборы должны быть свободными и прозрачными.' },
      { id: 2, category: 'Политика', title: 'Уважай законы', description: 'Законы, принятые правительством, обязательны для всех. Нарушение — дело для суда или импичмента.' },
      { id: 3, category: 'Экономика', title: 'Честная торговля', description: 'Мошенничество при торговле, фальшивые документы и скам запрещены. За нарушение — штраф или арест.' },
      { id: 4, category: 'Экономика', title: 'Налоги', description: 'Каждый игрок обязан платить налоги государству. Ставку устанавливает правительство. Уклонение — нарушение.' },
      { id: 5, category: 'Общество', title: 'Уважай других', description: 'Гриферство, оскорбления и токсичное поведение наказываются — как администрацией, так и игровым судом.' },
      { id: 6, category: 'Общество', title: 'Без читов', description: 'Использование читов, дюпов и эксплойтов — бан. Это разрушает экономику и политическую систему сервера.' }
    ];
  }

  private getDefaultNews(): NewsItem[] {
    return [
      { id: 1, title: 'SamuraiWorld открыт — начинается новая эпоха!', content: 'Сервер запущен. Мир чист, ресурсы нетронуты. Именно сейчас решается, кто станет первым президентом и какие законы будут действовать.', date: '2025-08-01', tag: 'Открытие' },
      { id: 2, title: 'Первые выборы президента уже скоро', content: 'Через неделю после старта сервера состоятся первые президентские выборы. Успей собрать поддержку, создать партию и объявить свою программу.', date: '2025-08-03', tag: 'Политика' },
      { id: 3, title: 'Документооборот и гражданство в разработке', content: 'Система игровых документов — паспорт, лицензия на бизнес, договоры — будет добавлена в ближайшем обновлении. Готовьтесь строить государство.', date: '2025-08-04', tag: 'Анонс' }
    ];
  }
}
