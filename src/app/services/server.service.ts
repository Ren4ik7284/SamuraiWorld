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
  politicalSystem?: string;
  playersOnline?: number;
  maxPlayers?: number;
  latencyMs?: number;
  onlinePlayers?: Array<{ name: string; id: string; skinUrl: string }>;
}

export interface Rule {
  id: number;
  category: string;
  title: string;
  description: string;
  svgIcon?: string;
}

export interface NewsItem {
  id: string | number;
  title: string;
  content: string;
  date: string;
  tag: string;
  author?: string;
}

export interface Citizen {
  id: string;
  username: string;
  passportNumber: string;
  role: string;
  partyName?: string;
  registeredAt: string;
  status: string;
  skinUrl: string;
  netWorth: number;
}

export interface Law {
  id: number;
  title: string;
  category: string;
  author: string;
  passedDate: string;
  status: string;
  summary: string;
}

export interface Party {
  id: string;
  name: string;
  tag: string;
  leader: string;
  ideology: string;
  membersCount: number;
  color: string;
}

@Injectable({ providedIn: 'root' })
export class ServerService {
  private apiUrl = '/api';

  private defaultServerInfo: ServerInfo = {
    name: 'SamuraiWorld',
    ip: 'play.samuraiworld.ru',
    version: '1.21',
    mode: 'Ванильное выживание',
    description: 'Ванильный Minecraft с политической системой — выбирай президента, принимай законы, строй экономику',
    status: 'online',
    politicalSystem: 'Демократическая Республика',
    playersOnline: 14,
    maxPlayers: 60,
    onlinePlayers: [
      { name: 'Shogun_Kenji', id: '1', skinUrl: 'https://crafatar.com/avatars/Shogun_Kenji?overlay=true' },
      { name: 'President_Alex', id: '2', skinUrl: 'https://crafatar.com/avatars/President_Alex?overlay=true' },
      { name: 'Miner_Joe', id: '3', skinUrl: 'https://crafatar.com/avatars/Miner_Joe?overlay=true' }
    ]
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

  getCitizens(): Observable<Citizen[]> {
    return this.http.get<Citizen[]>(`${this.apiUrl}/government/citizens`).pipe(
      catchError(() => of([
        {
          id: 'c1',
          username: 'Shogun_Kenji',
          passportNumber: 'SW-0001-JP',
          role: 'Президент',
          partyName: 'Партия Самурайского Единства',
          registeredAt: '2025-08-01',
          status: 'Активен',
          skinUrl: 'https://crafatar.com/avatars/Shogun_Kenji?overlay=true',
          netWorth: 154000
        },
        {
          id: 'c2',
          username: 'President_Alex',
          passportNumber: 'SW-0002-RU',
          role: 'Министр',
          partyName: 'Либерально-Демократическая Партия',
          registeredAt: '2025-08-02',
          status: 'Активен',
          skinUrl: 'https://crafatar.com/avatars/President_Alex?overlay=true',
          netWorth: 89000
        }
      ]))
    );
  }

  getLaws(): Observable<Law[]> {
    return this.http.get<Law[]>(`${this.apiUrl}/government/laws`).pipe(
      catchError(() => of([
        {
          id: 1,
          title: 'Закон о свободе торговли и предпринимательства',
          category: 'Гражданский кодекс',
          author: 'Shogun_Kenji',
          passedDate: '2025-08-02',
          status: 'Действует',
          summary: 'Разрешает игрокам создавать независимые магазины и заключать контракты.'
        }
      ]))
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
      { id: '1', title: 'SamuraiWorld открыт — начинается новая эпоха!', content: 'Сервер запущен. Мир чист, ресурсы нетронуты. Именно сейчас решается, кто станет первым президентом и какие законы будут действовать.', date: '2025-08-01', tag: 'Открытие', author: 'Администрация' },
      { id: '2', title: 'Первые выборы президента уже скоро', content: 'Через неделю после старта сервера состоятся первые президентские выборы. Успей собрать поддержку, создать партию и объявить свою программу.', date: '2025-08-03', tag: 'Политика', author: 'Избирком' },
      { id: '3', title: 'Документооборот и гражданство в разработке', content: 'Система игровых документов — паспорт, лицензия на бизнес, договоры — добавлена в API.', date: '2025-08-04', tag: 'Анонс', author: 'Разработчики' }
    ];
  }
}
