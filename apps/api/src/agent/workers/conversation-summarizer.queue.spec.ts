import { Test, TestingModule } from '@nestjs/testing';
import { ConversationSummarizerQueue } from './conversation-summarizer.queue';
import { PrismaService } from '../../prisma/prisma.service';
import { AiService } from '../../common/services/ai.service';

// Mock bullmq entirely — we never want a real Redis connection in unit tests.
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

const mockAiService: AnyMock = {
  generateResponse: jest.fn(),
};

const mockPrisma: AnyMock = {
  agentMessage: {
    findMany: jest.fn(),
  },
  agentConversation: {
    update: jest.fn().mockResolvedValue({}),
  },
};

describe('ConversationSummarizerQueue', () => {
  let service: ConversationSummarizerQueue;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationSummarizerQueue,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAiService },
      ],
    }).compile();

    service = module.get<ConversationSummarizerQueue>(
      ConversationSummarizerQueue,
    );

    // Manually inject the bullmq mock queue and mark operational so
    // enqueue() runs the add-path without needing onModuleInit().
    const svc = service as any;
    const bullmq = require('bullmq');
    svc.queue = bullmq.__mockQueue;
    svc.queueOperational = true;
  });

  describe('enqueue', () => {
    it('calls queue.add with conversationId payload and jobId=conversationId for dedupe', async () => {
      const conversationId = 'conv-1';
      const ok = await service.enqueue(conversationId);

      expect(ok).toBe(true);
      const bullmq = require('bullmq');
      expect(bullmq.__mockQueue.add).toHaveBeenCalledWith(
        'agent_summarize.execute',
        { conversationId },
        expect.objectContaining({
          jobId: conversationId,
          delay: 0,
        }),
      );
    });

    it('returns false when queue not operational', async () => {
      const svc = service as any;
      svc.queueOperational = false;
      const ok = await service.enqueue('conv-x');
      expect(ok).toBe(false);
    });
  });

  describe('processJob', () => {
    const makeJob = (conversationId: string) =>
      ({ data: { conversationId } }) as any;

    it('early-returns when fewer than 4 messages exist (no AI call, no DB update)', async () => {
      mockPrisma.agentMessage.findMany.mockResolvedValue([
        { role: 'USER', content: 'oi', createdAt: new Date() },
        { role: 'AGENT', content: 'olá', createdAt: new Date() },
      ]);

      await service.processJob(makeJob('conv-2'));

      expect(mockAiService.generateResponse).not.toHaveBeenCalled();
      expect(mockPrisma.agentConversation.update).not.toHaveBeenCalled();
    });

    it('happy path: concatenates transcript, calls AiService, writes summary back', async () => {
      const rows = [
        { role: 'USER', content: 'oi', createdAt: new Date() },
        { role: 'AGENT', content: 'olá, como posso ajudar?', createdAt: new Date() },
        { role: 'USER', content: 'quero saber sobre preço', createdAt: new Date() },
        { role: 'AGENT', content: 'temos planos a partir de R$99', createdAt: new Date() },
        { role: 'USER', content: 'fechado', createdAt: new Date() },
      ];
      mockPrisma.agentMessage.findMany.mockResolvedValue(rows);
      mockAiService.generateResponse.mockResolvedValue(
        '  Lead pediu preço; agente ofereceu plano de R$99; lead aceitou.  ',
      );

      await service.processJob(makeJob('conv-3'));

      // generateResponse called with condense-in-PT-BR system prompt and
      // the joined role:content transcript as the user message.
      expect(mockAiService.generateResponse).toHaveBeenCalledTimes(1);
      const [sysPrompt, userMsg, opts] =
        mockAiService.generateResponse.mock.calls[0];
      expect(sysPrompt).toContain('Condense');
      expect(sysPrompt).toContain('500 tokens');
      expect(userMsg).toContain('Agente:');
      expect(userMsg).toContain('Lead:');
      expect(userMsg).toContain('quero saber sobre preço');
      expect(opts).toMatchObject({ temperature: 0.2, maxTokens: 600 });

      // Prisma write has the trimmed summary text.
      expect(mockPrisma.agentConversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-3' },
        data: {
          summary:
            'Lead pediu preço; agente ofereceu plano de R$99; lead aceitou.',
        },
      });
    });

    it('preserves previous summary when AiService returns empty string (D-21)', async () => {
      const rows = Array.from({ length: 6 }, (_, i) => ({
        role: i % 2 === 0 ? 'USER' : 'AGENT',
        content: `msg ${i}`,
        createdAt: new Date(),
      }));
      mockPrisma.agentMessage.findMany.mockResolvedValue(rows);
      mockAiService.generateResponse.mockResolvedValue('   ');

      await expect(service.processJob(makeJob('conv-4'))).rejects.toThrow(
        /empty output/,
      );

      expect(mockPrisma.agentConversation.update).not.toHaveBeenCalled();
    });

    it('propagates AiService error (BullMQ marks failed, previous summary preserved)', async () => {
      const rows = Array.from({ length: 6 }, (_, i) => ({
        role: i % 2 === 0 ? 'USER' : 'AGENT',
        content: `msg ${i}`,
        createdAt: new Date(),
      }));
      mockPrisma.agentMessage.findMany.mockResolvedValue(rows);
      mockAiService.generateResponse.mockRejectedValue(
        new Error('openai 503'),
      );

      await expect(service.processJob(makeJob('conv-5'))).rejects.toThrow(
        'openai 503',
      );

      expect(mockPrisma.agentConversation.update).not.toHaveBeenCalled();
    });
  });
});
