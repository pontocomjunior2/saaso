import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;

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

  app.enableCors({
    origin: (origin: string | undefined, callback: CorsOriginCallback) => {
      const allowed = !origin || allowedOrigins.includes(origin);
      console.log('[CORS] request origin:', JSON.stringify(origin), '| allowed:', allowed);
      if (allowed) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
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
