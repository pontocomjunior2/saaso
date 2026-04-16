import { Test, TestingModule } from '@nestjs/testing';
import { QualificationHandler } from './qualification.handler';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import type { StructuredReply } from '../schemas/structured-reply.schema';

const baseReply: StructuredReply = {
  should_respond: true,
  reply: 'ok',
  mark_qualified: false,
  qualification_reason: null,
  suggested_next_stage_id: null,
  request_handoff: false,
  handoff_reason: null,
};

const baseCard = {
  id: 'card-1',
  pipelineId: 'pipe-1',
  title: 'Lead Teste',
  tenantId: 'tenant-1',
};

describe('QualificationHandler', () => {
  let handler: QualificationHandler;
  let prisma: {
    stage: { findFirst: jest.Mock };
    cardActivity: { create: jest.Mock };
    card: { update: jest.Mock };
  };
  let notifications: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      stage: { findFirst: jest.fn() },
      cardActivity: { create: jest.fn() },
      card: { update: jest.fn() },
    };
    notifications = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QualificationHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();
    handler = module.get(QualificationHandler);
  });

  it('early-returns (no writes, no emit) when mark_qualified=false', async () => {
    await handler.apply({
      reply: baseReply,
      card: baseCard,
      rawOutput: '{}',
    });
    expect(prisma.stage.findFirst).not.toHaveBeenCalled();
    expect(prisma.cardActivity.create).not.toHaveBeenCalled();
    expect(notifications.emit).not.toHaveBeenCalled();
  });

  it('writes AGENT_QUALIFIED with validStageId when stage belongs to pipeline', async () => {
    prisma.stage.findFirst.mockResolvedValue({ id: 'stage-valid' });
    await handler.apply({
      reply: {
        ...baseReply,
        mark_qualified: true,
        qualification_reason: 'Demonstrou interesse.',
        suggested_next_stage_id: 'stage-valid',
      },
      card: baseCard,
      rawOutput: '{"ok":true}',
    });

    expect(prisma.stage.findFirst).toHaveBeenCalledWith({
      where: { id: 'stage-valid', pipelineId: 'pipe-1' },
      select: { id: true },
    });
    expect(prisma.cardActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cardId: 'card-1',
          type: 'AGENT_QUALIFIED',
          content: 'Agente marcou o lead como qualificado: Demonstrou interesse.',
          metadata: {
            qualification_reason: 'Demonstrou interesse.',
            suggested_next_stage_id: 'stage-valid',
            raw_output: '{"ok":true}',
          },
        }),
      }),
    );
  });

  it('stores invalid_suggested_stage_id metadata when stage is cross-pipeline (D-25, G3)', async () => {
    prisma.stage.findFirst.mockResolvedValue(null); // cross-pipeline / unknown
    await handler.apply({
      reply: {
        ...baseReply,
        mark_qualified: true,
        qualification_reason: null,
        suggested_next_stage_id: 'foreign-stage-id',
      },
      card: baseCard,
      rawOutput: '{}',
    });

    const call = prisma.cardActivity.create.mock.calls[0][0];
    expect(call.data.metadata).toMatchObject({
      suggested_next_stage_id: null,
      invalid_suggested_stage_id: 'foreign-stage-id',
    });
  });

  it('empty-string suggested_next_stage_id → no Prisma call and no stage keys polluted', async () => {
    await handler.apply({
      reply: {
        ...baseReply,
        mark_qualified: true,
        suggested_next_stage_id: '',
      },
      card: baseCard,
      rawOutput: '{}',
    });
    expect(prisma.stage.findFirst).not.toHaveBeenCalled();
    const call = prisma.cardActivity.create.mock.calls[0][0];
    expect(call.data.metadata.suggested_next_stage_id).toBeNull();
    expect(
      'invalid_suggested_stage_id' in call.data.metadata,
    ).toBe(false);
  });

  it('null suggested_next_stage_id → no Prisma call', async () => {
    await handler.apply({
      reply: {
        ...baseReply,
        mark_qualified: true,
        suggested_next_stage_id: null,
      },
      card: baseCard,
      rawOutput: '{}',
    });
    expect(prisma.stage.findFirst).not.toHaveBeenCalled();
  });

  it('emits AGENT_QUALIFIED_READY_TO_ADVANCE notification with resolved fields', async () => {
    prisma.stage.findFirst.mockResolvedValue({ id: 'stage-valid' });
    await handler.apply({
      reply: {
        ...baseReply,
        mark_qualified: true,
        qualification_reason: 'Pronto.',
        suggested_next_stage_id: 'stage-valid',
      },
      card: baseCard,
      rawOutput: '{}',
    });
    expect(notifications.emit).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        type: 'AGENT_QUALIFIED_READY_TO_ADVANCE',
        cardId: 'card-1',
        cardTitle: 'Lead Teste',
        suggestedStageId: 'stage-valid',
        qualificationReason: 'Pronto.',
      }),
    );
  });

  it('never moves the card (D-01 hybrid — prisma.card.update not called)', async () => {
    prisma.stage.findFirst.mockResolvedValue({ id: 'stage-valid' });
    await handler.apply({
      reply: {
        ...baseReply,
        mark_qualified: true,
        suggested_next_stage_id: 'stage-valid',
      },
      card: baseCard,
      rawOutput: '{}',
    });
    expect(prisma.card.update).not.toHaveBeenCalled();
  });
});
