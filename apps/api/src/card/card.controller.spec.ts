import { ForbiddenException, INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CardController } from './card.controller';
import { CardService } from './card.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

describe('CardController', () => {
  let app: INestApplication;
  let cardService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    getCardTimeline: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    moveCard: jest.Mock;
    agentMove: jest.Mock;
    sendMessage: jest.Mock;
  };

  beforeEach(async () => {
    cardService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      getCardTimeline: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      moveCard: jest.fn(),
      agentMove: jest.fn(),
      sendMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardController],
      providers: [{ provide: CardService, useValue: cardService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          request.user = {
            id: request.headers['x-user-id'] ?? 'user-1',
            tenantId: request.headers['x-tenant-id'] ?? 'tenant-1',
          };
          return true;
        },
      })
      .overrideGuard(TenantGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          request.tenantId = request.user?.tenantId;
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  it('GET /cards/:id/timeline returns 200 with items and nextCursor', async () => {
    cardService.getCardTimeline.mockResolvedValue({
      items: [{ source: 'activity', createdAt: '2026-04-16T10:00:00.000Z', data: { id: 'act-1' } }],
      nextCursor: '2026-04-16T10:00:00.000Z',
    });

    await request(app.getHttpServer())
      .get('/cards/card-1/timeline')
      .expect(200)
      .expect({
        items: [{ source: 'activity', createdAt: '2026-04-16T10:00:00.000Z', data: { id: 'act-1' } }],
        nextCursor: '2026-04-16T10:00:00.000Z',
      });

    expect(cardService.getCardTimeline).toHaveBeenCalledWith(
      'card-1',
      'tenant-1',
      100,
      undefined,
    );
  });

  it('GET /cards/:id/timeline is protected by JwtAuthGuard and TenantGuard', async () => {
    const guards =
      Reflect.getMetadata('__guards__', CardController) ?? [];

    expect(guards).toHaveLength(2);
    expect(guards[0]).toBe(JwtAuthGuard);
    expect(guards[1]).toBe(TenantGuard);
  });

  it('GET /cards/:id/timeline parses and forwards limit and before query params', async () => {
    cardService.getCardTimeline.mockResolvedValue({ items: [], nextCursor: null });

    await request(app.getHttpServer())
      .get('/cards/card-1/timeline')
      .query({
        limit: '50',
        before: '2026-04-16T10:00:00.000Z',
      })
      .expect(200);

    expect(cardService.getCardTimeline).toHaveBeenCalledWith(
      'card-1',
      'tenant-1',
      50,
      new Date('2026-04-16T10:00:00.000Z'),
    );
  });

  it('GET /cards/:id/timeline surfaces ForbiddenException as 403', async () => {
    cardService.getCardTimeline.mockRejectedValue(
      new ForbiddenException('Tenant mismatch'),
    );

    await request(app.getHttpServer())
      .get('/cards/card-1/timeline')
      .expect(403);
  });

  it('GET /cards/:id/timeline surfaces NotFoundException as 404', async () => {
    cardService.getCardTimeline.mockRejectedValue(
      new NotFoundException('Card not found'),
    );

    await request(app.getHttpServer())
      .get('/cards/missing/timeline')
      .expect(404);
  });

  it('GET /cards/:id/timeline rejects invalid before with 400', async () => {
    await request(app.getHttpServer())
      .get('/cards/card-1/timeline')
      .query({ before: 'not-a-date' })
      .expect(400);

    expect(cardService.getCardTimeline).not.toHaveBeenCalled();
  });

  it('GET /cards/:id/timeline rejects limit above 200 with 400', async () => {
    await request(app.getHttpServer())
      .get('/cards/card-1/timeline')
      .query({ limit: '500' })
      .expect(400);

    expect(cardService.getCardTimeline).not.toHaveBeenCalled();
  });
});
