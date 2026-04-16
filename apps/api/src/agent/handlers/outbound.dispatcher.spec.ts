import { Test, TestingModule } from '@nestjs/testing';
import {
  AgentConversationStatus,
  AgentMessageRole,
  MessageDirection,
  MessageStatus,
} from '@prisma/client';
import { OutboundDispatcher, DispatchInput } from './outbound.dispatcher';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import type { StructuredReply } from '../schemas/structured-reply.schema';

const okReply: StructuredReply = {
  should_respond: true,
  reply: 'Oi, tudo bem?',
  mark_qualified: false,
  qualification_reason: null,
  suggested_next_stage_id: null,
  request_handoff: false,
  handoff_reason: null,
};

function makeInput(overrides: Partial<DispatchInput> = {}): DispatchInput {
  return {
    reply: okReply,
    conversation: { id: 'conv-1', contactId: 'contact-1' },
    card: { id: 'card-1', tenantId: 'tenant-1' },
    agent: {
      id: 'agent-1',
      name: 'Qualificador',
      knowledgeBase: { content: null },
    },
    tenant: { name: 'Acme' },
    profile: null,
    inboundIsDisclosureChallenge: false,
    rawOutput: '{"ok":true}',
    ...overrides,
  };
}

describe('OutboundDispatcher', () => {
  let dispatcher: OutboundDispatcher;
  let prisma: {
    agentMessage: { findFirst: jest.Mock; create: jest.Mock };
    whatsAppMessage: { create: jest.Mock };
    agentConversation: { update: jest.Mock };
    cardActivity: { create: jest.Mock };
  };
  let notifications: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      agentMessage: { findFirst: jest.fn(), create: jest.fn() },
      whatsAppMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'wa-out-1',
          createdAt: new Date('2026-04-16T12:00:00Z'),
        }),
      },
      agentConversation: { update: jest.fn() },
      cardActivity: { create: jest.fn() },
    };
    notifications = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboundDispatcher,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();
    dispatcher = module.get(OutboundDispatcher);
  });

  it('happy path: writes the Prisma triad and persists StructuredReply in AgentMessage.metadata (D-12)', async () => {
    prisma.agentMessage.findFirst.mockResolvedValue(null); // no prior AGENT message

    const result = await dispatcher.send(makeInput());
    expect(result).toEqual({ status: 'sent', whatsAppMessageId: 'wa-out-1' });

    // 1) whatsAppMessage.create
    expect(prisma.whatsAppMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contactId: 'contact-1',
        content: 'Oi, tudo bem?',
        direction: MessageDirection.OUTBOUND,
        status: MessageStatus.SENT,
      }),
    });
    // 2) agentMessage.create with metadata = StructuredReply (D-12)
    const agentMsgCall = prisma.agentMessage.create.mock.calls[0][0];
    expect(agentMsgCall.data).toMatchObject({
      conversationId: 'conv-1',
      role: AgentMessageRole.AGENT,
      content: 'Oi, tudo bem?',
      whatsAppMessageId: 'wa-out-1',
    });
    expect(agentMsgCall.data.metadata).toEqual(okReply);
    // 3) agentConversation.update
    expect(prisma.agentConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: expect.objectContaining({
          status: AgentConversationStatus.OPEN,
        }),
      }),
    );
    // 4) cardActivity.create AGENT_RESPONSE
    const activityCall = prisma.cardActivity.create.mock.calls[0][0];
    expect(activityCall.data.type).toBe('AGENT_RESPONSE');
    expect(activityCall.data.metadata).toEqual({ raw_output: '{"ok":true}' });
  });

  it('empty reply → AGENT_HELD with reason=empty_reply, no whatsapp call', async () => {
    const result = await dispatcher.send(
      makeInput({ reply: { ...okReply, reply: '   ' } }),
    );
    expect(result).toEqual({ status: 'held', reason: 'empty_reply' });
    expect(prisma.whatsAppMessage.create).not.toHaveBeenCalled();
    const activityCall = prisma.cardActivity.create.mock.calls[0][0];
    expect(activityCall.data.type).toBe('AGENT_HELD');
    expect(activityCall.data.metadata.reason).toBe('empty_reply');
  });

  it('G5 throttle fires when last AGENT message is <10s old and no intervening USER', async () => {
    prisma.agentMessage.findFirst
      .mockResolvedValueOnce({ createdAt: new Date(Date.now() - 3_000) }) // lastAgent
      .mockResolvedValueOnce(null); // no intervening USER

    const result = await dispatcher.send(makeInput());
    expect(result).toEqual({ status: 'held', reason: 'throttle_consecutive' });
    expect(prisma.whatsAppMessage.create).not.toHaveBeenCalled();
    const activityCall = prisma.cardActivity.create.mock.calls[0][0];
    expect(activityCall.data.type).toBe('AGENT_HELD');
    expect(activityCall.data.metadata.reason).toBe('throttle_consecutive');
  });

  it('G5 no-throttle when last AGENT message is older than 10s', async () => {
    prisma.agentMessage.findFirst
      .mockResolvedValueOnce({ createdAt: new Date(Date.now() - 60_000) })
      .mockResolvedValueOnce(null);

    const result = await dispatcher.send(makeInput());
    expect(result.status).toBe('sent');
    expect(prisma.whatsAppMessage.create).toHaveBeenCalled();
  });

  it('G5 no-throttle when there IS an intervening USER message since last AGENT', async () => {
    prisma.agentMessage.findFirst
      .mockResolvedValueOnce({ createdAt: new Date(Date.now() - 3_000) })
      .mockResolvedValueOnce({ id: 'user-between' }); // intervening user

    const result = await dispatcher.send(makeInput());
    expect(result.status).toBe('sent');
  });

  it('G4 disclosure rewrites reply and logs AGENT_DISCLOSURE_ENFORCED then continues', async () => {
    prisma.agentMessage.findFirst.mockResolvedValue(null);

    const result = await dispatcher.send(
      makeInput({
        inboundIsDisclosureChallenge: true,
        reply: { ...okReply, reply: 'Claro, posso ajudar!' }, // no AI affirmation
      }),
    );
    expect(result.status).toBe('sent');
    // First activity is AGENT_DISCLOSURE_ENFORCED, second is AGENT_RESPONSE
    const firstActivity = prisma.cardActivity.create.mock.calls[0][0];
    expect(firstActivity.data.type).toBe('AGENT_DISCLOSURE_ENFORCED');
    expect(firstActivity.data.metadata.original_reply).toBe(
      'Claro, posso ajudar!',
    );
    expect(firstActivity.data.metadata.rewritten_reply).toContain(
      'agente virtual',
    );
    // Verify sent content is the rewritten disclosure template
    const whatsCall = prisma.whatsAppMessage.create.mock.calls[0][0];
    expect(whatsCall.data.content).toContain('agente virtual');
    expect(whatsCall.data.content).toContain('Acme');
  });

  it('G4 skipped when inboundIsDisclosureChallenge=false', async () => {
    prisma.agentMessage.findFirst.mockResolvedValue(null);
    const result = await dispatcher.send(makeInput());
    expect(result.status).toBe('sent');
    // Only one activity (AGENT_RESPONSE). No AGENT_DISCLOSURE_ENFORCED.
    const types = prisma.cardActivity.create.mock.calls.map(
      (c) => c[0].data.type,
    );
    expect(types).not.toContain('AGENT_DISCLOSURE_ENFORCED');
  });

  it('G6 blocked-term match: AGENT_REFUSAL_REVIEW + notification + whatsapp NOT called', async () => {
    prisma.agentMessage.findFirst.mockResolvedValue(null);
    const result = await dispatcher.send(
      makeInput({
        profile: { blockedTerms: ['preço'] },
        reply: { ...okReply, reply: 'O preço fica em R$ 500.' },
      }),
    );
    expect(result).toEqual({ status: 'held', reason: 'blocked_term' });
    expect(prisma.whatsAppMessage.create).not.toHaveBeenCalled();

    const activityCall = prisma.cardActivity.create.mock.calls[0][0];
    expect(activityCall.data.type).toBe('AGENT_REFUSAL_REVIEW');
    expect(activityCall.data.metadata).toMatchObject({
      reason: 'blocked_term',
      matched_term: 'preço',
      reply_redacted: 'O preço fica em R$ 500.',
    });
    expect(notifications.emit).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        type: 'AGENT_REFUSAL_REVIEW',
        reason: 'blocked_term',
        matchedTerm: 'preço',
      }),
    );
  });

  it('G6 blocked-term is case-insensitive (match DESCONTO against desconto)', async () => {
    prisma.agentMessage.findFirst.mockResolvedValue(null);
    const result = await dispatcher.send(
      makeInput({
        profile: { blockedTerms: ['DESCONTO'] },
        reply: { ...okReply, reply: 'Temos um desconto especial.' },
      }),
    );
    expect(result).toEqual({ status: 'held', reason: 'blocked_term' });
  });

  it('G6 skipped when no blockedTerms configured (profile.blockedTerms undefined)', async () => {
    prisma.agentMessage.findFirst.mockResolvedValue(null);
    const result = await dispatcher.send(
      makeInput({
        profile: {},
        reply: { ...okReply, reply: 'Qualquer coisa.' },
      }),
    );
    expect(result.status).toBe('sent');
    const types = prisma.cardActivity.create.mock.calls.map(
      (c) => c[0].data.type,
    );
    expect(types).not.toContain('AGENT_REFUSAL_REVIEW');
  });

  it('G7 commercial pattern + KB not grounded → AGENT_COMMERCIAL_DEFLECTION + handoff_required', async () => {
    prisma.agentMessage.findFirst.mockResolvedValue(null);
    const result = await dispatcher.send(
      makeInput({
        reply: { ...okReply, reply: 'Te passo por R$ 500.' },
        agent: {
          id: 'agent-1',
          name: 'Qualificador',
          knowledgeBase: { content: 'Totalmente sem números.' },
        },
      }),
    );
    expect(result).toEqual({
      status: 'handoff_required',
      reason: 'commercial_deflection',
    });
    expect(prisma.whatsAppMessage.create).not.toHaveBeenCalled();
    const activityCall = prisma.cardActivity.create.mock.calls[0][0];
    expect(activityCall.data.type).toBe('AGENT_COMMERCIAL_DEFLECTION');
    expect(activityCall.data.metadata.matched_pattern).toMatch(/R\$\s*500/);
  });

  it('G7 grounded (KB includes matched pattern) → happy path', async () => {
    prisma.agentMessage.findFirst.mockResolvedValue(null);
    const result = await dispatcher.send(
      makeInput({
        reply: { ...okReply, reply: 'Nosso plano começa em R$ 500.' },
        agent: {
          id: 'agent-1',
          name: 'Qualificador',
          knowledgeBase: {
            content: 'Plano inicial R$ 500 por mês. Plano pro R$ 1200.',
          },
        },
      }),
    );
    expect(result.status).toBe('sent');
    expect(prisma.whatsAppMessage.create).toHaveBeenCalled();
  });

  it('AgentMessage.metadata round-trips the exact StructuredReply (D-12 assertion)', async () => {
    prisma.agentMessage.findFirst.mockResolvedValue(null);
    const richReply: StructuredReply = {
      should_respond: true,
      reply: 'Vamos marcar.',
      mark_qualified: true,
      qualification_reason: 'Demonstrou fit.',
      suggested_next_stage_id: 'stage-xyz',
      request_handoff: false,
      handoff_reason: null,
    };
    await dispatcher.send(makeInput({ reply: richReply }));
    const call = prisma.agentMessage.create.mock.calls[0][0];
    expect(call.data.metadata).toEqual(richReply);
  });
});
