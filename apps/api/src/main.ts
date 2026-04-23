import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';

function buildAllowedOrigins(frontendUrl?: string) {
  const configuredOrigins = (frontendUrl ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(
    new Set([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3010',
      'http://127.0.0.1:3010',
      ...configuredOrigins,
    ]),
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = Number(configService.get<string>('PORT') ?? '3001');
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const allowedOrigins = buildAllowedOrigins(frontendUrl);

  console.log('[CORS] FRONTEND_URL:', frontendUrl);
  console.log('[CORS] allowedOrigins:', allowedOrigins);

  // Raw Express middleware — runs before all NestJS handlers
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin as string | undefined;
    const allowed = !origin || allowedOrigins.includes(origin);
    console.log('[CORS-RAW]', req.method, origin ?? '(no origin)', '| allowed:', allowed);

    if (allowed && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept,X-Requested-With');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  await app.listen(port);
}
bootstrap();
