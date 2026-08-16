import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';
import { ServerService, ServerInfo } from '../../services/server.service';
import { LoginSchema, RegisterSchema } from '../../schemas/api.schemas';

export interface NavGroup {
  title: string;
  links: NavLinkItem[];
}

export interface NavLinkItem {
  label: string;
  path: string;
  icon: string;
  badge?: string;
  badgeType?: 'hot' | 'new' | 'vip';
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  isScrolled = false;
  isMobileMenuOpen = false;
  currentUser: User | null = null;
  serverInfo: ServerInfo | null = null;
  private userSub!: Subscription;
  private serverSub!: Subscription;

  showAuthModal = false;
  authMode: 'login' | 'register' = 'login';
  authNicknameInput = '';
  authPasswordInput = '';
  authEmailInput = '';
  authErrorMsg = '';
  isAuthSubmitting = false;
  ipCopied = false;

  navGroups: NavGroup[] = [
    {
      title: 'Государство & Мир',
      links: [
        {
          label: 'Главная',
          path: '/',
          icon: 'home'
        },
        {
          label: 'О сервере',
          path: '/world',
          icon: 'crown'
        },
        {
          label: 'Правила и законы',
          path: '/rules',
          icon: 'scroll'
        }
      ]
    },
    {
      title: 'Казна & Донат',
      links: [
        {
          label: 'Магазин & VIP',
          path: '/store',
          icon: 'diamond'
        }
      ]
    },
    {
      title: 'Служба & Сообщество',
      links: [
        {
          label: 'Поддержка',
          path: '/support',
          icon: 'shield'
        },
        {
          label: 'Контакты',
          path: '/contacts',
          icon: 'chat'
        }
      ]
    }
  ];

  constructor(
    private router: Router,
    public authService: AuthService,
    private serverService: ServerService
  ) {}

  ngOnInit(): void {
    this.userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });

    this.serverSub = this.serverService.getServerInfo().subscribe(info => {
      this.serverInfo = info;
    });
  }

  ngOnDestroy(): void {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
    if (this.serverSub) {
      this.serverSub.unsubscribe();
    }
  }

  get isOnline(): boolean {
    return this.serverInfo?.status === 'online';
  }

  get playersOnline(): number {
    return this.serverInfo?.playersOnline || 0;
  }

  get maxPlayers(): number {
    return this.serverInfo?.maxPlayers || 0;
  }

  get serverIp(): string {
    return this.serverInfo?.ip || 'b1.qwertyx.host:26687';
  }

  copyIp(): void {
    const ip = this.serverIp;
    navigator.clipboard.writeText(ip).then(() => {
      this.ipCopied = true;
      setTimeout(() => {
        this.ipCopied = false;
      }, 2000);
    }).catch(() => {
      const input = document.createElement('input');
      input.value = ip;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      this.ipCopied = true;
      setTimeout(() => {
        this.ipCopied = false;
      }, 2000);
    });
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > 50;
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  openAuthModal(mode: 'login' | 'register' = 'login'): void {
    this.authMode = mode;
    this.authErrorMsg = '';
    this.showAuthModal = true;
    this.closeMobileMenu();
  }

  closeAuthModal(): void {
    this.showAuthModal = false;
    this.authErrorMsg = '';
  }

  setAuthMode(mode: 'login' | 'register'): void {
    this.authMode = mode;
    this.authErrorMsg = '';
  }

  fillDemoAccount(type: 'player' | 'admin'): void {
    if (type === 'player') {
      this.authNicknameInput = 'PlayerOne';
      this.authPasswordInput = 'player123';
      this.authEmailInput = 'player@samuraiworld.ru';
    } else {
      this.authNicknameInput = 'Admin_Samurai';
      this.authPasswordInput = 'admin123';
      this.authEmailInput = 'admin@samuraiworld.ru';
    }
  }

  submitAuth(): void {
    const schema = this.authMode === 'login' ? LoginSchema : RegisterSchema;
    const payload = this.authMode === 'login'
      ? { nickname: this.authNicknameInput.trim(), password: this.authPasswordInput }
      : { nickname: this.authNicknameInput.trim(), email: this.authEmailInput, password: this.authPasswordInput };

    const result = schema.safeParse(payload);
    if (!result.success) {
      this.authErrorMsg = result.error.issues[0].message;
      return;
    }

    this.isAuthSubmitting = true;
    this.authErrorMsg = '';

    const req$ = this.authMode === 'login'
      ? this.authService.login({ nickname: result.data.nickname, password: this.authPasswordInput })
      : this.authService.register({ nickname: result.data.nickname, email: this.authEmailInput, password: this.authPasswordInput });

    req$.subscribe({
      next: () => {
        this.isAuthSubmitting = false;
        this.closeAuthModal();
        this.authNicknameInput = '';
        this.authPasswordInput = '';
        this.authEmailInput = '';
      },
      error: (err) => {
        this.isAuthSubmitting = false;
        this.authErrorMsg = err?.error?.message || 'Ошибка авторизации. Проверьте введенные данные.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.closeMobileMenu();
  }

  readonly DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.03-4.84-2.6.03-1.61 3.22-2.4 4.84-2.4 1.61 0 4.81.79 4.84 2.4C15.8 18.97 14.03 20 12 20z"/></svg>';

  showAvatarModal = false;
  customAvatarUrlInput = '';
  avatarSuccessMsg = '';
  avatarErrorMsg = '';

  openAvatarModal(): void {
    if (!this.currentUser) return;
    this.customAvatarUrlInput = this.currentUser.avatarUrl || this.DEFAULT_AVATAR;
    this.avatarSuccessMsg = '';
    this.avatarErrorMsg = '';
    this.showAvatarModal = true;
  }

  closeAvatarModal(): void {
    this.showAvatarModal = false;
  }

  resetToDefaultAvatar(): void {
    this.customAvatarUrlInput = this.DEFAULT_AVATAR;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.avatarErrorMsg = 'Выберите изображение (PNG, JPG, WebP)!';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxDim = 256;
        canvas.width = maxDim;
        canvas.height = maxDim;
        if (ctx) {
          ctx.drawImage(img, 0, 0, maxDim, maxDim);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          this.customAvatarUrlInput = compressedDataUrl;
          this.avatarErrorMsg = '';
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  saveAvatar(): void {
    const url = (this.customAvatarUrlInput || '').trim() || this.DEFAULT_AVATAR;
    this.authService.updateAvatar(url).subscribe({
      next: () => {
        this.avatarSuccessMsg = 'Аватарка успешно обновлена!';
        setTimeout(() => {
          this.closeAvatarModal();
        }, 800);
      },
      error: () => {
        this.avatarErrorMsg = 'Ошибка обновления аватарки';
      }
    });
  }
}
