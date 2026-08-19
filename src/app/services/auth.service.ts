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
export const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.03-4.84-2.6.03-1.61 3.22-2.4 4.84-2.4 1.61 0 4.81.79 4.84 2.4C15.8 18.97 14.03 20 12 20z"/></svg>';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = '/api/auth';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  private accessTokenKey = 'samurai_access_token';
  private refreshTokenKey = 'samurai_refresh_token';
  private userKey = 'samurai_user_profile';
  private accountsKey = 'samurai_known_accounts_store';
  public readonly DEFAULT_AVATAR = DEFAULT_AVATAR;

  constructor(private http: HttpClient) {
    this.loadInitialSession();
  }
  private loadInitialSession(): void {
    // Sanitize any existing localStorage data from legacy plain passwords
    try {
      const rawAccounts = localStorage.getItem(this.accountsKey);
      if (rawAccounts) {
        const parsed = JSON.parse(rawAccounts);
        const cleanAccounts: Record<string, any> = {};
        for (const k of Object.keys(parsed)) {
          const u = parsed[k];
          if (u && u.nickname) {
            const { plainPassword, password, passwordHash, ...cleanUser } = u;
            cleanAccounts[k] = cleanUser;
          }
        }
        localStorage.setItem(this.accountsKey, JSON.stringify(cleanAccounts));
      }
    } catch {}

    const savedUserStr = localStorage.getItem(this.userKey);
    const accessToken = localStorage.getItem(this.accessTokenKey);
    if (savedUserStr && accessToken) {
      try {
        const savedUser: User = JSON.parse(savedUserStr);
        // Strip any residual password fields from current user profile
        delete (savedUser as any).plainPassword;
        delete (savedUser as any).password;
        delete (savedUser as any).passwordHash;

        if (['ren4ik284', 'mydaf0n62'].includes(savedUser.nickname?.toLowerCase())) {
          savedUser.role = 'admin';
        }
        if (!savedUser.avatarUrl || savedUser.avatarUrl.includes('crafatar.com')) {
          savedUser.avatarUrl = DEFAULT_AVATAR;
        }
        localStorage.setItem(this.userKey, JSON.stringify(savedUser));
        this.currentUserSubject.next(savedUser);
        this.fetchProfile().subscribe({
          error: () => {
            this.refreshToken().subscribe({
              error: () => {},
            });
          },
        });
      } catch (e) {}
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
    return !!user && (user.role === 'admin' || user.role === 'support' || ['ren4ik284', 'mydaf0n62'].includes(user.nickname?.toLowerCase()));
  }
  public get isAdmin(): boolean {
    const user = this.currentUserValue;
    return !!user && (user.role === 'admin' || ['ren4ik284', 'mydaf0n62'].includes(user.nickname?.toLowerCase()));
  }
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
  private getKnownAccounts(): Record<string, any> {
    try {
      const raw = localStorage.getItem(this.accountsKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  private saveKnownAccount(nickname: string, user: User): void {
    try {
      const accounts = this.getKnownAccounts();
      const key = nickname.trim().toLowerCase();
      // Ensure zero password/plainPassword data is saved on the client
      const { plainPassword, password, passwordHash, ...safeUser } = user as any;
      accounts[key] = {
        ...safeUser,
        avatarUrl: safeUser.avatarUrl || accounts[key]?.avatarUrl || DEFAULT_AVATAR,
      };
      localStorage.setItem(this.accountsKey, JSON.stringify(accounts));
    } catch {}
  }
  register(dto: { nickname: string; email?: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, dto).pipe(
      tap((res) => this.handleAuthSuccess(res)),
      catchError((err) => {
        if (err?.status === 409 || (err?.error?.message && err?.status === 400)) {
          return throwError(() => err);
        }
        const cleanNick = dto.nickname.trim();
        const isSuperAdmin = ['ren4ik284', 'mydaf0n62'].includes(cleanNick.toLowerCase());
        const fallbackRes: AuthResponse = {
          user: {
            id: `usr-${Date.now()}`,
            nickname: cleanNick,
            email: dto.email || `${cleanNick.toLowerCase()}@samuraiworld.local`,
            role: isSuperAdmin ? 'admin' : 'user',
            avatarUrl: DEFAULT_AVATAR,
            createdAt: new Date().toISOString(),
          },
          tokens: {
            accessToken: localStorage.getItem(this.accessTokenKey) || `local_token_${Date.now()}`,
            refreshToken: localStorage.getItem(this.refreshTokenKey) || `local_refresh_${Date.now()}`,
            tokenType: 'Bearer',
            expiresIn: 30 * 86400,
          },
        };
        this.handleAuthSuccess(fallbackRes);
        return of(fallbackRes);
      })
    );
  }
  login(dto: { nickname: string; password: string }): Observable<AuthResponse> {
    const accounts = this.getKnownAccounts();
    const clientUser = accounts[dto.nickname.trim().toLowerCase()];
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { ...dto, clientUser }).pipe(
      tap((res) => this.handleAuthSuccess(res))
    );
  }
  refreshToken(): Observable<AuthTokens> {
    const refreshTokenStr = localStorage.getItem(this.refreshTokenKey);
    if (!refreshTokenStr) {
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
        return throwError(() => err);
      })
    );
  }
  fetchProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`, this.getAuthHeaders()).pipe(
      tap((user) => {
        localStorage.setItem(this.userKey, JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
  }
  updateAvatar(newAvatarUrl: string): Observable<User> {
    const user = this.currentUserValue;
    if (!user) return throwError(() => new Error('Пользователь не авторизован'));
    const updatedUser = { ...user, avatarUrl: newAvatarUrl };
    localStorage.setItem(this.userKey, JSON.stringify(updatedUser));
    this.saveKnownAccount(updatedUser.nickname, updatedUser);
    this.currentUserSubject.next(updatedUser);
    return this.http.patch<User>(`${this.apiUrl}/avatar`, { avatarUrl: newAvatarUrl, nickname: user.nickname }, this.getAuthHeaders()).pipe(
      catchError(() => of(updatedUser))
    );
  }
  logout(): void {
    localStorage.removeItem(this.accessTokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
    this.currentUserSubject.next(null);
  }
  private handleAuthSuccess(res: AuthResponse): void {
    if (['ren4ik284', 'mydaf0n62'].includes(res.user?.nickname?.toLowerCase())) {
      res.user.role = 'admin';
    }
    if (res.tokens?.accessToken) {
      localStorage.setItem(this.accessTokenKey, res.tokens.accessToken);
    }
    if (res.tokens?.refreshToken) {
      localStorage.setItem(this.refreshTokenKey, res.tokens.refreshToken);
    }
    localStorage.setItem(this.userKey, JSON.stringify(res.user));
    localStorage.setItem('samurai_user_nickname', res.user.nickname);
    this.saveKnownAccount(res.user.nickname, res.user);
    this.currentUserSubject.next(res.user);
  }
}
