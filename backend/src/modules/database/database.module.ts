import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { VipOrderEntity } from './entities/vip-order.entity';

/**
 * Глобальный DatabaseModule — подключает TypeORM к PostgreSQL.
 * Конфигурация берётся из переменных окружения (DB_HOST, DB_PORT, etc.)
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USER || 'samurai_user',
      password: process.env.DB_PASS || 'samurai_password',
      database: process.env.DB_NAME || 'samuraiworld_db',
      entities: [UserEntity, VipOrderEntity],
      // synchronize: true — автоматически создаёт таблицы.
      // В продакшене рекомендуется заменить на миграции.
      synchronize: true,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      retryAttempts: 5,
      retryDelay: 3000,
      logging: process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forFeature([UserEntity, VipOrderEntity]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
