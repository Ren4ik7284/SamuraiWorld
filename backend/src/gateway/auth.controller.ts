import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService, UserRole, getMasterAdmins } from '../modules/auth/auth.service';
import { JwtAuthGuard, OptionalJwtAuthGuard, AuthenticatedRequest } from '../modules/auth/jwt-auth.guard';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsArray, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Никнейм обязателен для заполнения' })
  @MinLength(3, { message: 'Никнейм должен содержать минимум 3 символа' })
  @MaxLength(16, { message: 'Никнейм не может превышать 16 символов' })
  @Matches(/^[a-zA-Z0-9_]{3,16}$/, { message: 'Никнейм может состоять только из латинских букв, цифр и знака _' })
  nickname: string;

  @IsString()
  @IsOptional()
  @IsEmail({}, { message: 'Укажите корректный адрес электронной почты' })
  @MaxLength(100, { message: 'Email не может быть длиннее 100 символов' })
  email?: string;

  @IsString()
  @IsNotEmpty({ message: 'Пароль обязателен для заполнения' })
  @MinLength(6, { message: 'Пароль должен содержать минимум 6 символов' })
  @MaxLength(64, { message: 'Пароль не может превышать 64 символа' })
  password: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  @MaxLength(6)
  verificationCode?: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(16)
  nickname: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(64)
  password: string;
}

export class SendVerificationCodeDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

export class VerifyEmailCodeDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  code: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class UpdateRoleDto {
  @IsString()
  @IsNotEmpty()
  role: UserRole;
}

export class UpdateAvatarDto {
  @IsString()
  @IsNotEmpty()
  nickname: string;

  @IsString()
  @IsNotEmpty()
  avatarUrl: string;
}

export class SyncUsersDto {
  @IsArray()
  users: any[];
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send_code')
  @ApiOperation({ summary: 'Отправить 6-значный проверочный код на Email' })
  sendVerificationCode(@Body() dto: SendVerificationCodeDto) {
    return this.authService.sendVerificationCode(dto.email);
  }

  @Post('verify_email')
  @ApiOperation({ summary: 'Проверить 6-значный код подтверждения Email' })
  verifyEmail(@Body() dto: VerifyEmailCodeDto) {
    const success = this.authService.verifyEmailCode(dto.email, dto.code);
    return { success, message: 'Email успешно подтвержден' };
  }

  @Post('register')
  @ApiOperation({ summary: 'Регистрация нового пользователя и получение JWT токенов' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Авторизация пользователя по нику/паролю и выдача JWT токенов' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Обновление JWT Access Token по Refresh Token' })
  refresh(@Body() dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new UnauthorizedException('Отсутствует Refresh Token');
    }
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить данные текущего авторизованного пользователя' })
  async getProfile(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Пользователь не авторизован');
    }
    const user = await this.authService.getUserById(userId);
    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  private checkIsAdminOrSupport(req: AuthenticatedRequest): void {
    const user = req.user;
    const isMaster = user && getMasterAdmins().includes(user.nickname?.toLowerCase());
    if (!user || (!isMaster && user.role !== 'admin' && user.role !== 'support')) {
      throw new ForbiddenException('Доступ разрешен только администраторам и службе поддержки');
    }
  }

  private checkIsAdminOnly(req: AuthenticatedRequest): void {
    const user = req.user;
    const isMaster = user && getMasterAdmins().includes(user.nickname?.toLowerCase());
    if (!user || (!isMaster && user.role !== 'admin')) {
      throw new ForbiddenException('Доступ разрешен только главному администратору');
    }
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить список всех зарегистрированных пользователей (Админ/Поддержка)' })
  getAllUsers(@Req() req: AuthenticatedRequest) {
    this.checkIsAdminOrSupport(req);
    return this.authService.getAllUsers();
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Удалить пользователя по ID или никнейму (Только Админ)' })
  deleteUser(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    this.checkIsAdminOnly(req);
    return this.authService.deleteUser(id);
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Изменить роль пользователя (Только Админ)' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto, @Req() req: AuthenticatedRequest) {
    this.checkIsAdminOnly(req);
    return this.authService.updateUserRole(id, dto.role);
  }

  @Post('sync_users')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Синхронизировать список пользователей (Только Админ)' })
  syncUsers(@Body() dto: SyncUsersDto, @Req() req: AuthenticatedRequest) {
    this.checkIsAdminOnly(req);
    return this.authService.syncUsers(dto.users || []);
  }

  @Patch('avatar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Обновить аватар пользователя' })
  updateAvatar(@Body() dto: UpdateAvatarDto, @Req() req: AuthenticatedRequest) {
    const currentUser = req.user;
    if (!currentUser) {
      throw new UnauthorizedException('Пользователь не авторизован');
    }
    const isMaster = getMasterAdmins().includes(currentUser.nickname?.toLowerCase());
    if (currentUser.role !== 'admin' && !isMaster && currentUser.nickname.toLowerCase() !== dto.nickname.toLowerCase()) {
      throw new ForbiddenException('Вы можете менять только свой аватар');
    }
    return this.authService.updateAvatar(dto.nickname, dto.avatarUrl);
  }
}
