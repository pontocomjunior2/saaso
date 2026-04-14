import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CardService } from '../card/card.service';
import { StageRuleService } from '../stage-rule/stage-rule.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { NotificationService } from '../notification/notification.service';
import { CreateMetaMappingDto } from './dto/create-meta-mapping.dto';
import { MetaLeadPayload } from './dto/meta-lead-payload.dto';

function isPrismaUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    (e as any).code === 'P2002'
  );
}

@Injectable()
export class MetaWebhookService {
  private readonly logger = new Logger(MetaWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cardService: CardService,
    private readonly stageRuleService: StageRuleService,
    private readonly agentRunnerService: AgentRunnerService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Returns true when the given token matches ANY MetaWebhookMapping.verifyToken
   * stored in the database. DB-backed — does not rely on env vars.
   */
  async validateToken(token: string): Promise<boolean> {
    const mapping = await this.prisma.metaWebhookMapping.findFirst({
      where: { verifyToken: token },
    });
    return !!mapping;
  }

  /**
   * Handles Meta's GET verification challenge.
   * Returns { ok: true, challenge } when mode==='subscribe' and token is valid.
   * Returns { ok: false } otherwise — controller sends 403.
   */
  async handleVerification(
    mode: string,
    token: string,
    challenge: string,
  ): Promise<{ ok: boolean; challenge?: string }> {
    if (mode === 'subscribe' && (await this.validateToken(token))) {
      return { ok: true, challenge };
    }
    return { ok: false };
  }

  /**
   * Iterates all entry[].changes[] where field==='leadgen' and calls
   * processLead for each one. Each call is individually wrapped in try/catch
   * so one failure cannot block processing of subsequent entries.
   */
  async ingestLead(payload: MetaLeadPayload): Promise<void> {
    if (!payload?.entry?.length) {
      return;
    }

    for (const entry of payload.entry) {
      if (!entry?.changes?.length) {
        continue;
      }
      for (const change of entry.changes) {
        if (change.field !== 'leadgen') {
          continue;
        }
        try {
          await this.processLead(
            change.value.form_id,
            change.value.leadgen_id,
          );
        } catch (err) {
          this.logger.error(
            `[ingestLead] processLead failed for formId=${change.value.form_id} leadgenId=${change.value.leadgen_id}`,
            err,
          );
        }
      }
    }
  }

  private async processLead(
    formId: string,
    leadgenId: string,
  ): Promise<void> {
    // Step 1: Look up mapping — return silently if not found (T-2-06 mitigation)
    const mapping = await this.prisma.metaWebhookMapping.findFirst({
      where: { metaFormId: formId },
      include: { stage: true },
    });

    if (!mapping) {
      return;
    }

    // Step 2: Idempotency gate — skip if metaLeadId already ingested (T-2-07 mitigation)
    try {
      await this.prisma.metaLeadIngestion.create({
        data: {
          tenantId: mapping.tenantId,
          metaLeadId: leadgenId,
        },
      });
    } catch (e) {
      if (isPrismaUniqueViolation(e)) {
        this.logger.log(`[processLead] Duplicate leadgenId=${leadgenId} — skipping (idempotent)`);
        return;
      }
      throw e;
    }

    // Step 3: Fetch lead details from Meta Graph API (best-effort)
    let name: string | undefined;
    let phone: string | undefined;
    let email: string | undefined;
    let extraFields: string | undefined;

    if (mapping.pageAccessToken) {
      try {
        const url = `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data&access_token=${mapping.pageAccessToken}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data = (await resp.json()) as {
            field_data?: Array<{ name: string; values: string[] }>;
          };
          const fields = data.field_data ?? [];
          const getField = (key: string) =>
            fields.find((f) => f.name === key)?.values?.[0];

          name = getField('full_name') ?? getField('first_name');
          phone = getField('phone_number') ?? getField('phone');
          email = getField('email');
          const otherFields = fields
            .filter((f) => !['full_name', 'first_name', 'phone_number', 'phone', 'email'].includes(f.name))
            .map((f) => `${f.name}: ${f.values.join(', ')}`)
            .join('; ');
          extraFields = otherFields || undefined;
        }
      } catch (err) {
        this.logger.warn(
          `[processLead] Failed to fetch lead details from Meta Graph API for leadgenId=${leadgenId} — using placeholder`,
          err,
        );
        name = 'Lead Meta';
        extraFields = 'Campos não recuperados';
      }
    } else {
      name = 'Lead Meta';
      extraFields = 'Campos não recuperados';
    }

    // Step 4: Upsert Contact by phone OR email within tenantId
    const contact = await this.upsertContact(
      mapping.tenantId,
      phone,
      email,
      name,
    );

    // Step 5: Create Card in the mapped stage
    const card = await this.cardService.create(mapping.tenantId, {
      title: name || 'Lead Meta',
      stageId: mapping.stageId,
      contactId: contact.id,
      customFields: {
        source: 'meta-ads',
        metaLeadId: leadgenId,
        notes: extraFields,
      },
    });

    // Step 6: Link MetaLeadIngestion to the new card
    await this.prisma.metaLeadIngestion.update({
      where: { metaLeadId: leadgenId },
      data: { cardId: card.id },
    });

    // Step 7: Record activity
    await this.prisma.cardActivity.create({
      data: {
        cardId: card.id,
        type: 'META_LEAD_INGESTED',
        content: `Lead recebido via Meta Lead Ads (form ${formId})`,
      },
    });

    // Step 8: D0 rule trigger — CONTEXT.md locked decision
    // "Trigger de início: Card entra na etapa (automático)" includes Meta-webhook-created cards
    try {
      await this.stageRuleService.startRuleRun(
        card.id,
        mapping.stageId,
        mapping.tenantId,
        'CARD_ENTERED',
      );
    } catch (err) {
      this.logger.error('[processLead] startRuleRun failed', err);
    }

    // Step 9: Agent proactive trigger — same locked decision
    try {
      await this.agentRunnerService.initiateProactiveIfAssigned(
        card.id,
        mapping.stageId,
        mapping.tenantId,
      );
    } catch (err) {
      this.logger.error('[processLead] initiateProactiveIfAssigned failed', err);
    }

    // Step 10: In-app notification — CONTEXT.md locked decision
    // "Notificação: SDR recebe notificação quando lead entra via webhook (canal: in-app)"
    try {
      this.notificationService.emit(mapping.tenantId, {
        type: 'meta_lead_arrived',
        cardId: card.id,
        cardTitle: name ?? 'Lead Meta',
        at: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error('[processLead] notification emit failed', err);
    }
  }

  private async upsertContact(
    tenantId: string,
    phone?: string,
    email?: string,
    name?: string,
  ) {
    const whereOr = [
      phone ? { phone } : null,
      email ? { email } : null,
    ].filter(Boolean) as Array<{ phone?: string; email?: string }>;

    if (whereOr.length) {
      const existing = await this.prisma.contact.findFirst({
        where: { tenantId, OR: whereOr },
      });
      if (existing) {
        return existing;
      }
    }

    return this.prisma.contact.create({
      data: {
        tenantId,
        name: name ?? 'Lead Meta',
        phone,
        email,
      },
    });
  }

  async createMapping(tenantId: string, dto: CreateMetaMappingDto) {
    // Validate that the pipeline belongs to this tenant
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: dto.pipelineId, tenantId },
    });
    if (!pipeline) {
      throw new BadRequestException(
        'Erro no Backend: Pipeline não encontrado ou não pertence a este tenant.',
      );
    }

    // Validate that the stage belongs to this pipeline
    const stage = await this.prisma.stage.findFirst({
      where: { id: dto.stageId, pipelineId: dto.pipelineId },
    });
    if (!stage) {
      throw new BadRequestException(
        'Erro no Backend: Etapa não encontrada ou não pertence ao pipeline informado.',
      );
    }

    return this.prisma.metaWebhookMapping.create({
      data: {
        tenantId,
        metaFormId: dto.metaFormId,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        verifyToken: dto.verifyToken,
        pageAccessToken: dto.pageAccessToken,
      },
    });
  }

  async listMappings(tenantId: string) {
    return this.prisma.metaWebhookMapping.findMany({
      where: { tenantId },
      select: {
        id: true,
        tenantId: true,
        metaFormId: true,
        pipelineId: true,
        stageId: true,
        verifyToken: true,
        // pageAccessToken intentionally excluded — T-2-08 mitigation
        createdAt: true,
        updatedAt: true,
        pipeline: { select: { name: true } },
        stage: { select: { name: true } },
      },
    });
  }

  async deleteMapping(tenantId: string, id: string) {
    const mapping = await this.prisma.metaWebhookMapping.findFirst({
      where: { id, tenantId },
    });

    if (!mapping) {
      throw new NotFoundException(
        `Erro no Backend: Mapeamento com ID '${id}' não encontrado neste tenant.`,
      );
    }

    return this.prisma.metaWebhookMapping.delete({
      where: { id },
    });
  }
}
