import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { StageRuleQueueService } from './stage-rule-queue.service';
import {
  nextBusinessHour,
  DEFAULT_BUSINESS_HOURS,
} from '../common/utils/business-hours';
import { CreateStageRuleDto } from './dto/create-stage-rule.dto';
import { UpsertRuleStepsDto } from './dto/upsert-rule-step.dto';
import {
  StageRule,
  StageRuleRun,
  CampaignChannel,
} from '@prisma/client';
import type { BusinessHoursConfig } from '../common/utils/business-hours';

@Injectable()
export class StageRuleService {
  private readonly logger = new Logger(StageRuleService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => StageRuleQueueService))
    private readonly stageRuleQueueService: StageRuleQueueService,
    private readonly tenantService: TenantService,
  ) {}

  public async getRuleForStage(
    tenantId: string,
    stageId: string,
  ): Promise<StageRule | null> {
    return this.prisma.stageRule.findFirst({
      where: { tenantId, stageId },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });
  }

  public async createRuleForStage(
    tenantId: string,
    stageId: string,
    dto: CreateStageRuleDto,
  ): Promise<StageRule> {
    // Validate stage belongs to tenant
    const stage = await this.prisma.stage.findFirst({
      where: { id: stageId, pipeline: { tenantId } },
    });

    if (!stage) {
      throw new NotFoundException(
        `Etapa com ID '${stageId}' não encontrada neste tenant.`,
      );
    }

    // Check if rule already exists
    const existing = await this.prisma.stageRule.findFirst({
      where: { tenantId, stageId },
    });

    if (existing) {
      throw new ConflictException(
        `Já existe uma régua para a etapa '${stageId}'.`,
      );
    }

    return this.prisma.stageRule.create({
      data: {
        stageId,
        tenantId,
        isActive: dto.isActive ?? true,
      },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });
  }

  public async updateRule(
    tenantId: string,
    ruleId: string,
    dto: Partial<CreateStageRuleDto>,
  ): Promise<StageRule> {
    const rule = await this.prisma.stageRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!rule) {
      throw new NotFoundException(
        `Régua com ID '${ruleId}' não encontrada neste tenant.`,
      );
    }

    return this.prisma.stageRule.update({
      where: { id: ruleId },
      data: { ...dto },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
    });
  }

  public async replaceSteps(
    tenantId: string,
    ruleId: string,
    dto: UpsertRuleStepsDto,
  ): Promise<StageRule> {
    const rule = await this.prisma.stageRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!rule) {
      throw new NotFoundException(
        `Régua com ID '${ruleId}' não encontrada neste tenant.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.stageRuleStep.deleteMany({ where: { ruleId } });
      await tx.stageRuleStep.createMany({
        data: dto.steps.map((step) => ({
          ruleId,
          order: step.order,
          dayOffset: step.dayOffset,
          channel: step.channel,
          messageTemplateId: step.messageTemplateId,
        })),
      });
    });

    return this.prisma.stageRule.findFirst({
      where: { id: ruleId },
      include: { steps: { orderBy: { order: 'asc' } } },
    }) as Promise<StageRule>;
  }

  public async deleteRule(tenantId: string, ruleId: string): Promise<void> {
    const rule = await this.prisma.stageRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!rule) {
      throw new NotFoundException(
        `Régua com ID '${ruleId}' não encontrada neste tenant.`,
      );
    }

    await this.prisma.stageRule.delete({ where: { id: ruleId } });
  }

  public async startRuleRun(
    cardId: string,
    stageId: string,
    tenantId: string,
    triggerSource: string,
  ): Promise<StageRuleRun | null> {
    // Load rule + steps for the stage
    const rule = await this.prisma.stageRule.findFirst({
      where: { tenantId, stageId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!rule || !rule.isActive) {
      return null;
    }

    // Load tenant feature flags for business hours
    const featureFlags = await this.tenantService.getFeatureFlags(tenantId);
    const businessHours: BusinessHoursConfig | null =
      featureFlags.businessHours
        ? {
            enabled: featureFlags.businessHours.enabled,
            timezone: featureFlags.businessHours.timezone,
            days: featureFlags.businessHours.days,
            startHour: featureFlags.businessHours.startHour,
            endHour: featureFlags.businessHours.endHour,
          }
        : DEFAULT_BUSINESS_HOURS;

    const now = Date.now();

    // Create StageRuleRun
    const run = await this.prisma.stageRuleRun.create({
      data: {
        ruleId: rule.id,
        cardId,
        tenantId,
        triggerSource,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // Create StageRuleRunStep rows and enqueue
    for (const step of rule.steps) {
      const scheduledFor = nextBusinessHour(
        new Date(now + step.dayOffset * 86400000),
        businessHours,
      );

      const runStep = await this.prisma.stageRuleRunStep.create({
        data: {
          runId: run.id,
          tenantId,
          ruleStepId: step.id,
          order: step.order,
          channel: step.channel,
          scheduledFor,
          status: 'PENDING',
        },
      });

      try {
        await this.stageRuleQueueService.enqueueRuleStep(
          runStep.id,
          runStep.scheduledFor,
        );
      } catch (err) {
        this.logger.warn(
          `Falha ao enfileirar passo ${runStep.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return run;
  }

  public async pauseRun(runId: string, tenantId: string): Promise<void> {
    const run = await this.prisma.stageRuleRun.findFirst({
      where: { id: runId, tenantId },
    });

    if (!run) {
      throw new NotFoundException(`Run '${runId}' não encontrado neste tenant.`);
    }

    await this.prisma.stageRuleRun.update({
      where: { id: runId },
      data: { status: 'PAUSED', pausedAt: new Date() },
    });

    // Remove pending jobs (best effort)
    const pendingSteps = await this.prisma.stageRuleRunStep.findMany({
      where: { runId, status: 'PENDING' },
    });

    for (const step of pendingSteps) {
      try {
        await this.stageRuleQueueService.removeJob(step.id);
      } catch {
        // swallow errors — best effort
      }
    }
  }

  public async resumeRun(runId: string, tenantId: string): Promise<void> {
    const run = await this.prisma.stageRuleRun.findFirst({
      where: { id: runId, tenantId },
    });

    if (!run) {
      throw new NotFoundException(`Run '${runId}' não encontrado neste tenant.`);
    }

    const featureFlags = await this.tenantService.getFeatureFlags(tenantId);
    const businessHours: BusinessHoursConfig | null =
      featureFlags.businessHours
        ? {
            enabled: featureFlags.businessHours.enabled,
            timezone: featureFlags.businessHours.timezone,
            days: featureFlags.businessHours.days,
            startHour: featureFlags.businessHours.startHour,
            endHour: featureFlags.businessHours.endHour,
          }
        : DEFAULT_BUSINESS_HOURS;

    const now = Date.now();

    const pendingSteps = await this.prisma.stageRuleRunStep.findMany({
      where: { runId, status: 'PENDING' },
      include: { ruleStep: true },
    });

    for (const step of pendingSteps) {
      const scheduledFor = nextBusinessHour(
        new Date(now + step.ruleStep.dayOffset * 86400000),
        businessHours,
      );

      const updated = await this.prisma.stageRuleRunStep.update({
        where: { id: step.id },
        data: { scheduledFor },
      });

      try {
        await this.stageRuleQueueService.enqueueRuleStep(
          updated.id,
          updated.scheduledFor,
        );
      } catch (err) {
        this.logger.warn(
          `Falha ao re-enfileirar passo ${step.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    await this.prisma.stageRuleRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', pausedAt: null },
    });
  }

  public async cancelRun(runId: string, tenantId: string): Promise<void> {
    const run = await this.prisma.stageRuleRun.findFirst({
      where: { id: runId, tenantId },
    });

    if (!run) {
      throw new NotFoundException(`Run '${runId}' não encontrado neste tenant.`);
    }

    let pendingStepIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      await tx.stageRuleRun.update({
        where: { id: runId },
        data: { status: 'CANCELED', canceledAt: new Date() },
      });

      const pendingSteps = await tx.stageRuleRunStep.findMany({
        where: { runId, status: 'PENDING' },
        select: { id: true },
      });
      pendingStepIds = pendingSteps.map((s) => s.id);
    });

    // Best-effort remove pending jobs after tx
    for (const stepId of pendingStepIds) {
      try {
        await this.stageRuleQueueService.removeJob(stepId);
      } catch {
        // swallow errors — best effort
      }
    }
  }

  public async cancelActiveRunsForCard(
    cardId: string,
    tenantId: string,
  ): Promise<void> {
    const activeRuns = await this.prisma.stageRuleRun.findMany({
      where: {
        cardId,
        tenantId,
        status: { in: ['RUNNING', 'PAUSED'] },
      },
    });

    for (const run of activeRuns) {
      try {
        await this.cancelRun(run.id, tenantId);
      } catch (err) {
        this.logger.warn(
          `Falha ao cancelar run ${run.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  public async executeStep(stepId: string): Promise<void> {
    const step = await this.prisma.stageRuleRunStep.findFirst({
      where: { id: stepId },
      include: {
        run: {
          include: {
            rule: {
              include: {
                steps: true,
              },
            },
          },
        },
        ruleStep: {
          include: {
            messageTemplate: true,
          },
        },
      },
    });

    if (!step) {
      this.logger.warn(`StageRuleRunStep '${stepId}' não encontrado.`);
      return;
    }

    // If run is canceled or paused, skip this step
    if (
      step.run.status === 'CANCELED' ||
      step.run.status === 'PAUSED'
    ) {
      await this.prisma.stageRuleRunStep.update({
        where: { id: stepId },
        data: { status: 'SKIPPED', completedAt: new Date() },
      });
      return;
    }

    // Mark step as running
    await this.prisma.stageRuleRunStep.update({
      where: { id: stepId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    try {
      const channel = step.channel;
      const template = step.ruleStep.messageTemplate;

      if (channel === CampaignChannel.WHATSAPP) {
        this.logger.log(
          `[StageRule] Enviando mensagem WhatsApp para step ${stepId} via template ${template?.id}`,
        );
        // WhatsApp send is handled by injected service in Plan 04
      } else if (channel === CampaignChannel.EMAIL) {
        this.logger.log(
          `[StageRule] Enviando email para step ${stepId} via template ${template?.id}`,
        );
        // Email send is handled by injected service in Plan 04
      }

      // Create CardActivity
      await this.prisma.cardActivity
        .create({
          data: {
            cardId: step.run.cardId,
            type: 'RULE_STEP_SENT',
            content: `Régua D${step.ruleStep.dayOffset} disparada via ${channel}`,
          },
        })
        .catch((err: Error) => {
          this.logger.warn(`Falha ao criar CardActivity: ${err.message}`);
        });

      // Mark step as sent
      await this.prisma.stageRuleRunStep.update({
        where: { id: stepId },
        data: { status: 'SENT', completedAt: new Date() },
      });

      // Check if all steps in this run are completed
      const unfinishedCount = await this.prisma.stageRuleRunStep.count({
        where: {
          runId: step.runId,
          status: { notIn: ['SENT', 'SKIPPED', 'FAILED'] },
        },
      });

      if (unfinishedCount === 0) {
        await this.prisma.stageRuleRun.update({
          where: { id: step.runId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      }
    } catch (err) {
      this.logger.error(
        `Erro ao executar step ${stepId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.prisma.stageRuleRunStep.update({
        where: { id: stepId },
        data: {
          status: 'FAILED',
          lastError: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      });
    }
  }
}
