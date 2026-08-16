import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

export interface SystemBlock {
  icon: string;
  title: string;
  tag: string;
  desc: string;
  details: string[];
  accent: string;
  category: 'politics' | 'economy' | 'law';
}

@Component({
  selector: 'app-world',
  standalone: true,
  imports: [CommonModule, SafeHtmlPipe],
  templateUrl: './world.component.html',
  styleUrls: ['./world.component.css']
})
export class WorldComponent {
  ipCopied = false;
  activeCategory: 'all' | 'politics' | 'economy' | 'law' = 'all';

  systems: SystemBlock[] = [
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`,
      title: 'Президентство и Кабинет',
      tag: 'Исполнительная власть',
      desc: 'Игроки баллотируются, ведут кампании и побеждают на выборах. Президент управляет казной, назначает министров и определяет курс страны.',
      details: ['Свободные выборы каждый сезон', 'Право вето на законы парламента', 'Управление государственной казной', 'Назначение министров и послов'],
      accent: '#c0392b',
      category: 'politics'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      title: 'Парламент и Сенат',
      tag: 'Законодательная власть',
      desc: 'Депутаты голосуют за законы, которые реально меняют правила игры — налоговые ставки, зоны застройки, права граждан.',
      details: ['Фракции и партийные коалиции', 'Голосование по законопроектам', 'Контроль над государственным бюджетом', 'Механика импичмента президенту'],
      accent: '#d4a017',
      category: 'politics'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6L12 3L21 6M3 6V18L12 21M3 6H21M21 6V18L12 21M12 3V21"/></svg>`,
      title: 'Независимый Суд',
      tag: 'Судебная власть',
      desc: 'Игроки могут подавать судебные иски. Судья изучает улики и выносит вердикт — штраф, арест имущества или полное оправдание.',
      details: ['Выборные и независимые судьи', 'Гражданские и уголовные процессы', 'Система официальных штрафов', 'Адвокатская защита и апелляции'],
      accent: '#38bdf8',
      category: 'law'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      title: 'Экономика и Бизнес',
      tag: 'Финансовая система',
      desc: 'Открывай магазины, получай лицензию, нанимай сотрудников. Государство собирает налоги и инвестирует в инфраструктуру городов.',
      details: ['Лицензирование коммерческой торговли', 'Аренда государственных участков', 'Рыночная торговля и биржа ресурсов', 'Банковская система и кредитование'],
      accent: '#22c55e',
      category: 'economy'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      title: 'Документооборот и Паспорт',
      tag: 'Гражданство',
      desc: 'Получи паспорт, оформи официальный трудовой договор, зарегистрируй бизнес. Без документов невозможно занимать госдолжности.',
      details: ['Паспорт гражданина SamuraiWorld', 'Регистрация компаний и брендов', 'Договоры аренды и трудоустройства', 'Государственный реестр свидетельств'],
      accent: '#f97316',
      category: 'law'
    },
    {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"/><circle cx="9" cy="7" r="4"/><path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"/><path d="M16 3.13A4 4 0 0116 10.88"/></svg>`,
      title: 'Политические Партии',
      tag: 'Гражданское общество',
      desc: 'Создавай партию с собственной программой. Вступай в союзы, веди предвыборную агитацию и формируй большинство в парламенте.',
      details: ['Официальная регистрация партий', 'Партийные кассы и взносы', 'Агитация и предвыборные дебаты', 'Коалиционные договоренности'],
      accent: '#a855f7',
      category: 'politics'
    }
  ];

  hardwareSpecs = [
    {
      label: 'ПРОЦЕССОР',
      value: 'AMD Ryzen 7 5700X',
      sub: 'Выделенные производительные ядра',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3"/></svg>`
    },
    {
      label: 'ОПЕРАТИВНАЯ ПАМЯТЬ',
      value: '8 ГБ DDR4 RAM',
      sub: 'Высокая частота для идеального TPS',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 19V5a2 2 0 012-2h16a2 2 0 012 2v14M2 19h20M6 19v-4M10 19v-4M14 19v-4M18 19v-4M7 7h2M15 7h2M7 11h2M15 11h2"/></svg>`
    },
    {
      label: 'СКОРОСТНОЙ ДИСК',
      value: '80 ГБ NVMe M.2 SSD',
      sub: 'Мгновенная подгрузка чанков',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01"/><path d="M2 10h20"/></svg>`
    }
  ];

  specs = [
    { label: 'Платформа & Версия', value: 'Java Edition 1.21.4' },
    { label: 'Игровой режим', value: 'Ванильное выживание + РП' },
    { label: 'Гос. строй', value: 'Демократическая Республика' },
    { label: 'Экономика', value: 'Рыночная с налогами и банками' },
    { label: 'Слоты игроков', value: 'До 1000 игроков онлайн' },
    { label: 'Аптайм хостинга', value: '24/7 · 99.9% доступность' },
    { label: 'Защита от читеров', value: 'Собственный серверный античит' },
    { label: 'Связь с сервером', value: 'RCON & прямой API статус' },
  ];

  steps = [
    { n: '01', head: 'Скопируй адрес сервера', sub: 'b1.qwertyx.host:26687 — версия 1.21.4' },
    { n: '02', head: 'Зайди в игру и освойся', sub: 'Пройди стартовую регистрацию в игре' },
    { n: '03', head: 'Оформи паспорт и гражданство', sub: 'Зарегистрируйся через мэрию или документооборот' },
    { n: '04', head: 'Выбери свой путь', sub: 'Построй бизнес, баллотируйся в парламент или служи в полиции' },
  ];

  get filteredSystems(): SystemBlock[] {
    if (this.activeCategory === 'all') return this.systems;
    return this.systems.filter(s => s.category === this.activeCategory);
  }

  setCategory(cat: 'all' | 'politics' | 'economy' | 'law'): void {
    this.activeCategory = cat;
  }

  copyIp(): void {
    navigator.clipboard.writeText('b1.qwertyx.host:26687');
    this.ipCopied = true;
    setTimeout(() => {
      this.ipCopied = false;
    }, 2000);
  }
}
