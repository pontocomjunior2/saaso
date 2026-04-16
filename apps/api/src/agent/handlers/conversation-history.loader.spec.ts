import { Test, TestingModule } from '@nestjs/testing';
import { AgentMessageRole } from '@prisma/client';
import {
  ConversationHistoryLoader,
  HistoryTurn,
} from './conversation-history.loader';
import { PrismaService } from '../../prisma/prisma.service';

describe('ConversationHistoryLoader', () => {
  let loader: ConversationHistoryLoader;
  let prisma: { agentMessage: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { agentMessage: { findMany: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationHistoryLoader,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    loader = module.get(ConversationHistoryLoader);
  });

  it('returns empty array when the conversation has no messages', async () => {
    prisma.agentMessage.findMany.mockResolvedValue([]);
    const result = await loader.load({
      conversationId: 'conv-1',
      windowSize: 20,
    });
    expect(result).toEqual<HistoryTurn[]>([]);
    expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'conv-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    );
  });

  it('returns turns in oldest-first order (reversed from desc Prisma query)', async () => {
    // Prisma returns desc (newest first); loader must reverse to oldest-first.
    prisma.agentMessage.findMany.mockResolvedValue([
      {
        role: AgentMessageRole.USER,
        content: 'msg-3-newest',
        createdAt: new Date('2026-04-16T12:02:00Z'),
      },
      {
        role: AgentMessageRole.AGENT,
        content: 'msg-2-mid',
        createdAt: new Date('2026-04-16T12:01:00Z'),
      },
      {
        role: AgentMessageRole.USER,
        content: 'msg-1-oldest',
        createdAt: new Date('2026-04-16T12:00:00Z'),
      },
    ]);
    const result = await loader.load({
      conversationId: 'conv-2',
      windowSize: 20,
    });
    expect(result).toEqual<HistoryTurn[]>([
      { role: 'user', content: 'msg-1-oldest' },
      { role: 'assistant', content: 'msg-2-mid' },
      { role: 'user', content: 'msg-3-newest' },
    ]);
  });

  it('maps AGENT role → assistant; USER role → user', async () => {
    prisma.agentMessage.findMany.mockResolvedValue([
      {
        role: AgentMessageRole.AGENT,
        content: 'bot',
        createdAt: new Date('2026-04-16T12:00:01Z'),
      },
      {
        role: AgentMessageRole.USER,
        content: 'human',
        createdAt: new Date('2026-04-16T12:00:00Z'),
      },
    ]);
    const result = await loader.load({
      conversationId: 'conv-3',
      windowSize: 20,
    });
    expect(result).toEqual<HistoryTurn[]>([
      { role: 'user', content: 'human' },
      { role: 'assistant', content: 'bot' },
    ]);
  });

  it('clamps windowSize into [1, 50] to bound token cost', async () => {
    prisma.agentMessage.findMany.mockResolvedValue([]);
    await loader.load({ conversationId: 'conv-4', windowSize: 0 });
    expect(prisma.agentMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 }),
    );
    await loader.load({ conversationId: 'conv-4', windowSize: 999 });
    expect(prisma.agentMessage.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});
