import { Injectable, NotFoundException } from '@nestjs/common';
export interface Citizen {
  id: string;
  username: string;
  uuid: string;
  passportNumber: string;
  role: 'Президент' | 'Министр' | 'Судья' | 'Депутат' | 'Гражданин';
  partyName?: string;
  registeredAt: string;
  status: 'Активен' | 'В розыске' | 'Заблокирован';
  skinUrl: string;
  netWorth: number; 
}
export interface Law {
  id: number;
  title: string;
  category: 'Конституция' | 'Уголовный кодекс' | 'Налоговый кодекс' | 'Гражданский кодекс';
  author: string;
  passedDate: string;
  status: 'Действует' | 'На рассмотрении' | 'Отменен';
  summary: string;
}
export interface PoliticalParty {
  id: string;
  name: string;
  tag: string;
  leader: string;
  ideology: string;
  membersCount: number;
  color: string;
}
export interface Election {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: 'Идет голосование' | 'Предвыборная гонка' | 'Завершены';
  candidates: Array<{ name: string; party: string; votes: number }>;
}
@Injectable()
export class GovernmentService {
  private citizens: Citizen[] = [
    {
      id: 'c1',
      username: 'Shogun_Kenji',
      uuid: 'd8c4749f-e3c3-4d69-897e-123456789abc',
      passportNumber: 'SW-0001-JP',
      role: 'Президент',
      partyName: 'Партия Самурайского Единства',
      registeredAt: '2025-08-01',
      status: 'Активен',
      skinUrl: 'https://crafatar.com/avatars/Shogun_Kenji?overlay=true',
      netWorth: 154000,
    },
    {
      id: 'c2',
      username: 'President_Alex',
      uuid: 'a1b2c3d4-e5f6-7890-1234-56789abcdef0',
      passportNumber: 'SW-0002-RU',
      role: 'Министр',
      partyName: 'Либерально-Демократическая Партия',
      registeredAt: '2025-08-02',
      status: 'Активен',
      skinUrl: 'https://crafatar.com/avatars/President_Alex?overlay=true',
      netWorth: 89000,
    },
    {
      id: 'c3',
      username: 'Miner_Joe',
      uuid: 'feefefef-1234-5678-90ab-cdef01234567',
      passportNumber: 'SW-0003-US',
      role: 'Гражданин',
      partyName: undefined,
      registeredAt: '2025-08-03',
      status: 'Активен',
      skinUrl: 'https://crafatar.com/avatars/Miner_Joe?overlay=true',
      netWorth: 12500,
    },
  ];
  private laws: Law[] = [
    {
      id: 1,
      title: 'Закон о свободе торговли и предпринимательства',
      category: 'Гражданский кодекс',
      author: 'Shogun_Kenji',
      passedDate: '2025-08-02',
      status: 'Действует',
      summary: 'Разрешает игрокам создавать независимые магазины, заключать коммерческие контракты и открывать банки.',
    },
    {
      id: 2,
      title: 'Закон о налоговой ставке 5%',
      category: 'Налоговый кодекс',
      author: 'President_Alex',
      passedDate: '2025-08-03',
      status: 'Действует',
      summary: 'Устанавливает базовый налог 5% со всех крупных торговых сделок в пользу государственной казны.',
    },
  ];
  private parties: PoliticalParty[] = [
    {
      id: 'p1',
      name: 'Партия Самурайского Единства',
      tag: 'PSE',
      leader: 'Shogun_Kenji',
      ideology: 'Традиционализм & Рыночная экономика',
      membersCount: 12,
      color: '#c0392b',
    },
    {
      id: 'p2',
      name: 'Либерально-Демократический Альянс',
      tag: 'LDA',
      leader: 'President_Alex',
      ideology: 'Либеральная демократия & Свобода слова',
      membersCount: 8,
      color: '#c9920a',
    },
  ];
  private currentElection: Election = {
    id: 'e1',
    title: 'Первые Выборы Президента SamuraiWorld 2025',
    startDate: '2025-08-10',
    endDate: '2025-08-12',
    status: 'Предвыборная гонка',
    candidates: [
      { name: 'Shogun_Kenji', party: 'Партия Самурайского Единства', votes: 45 },
      { name: 'President_Alex', party: 'Либерально-Демократический Альянс', votes: 38 },
    ],
  };
  getCitizens(): Citizen[] {
    return this.citizens;
  }
  getCitizenByUsername(username: string): Citizen {
    const citizen = this.citizens.find(
      (c) => c.username.toLowerCase() === username.toLowerCase(),
    );
    if (!citizen) {
      throw new NotFoundException(`Гражданин с ником ${username} не найден`);
    }
    return citizen;
  }
  getLaws(): Law[] {
    return this.laws;
  }
  getParties(): PoliticalParty[] {
    return this.parties;
  }
  getElections(): Election {
    return this.currentElection;
  }
}
