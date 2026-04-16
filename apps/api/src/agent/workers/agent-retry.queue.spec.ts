import { Test, TestingModule } from '@nestjs/testing';
import { AgentRetryQueue } from './agent-retry.queue';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { AgentRunnerService } from '../agent-runner.service';
import type { AgentRetryJobPayload } from './agent-retry.types';

jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    close: jest.fn().mockResolvedValue(undefined),
    waitUntilReady: jest.fn().mockResolvedValue(undefined),
  };

  const mockWorker = {
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    waitUntilReady: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn().mockImplementation(() => mockWorker),
    __mockQueue: mockQueue,
    __mockWorker: mockWorker,
  };
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue(undefined),
  }));
});

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyMock = Record<string, any>;

const mockRunner: AnyMock = {
  processInboundMessage: jest.fn(),
};

const mockNotification: AnyMock = {
  emit: jest.fn(),
};

const mockPrisma: AnyMock = {
  cardActivity: {
    create: jest.fn().mockResolvedValue({}),
  },
};

const basePayload: AgentRetryJobPayload = {
  conversationId: 'conv-99',
  cardId: 'card-77',
  tenantId: 'tenant-1',
  agentId: 'agent-5',
  contactId: 'contact-3',
  inboundContent: 'oi, tudo bem?',
  whatsAppMessageId: 'wa-msg-42',
  enqueuedAt: '2026-04-16T10:00:00.000Z',
};

describe('AgentRetryQueue', () => {
  let service: AgentRetryQueue;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentRetryQueue,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
        { provide: AgentRunnerService, useValue: mockRunner },
      ],
    }).compile();

    service = module.get<AgentRetryQueue>(AgentRetryQueue);
    const svc = service as any;
    const bullmq = require('bullmq');
    svc.queue = bullmq.__mockQueue;
    svc.queueOperational = true;
  });

  describe('enqueue', () => {
    it('queue.add receives attempts:3 + exponential backoff delay:2000', async () => {
      const ok = await service.enqueue(basePayload);
      expect(ok).toBe(true);

      const bullmq = require('bullmq');
      expect(bullmq.__mockQueue.add).toHaveBeenCalledWith(
        'agent_retry.execute',
        basePayload,
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      );
    });

    it('returns false when queue not operational', async () => {
      const svc = service as any;
      svc.queueOperational = false;
      const ok = await service.enqueue(basePayload);
      expect(ok).toBe(false);
    });
  });

  describe('processJob', () => {
    const makeJob = (payload: AgentRetryJobPayload) =>
      ({ data: payload }) as any;

    it('delegates to runner.processInboundMessage with the full payload', async () => {
      mockRunner.processInboundMessage.mockResolvedValue(undefined);

      await service.processJob(makeJob(basePayload));

      expect(mockRunner.processInboundMessage).toHaveBeenCalledTimes(1);
      expect(mockRunner.processInboundMessage).toHaveBeenCalledWith(basePayload);
    });

    it('propagates runner errors so BullMQ retries per attempts/backoff', async () => {
      mockRunner.processInboundMessage.mockRejectedValue(
        new Error('openai 503'),
      );

      await expect(service.processJob(makeJob(basePayload))).rejects.toThrow(
        'openai 503',
      );
    });
  });

  describe('onJobFailed', () => {
    const makeFailedJob = (attemptsMade: number, attempts = 3) =>
      ({
        data: basePayload,
        attemptsMade,
        opts: { attempts },
      }) as any;

    it('does NOT fire side-effects on non-final attempts (attemptsMade=1 of 3)', async () => {
      await service.onJobFailed(
        makeFailedJob(1),
        new Error('transient'),
      );

      expect(mockPrisma.cardActivity.create).not.toHaveBeenCalled();
      expect(mockNotification.emit).not.toHaveBeenCalled();
    });

    it('writes AGENT_ERROR activity AND emits AGENT_PERSISTENT_FAILURE on final attempt (attemptsMade=3)', async () => {
      await service.onJobFailed(
        makeFailedJob(3),
        new Error('openai persistent 503'),
      );

      // CardActivity AGENT_ERROR with metadata block
      expect(mockPrisma.cardActivity.create).toHaveBeenCalledTimes(1);
      const activityArg = mockPrisma.cardActivity.create.mock.calls[0][0];
      expect(activityArg.data).toMatchObject({
        cardId: 'card-77',
        type: 'AGENT_ERROR',
        metadata: expect.objectContaining({
          reason: 'persistent_failure',
          attempts: 3,
          last_error: 'openai persistent 503',
          conversationId: 'conv-99',
        }),
      });

      // Notification with AGENT_PERSISTENT_FAILURE type scoped to tenant
      expect(mockNotification.emit).toHaveBeenCalledTimes(1);
      const [tenantId, event] = mockNotification.emit.mock.calls[0];
      expect(tenantId).toBe('tenant-1');
      expect(event).toMatchObject({
        type: 'AGENT_PERSISTENT_FAILURE',
        cardId: 'card-77',
        conversationId: 'conv-99',
        attempts: 3,
        lastError: 'openai persistent 503',
      });
      expect(event.at).toEqual(expect.any(String));
    });

    it('no-ops when job is undefined (defensive)', async () => {
      await service.onJobFailed(undefined, new Error('x'));
      expect(mockPrisma.cardActivity.create).not.toHaveBeenCalled();
      expect(mockNotification.emit).not.toHaveBeenCalled();
    });
  });
});
