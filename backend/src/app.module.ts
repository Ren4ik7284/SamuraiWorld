import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AuthService } from './modules/auth/auth.service';
import { AuthController } from './gateway/auth.controller';
import { JwtAuthGuard, OptionalJwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { MinecraftPingService } from './microservices/server-status/minecraft-ping.service';
import { ServerStatusService } from './microservices/server-status/server-status.service';
import { ContentService } from './microservices/content/content.service';
import { GovernmentService } from './microservices/government/government.service';
import { SupportService } from './microservices/support/support.service';
import { McExecutorService } from './microservices/payments/mc-executor.service';
import { PaymentsService } from './microservices/payments/payments.service';
import { ServerController } from './gateway/server.controller';
import { ContentController } from './gateway/content.controller';
import { GovernmentController } from './gateway/government.controller';
import { SupportController } from './gateway/support.controller';
import { PaymentsController } from './gateway/payments.controller';
import { EventsGateway } from './gateway/events.gateway';
import { RateLimiterMiddleware } from './security/rate-limiter.middleware';
import { SecurityHeadersMiddleware } from './security/security-headers.middleware';
import { DatabaseModule } from './modules/database/database.module';

@Module({
  imports: [DatabaseModule],

  controllers: [
    AuthController,
    ServerController,
    ContentController,
    GovernmentController,
    SupportController,
    PaymentsController,
  ],
  providers: [
    AuthService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    MinecraftPingService,
    ServerStatusService,
    ContentService,
    GovernmentService,
    SupportService,
    McExecutorService,
    PaymentsService,
    EventsGateway,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityHeadersMiddleware, RateLimiterMiddleware)
      .forRoutes('*');
  }
}
