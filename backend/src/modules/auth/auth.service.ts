import { Injectable, UnauthorizedException, BadRequestException, ConflictException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity, UserRole as DbUserRole } from '../database/entities/user.entity';

export type UserRole = 'user' | 'support' | 'admin';

export interface User {
  id: string;
  nickname: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  avatarUrl?: string;
  isVip?: boolean;
  vipGrantedAt?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface JwtPayload {
  sub: string;
  nickname: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: {
    id: string;
    nickname: string;
    email: string;
    role: UserRole;
    avatarUrl?: string;
    createdAt: string;
  };
  tokens: AuthTokens;
}

const MASTER_ADMINS = ['ren4ik284', 'mydaf0n62'];
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2394a3b8"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-3.8-1.03-4.84-2.6.03-1.61 3.22-2.4 4.84-2.4 1.61 0 4.81.79 4.84 2.4C15.8 18.97 14.03 20 12 20z"/></svg>';


@Injectable()
export class AuthService implements OnModuleInit {
  private readonly JWT_SECRET: string;
  private readonly REFRESH_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRY = 60 * 60;
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60;

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    if (!process.env.JWT_SECRET) {
      throw new Error('[AuthService] КРИТИЧНО: JWT_SECRET не задан в .env! Запуск без секрета запрещён.');
    }
    if (!process.env.REFRESH_SECRET) {
      throw new Error('[AuthService] КРИТИЧНО: REFRESH_SECRET не задан в .env! Запуск без секрета запрещён.');
    }
    this.JWT_SECRET = process.env.JWT_SECRET;
    this.REFRESH_SECRET = process.env.REFRESH_SECRET;
  }

  async onModuleInit() {
    await this.seedInitialUsers();
  }



  /** Генерирует крипто-безопасный пароль из 24 случайных символов */
  private generateSecurePassword(): string {
    return crypto.randomBytes(18).toString('base64').replace(/[+/=]/g, 'x');
  }

  /** Конвертирует UserEntity в User interface */
  private entityToUser(e: UserEntity): User {
    return {
      id: e.id,
      nickname: e.nickname,
      email: e.email,
      passwordHash: e.passwordHash,
      role: e.role as UserRole,
      avatarUrl: e.avatarUrl ?? undefined,
      isVip: e.isVip,
      vipGrantedAt: e.vipGrantedAt?.toISOString(),
      createdAt: e.createdAt.toISOString(),
      lastLogin: e.lastLogin?.toISOString(),
    };
  }

  /**
   * При первом запуске создаёт системных пользователей с рандомными паролями.
   * Если пользователи уже есть в БД — пропускает.
   */
  private async seedInitialUsers(): Promise<void> {
    const count = await this.userRepo.count();
    if (count > 0) {
      // БД уже инициализирована — принудительно ставим роль admin для мастер-ников
      await this.ensureMasterAdmins();
      return;
    }

    const now = new Date();
    const adminPass = this.generateSecurePassword();
    const supportPass = this.generateSecurePassword();

    await this.userRepo.save([
      this.userRepo.create({
        id: 'usr-admin-1',
        nickname: 'Admin_Samurai',
        email: 'admin@samuraiworld.ru',
        passwordHash: this.hashPassword(adminPass),
        role: 'admin',
        avatarUrl: DEFAULT_AVATAR,
        createdAt: now,
        lastLogin: now,
        isVip: false,
      }),
      this.userRepo.create({
        id: 'usr-support-1',
        nickname: 'Support_Agent',
        email: 'support@samuraiworld.ru',
        passwordHash: this.hashPassword(supportPass),
        role: 'support',
        avatarUrl: DEFAULT_AVATAR,
        createdAt: now,
        lastLogin: now,
        isVip: false,
      }),
    ]);

    console.log('\n' + '='.repeat(60));
    console.log('🏯 [AuthService] ПЕРВЫЙ ЗАПУСК — НАЧАЛЬНЫЕ АККАУНТЫ');
    console.log('='.repeat(60));
    console.log(`  Admin_Samurai  → пароль: ${adminPass}`);
    console.log(`  Support_Agent  → пароль: ${supportPass}`);
    console.log('  ⚠️  Сохраните эти пароли — они больше не будут показаны!');
    console.log('='.repeat(60) + '\n');
  }

  /** Принудительно выставляет роль admin мастер-никам */
  private async ensureMasterAdmins(): Promise<void> {
    for (const nick of MASTER_ADMINS) {
      await this.userRepo
        .createQueryBuilder()
        .update(UserEntity)
        .set({ role: 'admin' })
        .where('LOWER(nickname) = :nick', { nick })
        .execute();
    }
  }

