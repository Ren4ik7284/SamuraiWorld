import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SafeHtmlPipe } from '../../pipes/safe-html.pipe';

interface Social {
  label: string;
  url: string;
  svg: string;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, SafeHtmlPipe],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css']
})
export class FooterComponent {
  currentYear = new Date().getFullYear();

  socials: Social[] = [
    {
      label: 'Discord',
      url: 'https://discord.gg/ZRzAFPzCT',
      svg: `<svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>`
    },
    {
      label: 'Telegram',
      url: 'https://t.me/',
      svg: `<svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.78 18.65l.28-4.2 7.68-6.92c.34-.3-.07-.46-.52-.17L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3L19.79 4.5c.73-.28 1.4.18 1.15 1.3l-2.7 12.7c-.19.92-.75 1.14-1.5.72l-4.14-3.05-2 1.93c-.23.23-.42.42-.84.42z"/>
      </svg>`
    }
  ];

  navLinks = [
    { label: 'Главная', path: '/' },
    { label: 'О сервере', path: '/world' },
    { label: 'Магазин VIP', path: '/store' },
    { label: 'Правила', path: '/rules' },
    { label: 'Поддержка', path: '/support' },
    { label: 'Контакты', path: '/contacts' }
  ];

  legalLinks = [
    { label: 'Политика конфиденциальности', path: '/privacy' },
    { label: 'Пользовательское соглашение', path: '/terms' },
    { label: 'Контакты поддержки', path: '/contacts' }
  ];
}
