import { Test, TestingModule } from '@nestjs/testing';
import { AgentConversationStatus } from '@prisma/client';
import { HandoffHandler } from './handoff.handler';
import { PrismaService } from '../../prisma/prisma.service';
import type { StructuredReply } from '../schemas/structured-reply.schema';

const baseReply: StructuredReply = {
  should_respond: false,
  reply: null,
  mark_qualified: false,
  qualification_reason: null,
  suggested_next_stage_id: null,
  request_handoff: true,
  handoff_reason: null,
};

describe('HandoffHandler', () => {
  let handler: HandoffHandler;
  let prisma: {
    agentConversation: { update: jest.Mock };
    cardActivity: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      agentConversation: { update: jest.fn() },
      cardActivity: { create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandoffHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(HandoffHandler);
  });

  it('updates conversation status to HANDOFF_REQUIRED', async () => {
    await handler.apply({
      reply: baseReply,
      conversation: { id: 'conv-1' },
      card: { id: 'card-1' },
      agentName: 'Qualificador',
      rawOutput: '{}',
    });
    expect(prisma.agentConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: expect.objectContaining({
          status: AgentConversationStatus.HANDOFF_REQUIRED,
        }),
      }),
    );
  });

  it('writes AGENT_HANDOFF activity with reason when handoff_reason provided', async () => {
    await handler.apply({
      reply: { ...baseReply, handoff_reason: 'Lead pediu falar diretamente.' },
      conversation: { id: 'conv-2' },
      card: { id: 'card-2' },
      agentName: 'Qualificador',
      rawOutput: 'raw',
    });
    expect(prisma.cardActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: 'card-2',
        type: 'AGENT_HANDOFF',
        content:
          'Agente Qualificador solicitou handoff humano: Lead pediu falar diretamente.',
        metadata: {
          handoff_reason: 'Lead pediu falar diretamente.',
          raw_output: 'raw',
        },
      }),
    });
  });

  it('writes AGENT_HANDOFF activity without reason when handoff_reason is null', async () => {
    await handler.apply({
      reply: { ...baseReply, handoff_reason: null },
      conversation: { id: 'conv-3' },
      card: { id: 'card-3' },
      agentName: 'Qualificador',
      rawOutput: '{}',
    });
    const call = prisma.cardActivity.create.mock.calls[0][0];
    expect(call.data.content).toBe('Agente Qualificador solicitou handoff humano.');
    expect(call.data.metadata.handoff_reason).toBeNull();
  });

  it('returns handoff_required status with conversationId', async () => {
    const result = await handler.apply({
      reply: baseReply,
      conversation: { id: 'conv-42' },
      card: { id: 'card-42' },
      agentName: 'Qualificador',
      rawOutput: '{}',
    });
    expect(result).toEqual({
      status: 'handoff_required',
      conversationId: 'conv-42',
    });
  });

  it('treats whitespace-only handoff_reason as empty (no reason in content)', async () => {
    await handler.apply({
      reply: { ...baseReply, handoff_reason: '   ' },
      conversation: { id: 'conv-4' },
      card: { id: 'card-4' },
      agentName: 'Qualificador',
      rawOutput: '{}',
    });
    const call = prisma.cardActivity.create.mock.calls[0][0];
    expect(call.data.content).toBe('Agente Qualificador solicitou handoff humano.');
  });
});
