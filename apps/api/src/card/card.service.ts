import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { MoveCardDto } from './dto/move-card.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { Card, Prisma } from '@prisma/client';
import { StageRuleService } from '../stage-rule/stage-rule.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { AgentMoveDto } from './dto/agent-move.dto';

@Injectable()
export class CardService {
  private readonly logger = new Logger(CardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsappService,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => StageRuleService))
    private readonly stageRuleService: StageRuleService,
    @Inject(forwardRef(() => AgentRunnerService))
    private readonly agentRunnerService: AgentRunnerService,
  ) {}

  private mapLifecycleRun(run: any) {
    const steps = (run?.steps ?? []).map((step: any) => ({
      id: step.id,
      order: step.order,
      channel: step.channel,
      status: step.status,
      scheduledFor: step.scheduledFor,
      startedAt: step.startedAt ?? null,
      completedAt: step.completedAt ?? null,
    }));
    const nextPendingStep =
      steps.find((step: any) => step.status === 'PENDING' || step.status === 'QUEUED') ??
      null;
    const currentStepIndex = Math.max(
      steps.findIndex((step: any) => step.status === 'PENDING' || step.status === 'QUEUED' || step.status === 'RUNNING'),
      0,
    );

    return {
      id: run.id,
      status: run.status,
      triggerSource: run.triggerSource,
      currentStepIndex,
      nextRunAt: nextPendingStep?.scheduledFor ?? null,
      updatedAt: run.updatedAt,
      campaign: {
        id: run.ruleId,
        name: `Régua · ${run.rule?.stage?.name ?? 'Etapa'}`,
        status: 'ACTIVE' as const,
      },
      steps,
    };
  }

  private attachLifecycleRuns<T extends { stageRuleRuns?: any[]; sequenceRuns?: any[] }>(
    card: T,
  ): T & { sequenceRuns: any[] } {
    if (card.stageRuleRuns && card.stageRuleRuns.length > 0) {
      return {
        ...card,
        sequenceRuns: card.stageRuleRuns.map((run) =>
          this.mapLifecycleRun(run),
        ),
      };
    }

    if (card.sequenceRuns && card.sequenceRuns.length > 0) {
      return card as T & { sequenceRuns: any[] };
    }

    return {
      ...card,
      sequenceRuns: [],
    };
  }

  private buildAutomationState(card: any) {
    const conversation = card.agentConversations?.[0] ?? null;
    const normalizedCard = this.attachLifecycleRuns(card);
    const run = normalizedCard.sequenceRuns?.[0] ?? null;
    const assignedAgent = conversation?.agent ?? card.stage?.agents?.[0] ?? null;
    const nextPendingStep = run?.steps?.find((step: any) => step.status === 'PENDING' || step.status === 'QUEUED') ?? null;

    if (conversation?.status === 'HANDOFF_REQUIRED') {
      return {
        status: 'TAKEOVER',
        label: 'Takeover',
        description: 'Humano no controle da conversa.',
        nextAction: 'Religar piloto automático quando quiser devolver ao agente.',
      };
    }

    if (!assignedAgent) {
      return {
        status: 'NO_AGENT',
        label: 'Sem agente',
        description: 'Etapa sem agente configurado.',
        nextAction: 'Configurar um agente para esta etapa.',
      };
    }

    if (assignedAgent.isActive === false) {
      return {
        status: 'AGENT_PAUSED',
        label: 'Agente pausado',
        description: 'O agente da etapa está desligado globalmente.',
        nextAction: 'Reativar o agente ou seguir manualmente.',
      };
    }

    if (run?.status === 'RUNNING') {
      return {
        status: 'RUNNING',
        label: 'Em execução',
        description: `Régua em execução${run.campaign?.name ? ` na campanha ${run.campaign.name}` : ''}.`,
        nextAction: nextPendingStep
          ? `Próxima ação ${nextPendingStep.order} via ${nextPendingStep.channel}.`
          : 'Aguardando conclusão das ações em execução.',
      };
    }

    if (run?.status === 'PENDING') {
      return {
        status: 'WAITING_DELAY',
        label: 'Aguardando delay',
        description: 'Régua aguardando janela do próximo disparo.',
        nextAction: nextPendingStep
          ? `Próxima ação ${nextPendingStep.order} já está programada.`
          : 'Sem próxima ação pendente identificada.',
      };
    }

    if (run?.status === 'COMPLETED') {
      return {
        status: 'COMPLETED',
        label: 'Concluída',
        description: 'Execução da régua concluída.',
        nextAction: 'Monitorar resposta do lead ou iniciar novo fluxo.',
      };
    }

    if (run?.status === 'FAILED') {
      return {
        status: 'FAILED',
        label: 'Com erro',
        description: 'A execução da régua falhou e exige revisão.',
        nextAction: 'Inspecionar o erro e reprogramar a sequência.',
      };
    }

    if (conversation?.status === 'OPEN') {
      return {
        status: 'AUTOPILOT',
        label: 'Piloto automático',
        description: `O agente ${assignedAgent.name} está apto a operar este card automaticamente.`,
        nextAction: 'Acompanhar as respostas do lead.',
      };
    }

    return {
      status: 'IDLE',
      label: 'Sem execução',
      description: 'Ainda não há operação autônoma ativa neste card.',
      nextAction: 'Aguardar entrada do lead ou acionar a operação.',
    };
  }

  private normalizeCustomFields(
    value: Prisma.JsonValue | undefined,
  ): Prisma.InputJsonValue | Prisma.JsonNullValueInput | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  public async create(tenantId: string, dto: CreateCardDto): Promise<Card> {
    const stage = await this.prisma.stage.findFirst({
      where: {
        id: dto.stageId,
        pipeline: { tenantId },
      },
    });

    if (!stage) {
      throw new NotFoundException(
        `Erro no Backend: Etapa com ID '${dto.stageId}' não encontrada neste tenant.`,
      );
    }

    if (dto.assigneeId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assigneeId, tenantId },
      });
      if (!user)
        throw new BadRequestException(
          'Erro no Backend: Usuário responsável não pertence a este tenant.',
        );
    }

    // Calcula a posição (último no stage = max position + 1)
    const lastCardInfo = await this.prisma.card.aggregate({
      where: { stageId: dto.stageId },
      _max: { position: true },
    });

    const position =
      lastCardInfo._max.position !== null ? lastCardInfo._max.position + 1 : 0;

    const customFieldsParams = this.normalizeCustomFields(dto.customFields);

    const card = await this.prisma.$transaction(async (tx: any) => {
      const card = await tx.card.create({
        data: {
          title: dto.title,
          stageId: dto.stageId,
          position,
          tenantId,
          assigneeId: dto.assigneeId,
          contactId: dto.contactId,
          customFields: customFieldsParams,
        },
      });

      // Registrar atividade de criação
      await tx.cardActivity.create({
        data: {
          cardId: card.id,
          type: 'CREATED',
          content: 'Card criado na etapa ' + stage.name,
        },
      });

      return card;
    });

    try {
      await this.stageRuleService.startRuleRun(
        card.id,
        card.stageId,
        tenantId,
        'CARD_ENTERED',
      );
    } catch (error) {
      this.logger.error(
        '[create] startRuleRun failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    try {
      await this.agentRunnerService.initiateProactiveIfAssigned(
        card.id,
        card.stageId,
        tenantId,
      );
    } catch (error) {
      this.logger.error(
        '[create] initiateProactiveIfAssigned failed',
        error instanceof Error ? error.stack : String(error),
      );
    }

    return card;
  }

  public async findAll(
    tenantId: string,
    filters?: { stageId?: string; search?: string },
  ): Promise<any[]> {
    const whereClause: any = { tenantId };

    if (filters?.stageId) {
      whereClause.stageId = filters.stageId;
    }

    if (filters?.search) {
      whereClause.title = { contains: filters.search, mode: 'insensitive' };
    }

    return this.prisma.card.findMany({
      where: whereClause,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        contact: true,
      },
      orderBy: { position: 'asc' },
    });
  }

  public async findOne(tenantId: string, id: string): Promise<any> {
    const card = await this.prisma.card.findFirst({
      where: { id, tenantId },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        contact: {
          include: {
            company: {
              select: {
                id: true,
                name: true,
                industry: true,
                website: true,
              },
            },
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
            stageRule: {
              select: {
                id: true,
                stageId: true,
                isActive: true,
                steps: {
                  orderBy: { order: 'asc' },
                  select: {
                    id: true,
                    order: true,
                    dayOffset: true,
                    channel: true,
                    messageTemplateId: true,
                  },
                },
              },
            },
            agents: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
            pipeline: {
              select: {
                id: true,
                name: true,
              },
            },
            messageTemplates: {
              orderBy: { createdAt: 'asc' as const },
              select: {
                id: true,
                name: true,
                channel: true,
                subject: true,
                body: true,
              },
            },
          },
        },
        activities: { orderBy: { createdAt: 'desc' } },
        agentConversations: {
          orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
          },
        },
        sequenceRuns: {
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          include: {
            campaign: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
            steps: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                order: true,
                channel: true,
                status: true,
                scheduledFor: true,
                startedAt: true,
                completedAt: true,
              },
            },
          },
        },
        stageRuleRuns: {
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          include: {
            rule: {
              select: {
                id: true,
                stage: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            steps: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                order: true,
                channel: true,
                status: true,
                scheduledFor: true,
                startedAt: true,
                completedAt: true,
              },
            },
          },
        },
      },
    });

    if (!card) {
      throw new NotFoundException(
        `Erro no Backend: Card com ID '${id}' não encontrado neste tenant.`,
      );
    }

    const decoratedCard = this.attachLifecycleRuns(card as any);

    return {
      ...decoratedCard,
      stage: decoratedCard.stage
        ? {
            ...decoratedCard.stage,
            rule: decoratedCard.stage.stageRule ?? null,
          }
        : decoratedCard.stage,
      automation: this.buildAutomationState(decoratedCard),
    };
  }

  public async update(
    tenantId: string,
    id: string,
    dto: UpdateCardDto,
  ): Promise<Card> {
    await this.findOne(tenantId, id);

    if (dto.assigneeId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assigneeId, tenantId },
      });
      if (!user)
        throw new BadRequestException(
          'Erro no Backend: Usuário responsável não pertence a este tenant.',
        );
    }

    return this.prisma.card.update({
      where: { id },
      data: {
        title: dto.title,
        assigneeId: dto.assigneeId,
        contactId: dto.contactId,
        customFields: this.normalizeCustomFields(dto.customFields),
      },
    });
  }

  public async remove(tenantId: string, id: string): Promise<Card> {
    const card = await this.findOne(tenantId, id);

    // Remove activities before removing card due to foreign key
    return this.prisma.$transaction(async (tx) => {
      await tx.cardActivity.deleteMany({ where: { cardId: id } });
      return tx.card.delete({ where: { id } });
    });
  }

  public async sendMessage(
    tenantId: string,
    cardId: string,
    userId: string,
    dto: SendMessageDto,
  ): Promise<{ success: boolean; deliveryMode: string }> {
    // 1. Buscar card com contact e stage
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, tenantId },
      include: {
        contact: true,
        stage: true,
      },
    });
    if (!card) throw new NotFoundException('Card nao encontrado.');
    if (!card.contact)
      throw new BadRequestException('Card nao tem contato vinculado.');

    // 2. Buscar template (validando que pertence ao tenant — T-02-02)
    const template = await this.prisma.stageMessageTemplate.findFirst({
      where: { id: dto.templateId, tenantId },
    });
    if (!template) throw new NotFoundException('Template nao encontrado.');

    // 3. Resolver variaveis no body
    const contact = card.contact;
    const resolvedBody = template.body
      .replace(/\{\{nome\}\}/g, contact.name || '')
      .replace(/\{\{email\}\}/g, contact.email || '')
      .replace(/\{\{telefone\}\}/g, contact.phone || '')
      .replace(/\{\{empresa\}\}/g, '');

    const resolvedSubject = template.subject
      ? template.subject.replace(/\{\{nome\}\}/g, contact.name || '')
      : template.name;

    // 4. Despachar por canal
    let deliveryMode = 'unknown';

    if (dto.channel === 'WHATSAPP') {
      if (!contact.phone)
        throw new BadRequestException(
          'Contato nao tem telefone para WhatsApp.',
        );
      await this.whatsappService.logMessage(tenantId, {
        contactId: contact.id,
        content: resolvedBody,
        cardId: card.id,
      });
      deliveryMode = 'whatsapp';

      // Atualizar o CardActivity criado pelo logMessage com templateName e actorId
      const latestActivity = await this.prisma.cardActivity.findFirst({
        where: {
          cardId: card.id,
          type: { startsWith: 'WHATSAPP_OUTBOUND' },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (latestActivity) {
        await this.prisma.cardActivity.update({
          where: { id: latestActivity.id },
          data: {
            channel: 'WHATSAPP',
            templateName: template.name,
            actorId: userId,
          },
        });
      }
    } else if (dto.channel === 'EMAIL') {
      if (!contact.email)
        throw new BadRequestException('Contato nao tem email.');
      const result = await this.emailService.sendEmail({
        to: contact.email,
        subject: resolvedSubject,
        body: resolvedBody,
      });
      deliveryMode = result.deliveryMode;

      // Criar CardActivity para email (WhatsApp ja cria via logMessage)
      await this.prisma.cardActivity.create({
        data: {
          cardId: card.id,
          type: 'EMAIL_OUTBOUND',
          content: `Email enviado para ${contact.email}: "${resolvedSubject}"`,
          channel: 'EMAIL',
          templateName: template.name,
          actorId: userId,
        },
      });
    }

    return { success: true, deliveryMode };
  }

  public async moveCard(
    tenantId: string,
    cardId: string,
    dto: MoveCardDto,
  ): Promise<void> {
    const card = await this.findOne(tenantId, cardId); // Valida posse via tenantId

    const destinationStage = await this.prisma.stage.findFirst({
      where: { id: dto.destinationStageId, pipeline: { tenantId } },
    });

    if (!destinationStage) {
      throw new NotFoundException(
        `Erro no Backend: Etapa de destino não encontrada.`,
      );
    }

    const isSameStage = card.stageId === dto.destinationStageId;

    await this.prisma.$transaction(async (tx: any) => {
      if (isSameStage) {
        // Mover dentro da mesma coluna
        const cards: any[] = await tx.card.findMany({
          where: { stageId: card.stageId, tenantId },
          orderBy: { position: 'asc' },
        });

        // Remove o card da posição antiga e insere na nova
        const oldIndex = cards.findIndex((c) => c.id === cardId);
        const [movedCard] = cards.splice(oldIndex, 1);
        cards.splice(dto.destinationIndex, 0, movedCard);

        // Atualiza todas as posições
        await Promise.all(
          cards.map((c: any, index: number) =>
            tx.card.update({
              where: { id: c.id },
              data: { position: index },
            }),
          ),
        );
      } else {
        // Mover entre colunas diferentes

        // 1. Fecha o buraco na coluna de origem
        await tx.card.updateMany({
          where: {
            stageId: card.stageId,
            position: { gt: card.position },
            tenantId,
          },
          data: { position: { decrement: 1 } },
        });

        // 2. Abre um buraco na coluna de destino
        await tx.card.updateMany({
          where: {
            stageId: dto.destinationStageId,
            position: { gte: dto.destinationIndex },
            tenantId,
          },
          data: { position: { increment: 1 } },
        });

        // 3. Insere o card na posição de destino
        await tx.card.update({
          where: { id: cardId },
          data: {
            stageId: dto.destinationStageId,
            position: dto.destinationIndex,
          },
        });

        const oldStage = await tx.stage.findUnique({
          where: { id: card.stageId },
        });

        // Registrar atividade
        await tx.cardActivity.create({
          data: {
            cardId,
            type: 'MOVED',
            content: `Movido de ${oldStage?.name} para ${destinationStage.name}`,
          },
        });
      }
    });

    if (!isSameStage) {
      try {
        await this.stageRuleService.cancelActiveRunsForCard(cardId, tenantId);
      } catch (error) {
        this.logger.error(
          '[moveCard] cancelActiveRunsForCard failed',
          error instanceof Error ? error.stack : String(error),
        );
      }

      try {
        await this.stageRuleService.startRuleRun(
          cardId,
          dto.destinationStageId,
          tenantId,
          'CARD_ENTERED',
        );
      } catch (error) {
        this.logger.error(
          '[moveCard] startRuleRun failed',
          error instanceof Error ? error.stack : String(error),
        );
      }

      try {
        await this.agentRunnerService.initiateProactiveIfAssigned(
          cardId,
          dto.destinationStageId,
          tenantId,
        );
      } catch (error) {
        this.logger.error(
          '[moveCard] initiateProactiveIfAssigned failed',
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  public async agentMove(
    tenantId: string,
    cardId: string,
    dto: AgentMoveDto,
  ): Promise<void> {
    const [agent, destinationStage, card] = await Promise.all([
      this.prisma.agent.findFirst({
        where: { id: dto.agentId, tenantId },
        select: { id: true, name: true },
      }),
      this.prisma.stage.findFirst({
        where: { id: dto.destinationStageId, pipeline: { tenantId } },
        select: { id: true, name: true },
      }),
      this.prisma.card.findFirst({
        where: { id: cardId, tenantId },
        select: { id: true },
      }),
    ]);

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (!destinationStage) {
      throw new NotFoundException('Stage not found');
    }

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    const destinationIndex = await this.prisma.card.count({
      where: { stageId: dto.destinationStageId, tenantId },
    });

    await this.moveCard(tenantId, cardId, {
      destinationStageId: dto.destinationStageId,
      destinationIndex,
    });

    await this.prisma.cardActivity.create({
      data: {
        cardId,
        type: 'AGENT_MOVED',
        content: `Agente ${agent.name} moveu para ${destinationStage.name} — ${dto.reason}`,
      },
    });
  }
}
