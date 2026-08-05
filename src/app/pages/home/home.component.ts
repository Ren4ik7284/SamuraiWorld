import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';
import { ServerService, ServerInfo, NewsItem } from '../../services/server.service';

interface Feature {
  svgIcon: string;
  title: string;
  tag: string;
  desc: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, SafeHtmlPipe],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  serverInfo: ServerInfo | null = null;
  news: NewsItem[] = [];
  ipCopied = false;
  particles: { x: number; size: number; speed: number; opacity: number }[] = [];

  features: Feature[] = [
    {
      svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`,
      title: 'Выборы президента',
      tag: 'Политика',
      desc: 'Каждый игрок может выдвинуть свою кандидатуру. Собирай голоса, строй партию и управляй государством.'
    },
    {
      svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
      title: 'Игровые документы',
      tag: 'Документооборот',
      desc: 'Паспорт, лицензия на бизнес, договоры аренды, гражданство — всё оформляется через реальный документооборот.'
    },
    {
      svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      title: 'Открой свой бизнес',
      tag: 'Экономика',
      desc: 'Оформи лицензию, арендуй участок и открой магазин. Торгуй ресурсами, сервисами, едой — всё как в жизни.'
    },
    {
      svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      title: 'Парламент и законы',
      tag: 'Власть',
      desc: 'Депутаты голосуют за законы. Законы реально влияют на игровой мир — налоги, запреты, права граждан.'
    },
    {
      svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      title: 'Суд и правосудие',
      tag: 'Право',
      desc: 'Любой игрок может подать иск. Судья разбирает дела, назначает штрафы или оправдывает обвиняемого.'
    },
    {
      svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"/><circle cx="9" cy="7" r="4"/><path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"/><path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88"/></svg>`,
      title: 'Политические партии',
      tag: 'Партии',
      desc: 'Объединяйся с игроками, создавай партию, разрабатывай программу и бори&#39;тесь за большинство в парламенте.'
    }
  ];

  constructor(private serverService: ServerService) {}

  ngOnInit(): void {
    this.serverService.getServerInfo().subscribe(info => { this.serverInfo = info; });
    this.serverService.getNews().subscribe(news => { this.news = news; });
    this.particles = Array.from({ length: 18 }, () => ({
      x: Math.random() * 100,
      size: Math.random() * 10 + 6,
      speed: Math.random() * 12 + 8,
      opacity: Math.random() * 0.4 + 0.1
    }));
  }

  copyIp(): void {
    const ip = this.serverInfo?.ip || 'play.samuraiworld.ru';
    navigator.clipboard.writeText(ip).finally(() => {
      this.ipCopied = true;
      setTimeout(() => { this.ipCopied = false; }, 2200);
    });
  }
}
