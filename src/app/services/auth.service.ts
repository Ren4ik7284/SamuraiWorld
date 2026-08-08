import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export type UserRole = 'user' | 'support' | 'admin';

export interface User {
  id: string;
  nickname: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = '/api/auth';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private accessTokenKey = 'samurai_access_token';
  private refreshTokenKey = 'samurai_refresh_token';
  private userKey = 'samurai_user_profile';

  constructor(private http: HttpClient) {
    this.loadInitialSession();
  }

  private loadInitialSession(): void {
    const savedUser = localStorage.getItem(this.userKey);
    const accessToken = localStorage.getItem(this.accessTokenKey);

    if (savedUser && accessToken) {
      try {
        this.currentUserSubject.next(JSON.parse(savedUser));
        // Запрашиваем свежий профиль с бэкенда
        this.fetchProfile().subscribe({
          error: () => {
            // Если access token истек, пробуем обновить
            this.refreshToken().subscribe({
              error: () => this.logout(),
            });
          },
        });
      } catch (e) {
        this.logout();
      }
    }
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get accessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  public get isAuthenticated(): boolean {
    return !!this.currentUserValue && !!this.accessToken;
  }

  public get isSupportOrAdmin(): boolean {
    const user = this.currentUserValue;
    return !!user && (user.role === 'admin' || user.role === 'support');
  }

  /**
   * Получение HTTP заголовка авторизации Bearer
   */
  public getAuthHeaders(): { headers: HttpHeaders } {
    const token = this.accessToken;
    if (token) {
      return {
        headers: new HttpHeaders({
          Authorization: `Bearer ${token}`,
        }),
      };
    }
    return { headers: new HttpHeaders() };
  }

  /**
   * Регистрация нового аккаунта
   */
  register(dto: { nickname: string; email?: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, dto).pipe(
      tap((res) => this.handleAuthSuccess(res)),
      catchError((err) => throwError(() => err))
    );
  }

  /**
   * Вход в систему (Авторизация)
   */
  login(dto: { nickname: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, dto).pipe(
      tap((res) => this.handleAuthSuccess(res)),
      catchError((err) => throwError(() => err))
    );
  }

  /**
   * Обновление Access токена по Refresh токену
   */
  refreshToken(): Observable<AuthTokens> {
    const refreshTokenStr = localStorage.getItem(this.refreshTokenKey);
    if (!refreshTokenStr) {
      this.logout();
      return throwError(() => new Error('Refresh token absent'));
    }

    return this.http.post<AuthTokens>(`${this.apiUrl}/refresh`, { refreshToken: refreshTokenStr }).pipe(
      tap((tokens) => {
        localStorage.setItem(this.accessTokenKey, tokens.accessToken);
        if (tokens.refreshToken) {
          localStorage.setItem(this.refreshTokenKey, tokens.refreshToken);
        }
      }),
      catchError((err) => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  /**
   * Получение профиля текущего пользователя
   */
  fetchProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`, this.getAuthHeaders()).pipe(
      tap((user) => {
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
  }

  /**
   * Выход из аккаунта
   */
  logout(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
  }

  private handleAuthSuccess(res: AuthResponse): void {
    localStorage.setItem(this.accessTokenKey, res.tokens.accessToken);
    localStorage.setItem(this.refreshTokenKey, res.tokens.refreshToken);
    localStorage.setItem(this.userKey, JSON.stringify(res.user));
    // Также сохраняем ник в поле для поддержки
    localStorage.setItem('samurai_user_nickname', res.user.nickname);
    this.currentUserSubject.next(res.user);
  }
}
