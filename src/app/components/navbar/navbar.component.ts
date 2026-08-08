import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../../services/auth.service';

interface NavLink {
  label: string;
  path: string;
  jpLabel: string;
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
  private userSub!: Subscription;

  // Модальное окно авторизации
  showAuthModal = false;
  authMode: 'login' | 'register' = 'login';
  authNicknameInput = '';
  authPasswordInput = '';
  authEmailInput = '';
  authErrorMsg = '';
  isAuthSubmitting = false;

  navLinks: NavLink[] = [
    { label: 'Главная', path: '/', jpLabel: 'Главная' },
    { label: 'О сервере', path: '/world', jpLabel: 'Система' },
    { label: 'Правила', path: '/rules', jpLabel: 'Законы' },
    { label: 'Поддержка', path: '/support', jpLabel: 'Помощь' },
    { label: 'Контакты', path: '/contacts', jpLabel: 'Контакты' }
  ];

  constructor(
    private router: Router,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.userSub = this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnDestroy(): void {
    if (this.userSub) {
      this.userSub.unsubscribe();
    }
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

  // ===== ГЛОБАЛЬНАЯ АВТОРИЗАЦИЯ =====
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
    if (!this.authNicknameInput || !this.authPasswordInput) {
      this.authErrorMsg = 'Заполните никнейм и пароль';
      return;
    }

    this.isAuthSubmitting = true;
    this.authErrorMsg = '';

    const req$ = this.authMode === 'login'
      ? this.authService.login({ nickname: this.authNicknameInput, password: this.authPasswordInput })
      : this.authService.register({ nickname: this.authNicknameInput, email: this.authEmailInput, password: this.authPasswordInput });

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
        this.authErrorMsg = err?.error?.message || 'Ошибка авторизации. Проверьте данные.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.closeMobileMenu();
  }
}
