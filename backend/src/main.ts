import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
function loadEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(__dirname, '../../.env'),
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.substring(0, eqIdx).trim();
            const val = trimmed.substring(eqIdx + 1).trim();
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
      } catch {}
      break;
    }
  }
}
loadEnv();
import * as express from 'express';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // Request payload size limits to prevent memory exhaustion DoS
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // CORS configuration
  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://localhost:4201',
      'https://samuraiworld.site',
      'https://www.samuraiworld.site',
      /\.vercel\.app$/,
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('SamuraiWorld Microservice API Gateway')
    .setDescription('REST API & Microservices Gateway для политического Minecraft сервера SamuraiWorld')
    .setVersion('2.0')
    .addTag('server', 'Мониторинг сервера и Live Онлайн (Ping Service)')
    .addTag('content', 'Новости и Правила/Конституция (Content Service)')
    .addTag('government', 'Политическая система, Паспорта, Законы и Выборы (Government Service)')
    .addTag('payments', 'Оплата и авто-выдача привилегий на майнкрафт сервере (RCON / Pterodactyl)')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`\n🏯 SamuraiWorld Microservice Gateway запущен на: http://localhost:${port}/api`);
  console.log(`📖 Swagger API Документация: http://localhost:${port}/api/docs\n`);
}
bootstrap();
