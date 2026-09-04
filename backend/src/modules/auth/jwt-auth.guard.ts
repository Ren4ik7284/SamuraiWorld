import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, JwtPayload } from './auth.service';
export interface AuthenticatedRequest extends Express.Request {
  user?: JwtPayload;
}
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Отсутствует заголовок Authorization');
    }
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Формат заголовка должен быть: Bearer <token>');
    }
    try {
      const payload = this.authService.validateAccessToken(token);
      request.user = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException('Недействительный или истекший JWT токен');
    }
  }
}
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (authHeader) {
      const [type, token] = authHeader.split(' ');
      if (type === 'Bearer' && token) {
        try {
          const payload = this.authService.validateAccessToken(token);
          request.user = payload;
        } catch (err) {
        }
      }
    }
    return true;
  }
}