  private readonly verificationCodes = new Map<string, { code: string; expiresAt: number }>();

  private readonly DISPOSABLE_EMAIL_DOMAINS = new Set([
    'temp-mail.org', '10minutemail.com', 'mailinator.com', 'guerrillamail.com', 'yopmail.com',
    'sharklasers.com', 'trashmail.com', 'fakemailgenerator.com', 'tempmail.com', 'mohmal.com',
    'getairmail.com', 'dispostable.com', 'tmail.com', 'nada.ltd', 'inboxkitten.com', 'mytemp.email',
    'generator.email', 'dropmail.me', 'crazymailing.com', 'throwawaymail.com', 'emailondeck.com',
    'tempail.com', '10minutemail.net', 'disposablemail.com', 'tempmailaddress.com', 'burnermail.io',
    'guerrillamailblock.com', 'guerrillamail.net', 'guerrillamail.org', 'pokemail.net', 'spam4.me',
    'grr.la', 'maildrop.cc', 'inboxbear.com', 'mailnesia.com', 'mintemail.com', 'fake-box.com',
    'getnada.com', 'tempmailo.com', 'tmpmail.org', 'tmpmail.net', 'emailfake.com', 'mohmal.in',
    'tempmailgen.com', 'fakeemail.com', 'trash-mail.com', 'tempinbox.com', 'disposable.com'
  ]);

  private readonly FAKE_EMAIL_PATTERNS = [
    /^test@test\./i,
    /^fake@fake\./i,
    /^admin@admin\./i,
    /^asdf@asdf\./i,
    /^123@123\./i,
    /^none@none\./i,
    /^no@no\./i,
    /^user@example\./i,
    /^sample@sample\./i,
    /^qwerty@qwerty\./i,
    /^abc@abc\./i,
  ];

