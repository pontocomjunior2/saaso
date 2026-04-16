// [CITED: 05-CONTEXT.md D-01 (hybrid — never moves card), D-06 (notification),
// D-25 (invalid-stage fallback metadata), 05-PATTERNS.md §S1 + §S2]
// Side-effect-only handler for reply.mark_qualified. Writes AGENT_QUALIFIED
// CardActivity with metadata + emits AGENT_QUALIFIED_READY_TO_ADVANCE notification.
// Runs BETWEEN structured-reply and outbound — NON-terminal (D-11 cascade).
//
// G3 (cross-tenant/cross-pipeline guard): stage is validated via
// prisma.stage.findFirst({ where: { id, pipelineId } }). Stage has NO deletedAt
// field per schema.prisma:82-98 — do NOT filter on it.
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';
import { AGENT_ACTIVITY_TYPES } from '../constants/card-activity-types';
import type { StructuredReply } from '../schemas/structured-reply.schema';

export interface QualificationInput {
  reply: StructuredReply;
  card: {
    id: string;
    pipelineId: string;
    title: string | null;
    tenantId: string;
  };
  rawOutput: string;
}

@Injectable()
export class QualificationHandler {
  private readonly logger = new Logger(QualificationHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async apply(input: QualificationInput): Promise<void> {
    if (!input.reply.mark_qualified) return;

    let validStageId: string | null = null;
    let invalidStageId: string | null = null;
    const suggested = input.reply.suggested_next_stage_id;
    // Strict guard: rejects null/undefined AND empty string before Prisma call.
    // Schema fact (apps/api/prisma/schema.prisma:82-98): Stage has no deletedAt.
    if (typeof suggested === 'string' && suggested.length > 0) {
      const stage = await this.prisma.stage.findFirst({
        where: { id: suggested, pipelineId: input.card.pipelineId },
        select: { id: true },
      });
      if (stage) {
        validStageId = stage.id;
      } else {
        invalidStageId = suggested;
      }
    }

    const activityMetadata: Record<string, unknown> = {
      qualification_reason: input.reply.qualification_reason,
      suggested_next_stage_id: validStageId,
      raw_output: input.rawOutput,
    };
    if (invalidStageId) {
      activityMetadata.invalid_suggested_stage_id = invalidStageId;
    }

    await this.prisma.cardActivity.create({
      data: {
        cardId: input.card.id,
        type: AGENT_ACTIVITY_TYPES.AGENT_QUALIFIED,
        content: input.reply.qualification_reason
          ? `Agente marcou o lead como qualificado: ${input.reply.qualification_reason}`
          : 'Agente marcou o lead como qualificado.',
        metadata: activityMetadata as Prisma.InputJsonValue,
      },
    });

    this.notifications.emit(input.card.tenantId, {
      type: 'AGENT_QUALIFIED_READY_TO_ADVANCE',
      cardId: input.card.id,
      cardTitle: input.card.title ?? 'Lead',
      at: new Date().toISOString(),
      suggestedStageId: validStageId,
      qualificationReason: input.reply.qualification_reason ?? null,
    });
  }
}