  public isDisposableEmail(email: string): boolean {
    const clean = (email || '').trim().toLowerCase();
    const domain = clean.split('@')[1]?.trim();
    if (!domain) return true;
    if (this.DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
    for (const pattern of this.FAKE_EMAIL_PATTERNS) {
      if (pattern.test(clean)) return true;
    }
    return false;
  }

  public validateEmailString(email: string): void {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new BadRequestException('Укажите корректный адрес электронной почты');
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail) || cleanEmail.length > 100) {
      throw new BadRequestException('Некорректный формат адреса электронной почты');
    }
    const domain = cleanEmail.split('@')[1];
    if (!domain || !domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
      throw new BadRequestException('Некорректный домен электронной почты');
    }
    if (this.isDisposableEmail(cleanEmail)) {
      throw new BadRequestException('Регистрация с временных или поддельных почтовых ящиков запрещена');
    }
  }

  sendVerificationCode(email: string): { success: boolean; message: string; testCode?: string } {
    const cleanEmail = (email || '').trim().toLowerCase();
    this.validateEmailString(cleanEmail);
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity
    this.verificationCodes.set(cleanEmail, { code, expiresAt });

    console.log(`[EmailService] 📩 Verification code for ${cleanEmail}: ${code} (Valid for 15 mins)`);

    return {
      success: true,
      message: `Код подтверждения успешно отправлен на ${cleanEmail}`,
      testCode: process.env.NODE_ENV !== 'production' ? code : undefined,
    };
  }

  verifyEmailCode(email: string, code: string): boolean {
    const cleanEmail = (email || '').trim().toLowerCase();
    const entry = this.verificationCodes.get(cleanEmail);
    if (!entry) {
      throw new BadRequestException('Код подтверждения не найден или истек. Запросите новый код.');
    }
    if (Date.now() > entry.expiresAt) {
      this.verificationCodes.delete(cleanEmail);
      throw new BadRequestException('Срок действия кода подтверждения истек.');
    }
    if (entry.code !== (code || '').trim()) {
      throw new BadRequestException('Неверный код подтверждения.');
    }
    this.verificationCodes.delete(cleanEmail);
    return true;
  }

  async register(dto: { nickname: string; email?: string; password: string; avatarUrl?: string; verificationCode?: string; role?: UserRole }): Promise<AuthResponse> {
    const nickname = (dto.nickname || '').trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(nickname)) {
      throw new BadRequestException('Никнейм должен содержать от 3 до 16 символов (только латиница, цифры и _)');
    }
    if (!dto.password || dto.password.length < 6 || dto.password.length > 64) {
      throw new BadRequestException('Пароль должен содержать от 6 до 64 символов');
    }
    const cleanNick = nickname.toLowerCase();

    const existingNick = await this.userRepo.findOne({ where: { nickname } });
    if (existingNick) {
      throw new ConflictException(`Пользователь с ником "${nickname}" уже зарегистрирован`);
    }

    let finalEmail = `${cleanNick}@samuraiworld.local`;
    if (dto.email && dto.email.trim()) {
      const email = dto.email.trim().toLowerCase();
      this.validateEmailString(email);
      const existingEmail = await this.userRepo.findOne({ where: { email } });
      if (existingEmail) {
        throw new ConflictException(`Пользователь с адресом почты "${dto.email}" уже зарегистрирован`);
      }
      if (dto.verificationCode) {
        this.verifyEmailCode(email, dto.verificationCode);
      }
      finalEmail = email;
    }

    const isMaster = MASTER_ADMINS.includes(cleanNick);
    const now = new Date();
    const entity = this.userRepo.create({
      id: `usr-${Date.now()}-${crypto.randomInt(1000)}`,
      nickname,
      email: finalEmail,
      passwordHash: this.hashPassword(dto.password),
      role: isMaster ? 'admin' : (dto.role || 'user'),
      avatarUrl: (dto.avatarUrl && !dto.avatarUrl.includes('crafatar.com')) ? dto.avatarUrl : DEFAULT_AVATAR,
      createdAt: now,
      lastLogin: now,
      isVip: false,
    });
    const saved = await this.userRepo.save(entity);
    const user = this.entityToUser(saved);
    console.log(`[AuthService] Registered new user: ${user.nickname} (${user.role})`);
    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), tokens };
  }

  async login(dto: { nickname: string; password: string }): Promise<AuthResponse> {
    const nickname = dto.nickname.trim();
    const cleanNick = nickname.toLowerCase();

    const entity = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.nickname) = :nick', { nick: cleanNick })
      .getOne();

    if (!entity) {
      throw new UnauthorizedException('Неверный никнейм или пароль');
    }

    const isPasswordValid = this.verifyPassword(dto.password, entity.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Неверный никнейм или пароль');
    }

    // Апгрейд legacy хеша до bcrypt
    if (!entity.passwordHash.startsWith('$2a$') && !entity.passwordHash.startsWith('$2b$')) {
      entity.passwordHash = this.hashPassword(dto.password);
    }
    entity.lastLogin = new Date();
    if (MASTER_ADMINS.includes(cleanNick)) {
      entity.role = 'admin';
    }
    await this.userRepo.save(entity);

    console.log(`[AuthService] User logged in: ${entity.nickname}`);
    const user = this.entityToUser(entity);
    const tokens = this.generateTokens(user);
    return { user: this.sanitizeUser(user), tokens };
  }

  async deleteUser(idOrNick: string): Promise<{ success: boolean; message: string }> {
    const target = (idOrNick || '').trim().toLowerCase();
    if (!target) throw new BadRequestException('Укажите ID или никнейм пользователя');
    if (MASTER_ADMINS.includes(target)) {
      throw new ForbiddenException('Нельзя удалить главного администратора');
    }
    const entity = await this.userRepo
      .createQueryBuilder('u')
      .where('u.id = :id OR LOWER(u.nickname) = :nick', { id: idOrNick, nick: target })
      .getOne();
    if (!entity) throw new BadRequestException('Пользователь не найден');
    if (MASTER_ADMINS.includes(entity.nickname.toLowerCase())) {
      throw new ForbiddenException('Нельзя удалить главного администратора');
    }
    await this.userRepo.remove(entity);
    console.log(`[AuthService] Deleted user: ${idOrNick}`);
    return { success: true, message: `Пользователь ${idOrNick} успешно удален` };
  }

  async updateUserRole(idOrNick: string, role: UserRole): Promise<Omit<User, 'passwordHash'>> {
    const target = (idOrNick || '').trim().toLowerCase();
    const entity = await this.userRepo
      .createQueryBuilder('u')
      .where('u.id = :id OR LOWER(u.nickname) = :nick', { id: idOrNick, nick: target })
      .getOne();
    if (!entity) throw new BadRequestException('Пользователь не найден');
    entity.role = MASTER_ADMINS.includes(entity.nickname.toLowerCase()) ? 'admin' : role;
    await this.userRepo.save(entity);
    return this.sanitizeUser(this.entityToUser(entity));
  }

  async updateAvatar(nickname: string, avatarUrl: string): Promise<Omit<User, 'passwordHash'>> {
    const target = (nickname || '').trim().toLowerCase();
    const entity = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.nickname) = :nick', { nick: target })
      .getOne();
    if (!entity) throw new BadRequestException('Пользователь не найден');
    entity.avatarUrl = avatarUrl;
    await this.userRepo.save(entity);
    return this.sanitizeUser(this.entityToUser(entity));
  }

  async syncUsers(incomingUsers: any[]): Promise<Array<Omit<User, 'passwordHash'>>> {
    if (Array.isArray(incomingUsers)) {
      for (const inc of incomingUsers) {
        if (!inc || !inc.nickname) continue;
        const nickKey = inc.nickname.trim().toLowerCase();
        const existing = await this.userRepo
          .createQueryBuilder('u')
          .where('LOWER(u.nickname) = :nick', { nick: nickKey })
          .getOne();
        if (!existing) {
          const isMaster = MASTER_ADMINS.includes(nickKey);
          const avatarToUse = (inc.avatarUrl && !inc.avatarUrl.includes('crafatar.com')) ? inc.avatarUrl : DEFAULT_AVATAR;
          await this.userRepo.save(this.userRepo.create({
            id: inc.id || `usr-${Date.now()}-${crypto.randomInt(1000)}`,
            nickname: inc.nickname.trim(),
            email: inc.email || `${nickKey}@samuraiworld.local`,
            passwordHash: inc.passwordHash || this.hashPassword('synced_user_2026'),
            role: isMaster ? 'admin' : (inc.role || 'user'),
            avatarUrl: avatarToUse,
            createdAt: inc.createdAt ? new Date(inc.createdAt) : new Date(),
            lastLogin: inc.lastLogin ? new Date(inc.lastLogin) : new Date(),
            isVip: inc.isVip || false,
          }));
        }
      }
    }
    return this.getAllUsers();
  }

  async refreshTokens(refreshTokenStr: string): Promise<AuthTokens> {
    const payload = this.verifyToken(refreshTokenStr, this.REFRESH_SECRET);
    if (!payload || payload.type !== 'refresh') {
      throw new UnauthorizedException('Невалидный или просроченный Refresh Token');
    }
    const entity = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!entity) throw new UnauthorizedException('Пользователь не найден');
    return this.generateTokens(this.entityToUser(entity));
  }

  validateAccessToken(token: string): JwtPayload {
    const payload = this.verifyToken(token, this.JWT_SECRET);
    if (!payload || payload.type !== 'access') {
      throw new UnauthorizedException('Невалидный JWT токен доступа');
    }
    return payload;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const entity = await this.userRepo.findOne({ where: { id } });
    return entity ? this.entityToUser(entity) : undefined;
  }

  async getAllUsers(): Promise<Array<Omit<User, 'passwordHash'>>> {
    const entities = await this.userRepo.find({ order: { createdAt: 'DESC' } });
    return entities.map((e) => this.sanitizeUser(this.entityToUser(e)));
  }


  private generateTokens(user: User): AuthTokens {
    const now = Math.floor(Date.now() / 1000);
    const accessPayload: JwtPayload = {
      sub: user.id,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
      type: 'access',
      iat: now,
      exp: now + this.ACCESS_TOKEN_EXPIRY,
    };
    const refreshPayload: JwtPayload = {
      sub: user.id,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
      type: 'refresh',
      iat: now,
      exp: now + this.REFRESH_TOKEN_EXPIRY,
    };
    const accessToken = this.signToken(accessPayload, this.JWT_SECRET);
    const refreshToken = this.signToken(refreshPayload, this.REFRESH_SECRET);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    };
  }

  private signToken(payload: JwtPayload, secret: string): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64urlEncode(JSON.stringify(header));
    const encodedPayload = this.base64urlEncode(JSON.stringify(payload));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signatureInput)
      .digest('base64url');
    return `${signatureInput}.${signature}`;
  }

  private verifyToken(token: string, secret: string): JwtPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const [encodedHeader, encodedPayload, signature] = parts;
      const signatureInput = `${encodedHeader}.${encodedPayload}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signatureInput)
        .digest('base64url');
      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
      }
      const payloadStr = this.base64urlDecode(encodedPayload);
      const payload: JwtPayload = JSON.parse(payloadStr);
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return null;
      }
      return payload;
    } catch (e) {
      return null;
    }
  }

  private hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    if (!storedHash || !password) return false;
    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
      return bcrypt.compareSync(password, storedHash);
    }
    if (storedHash.includes(':')) {
      const [salt, originalHash] = storedHash.split(':');
      if (salt && originalHash) {
        const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
        return hash === originalHash;
      }
    }
    return false;
  }

  private base64urlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private base64urlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64').toString('utf8');
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
