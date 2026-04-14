import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AgentConversationStatus, Prisma, type Agent } from '@prisma/client';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import {
  AgentPromptContext,
  AgentPromptProfile,
  buildAgentCompiledPrompt,
  normalizeAgentPromptProfile,
  serializeAgentPromptProfile,
} from './agent-prompt.builder';
import { PrismaService } from '../prisma/prisma.service';

const agentStageInclude = Prisma.validator<Prisma.AgentInclude>()({
  stage: {
    select: {
      id: true,
      name: true,
      classificationCriteria: true,
      pipeline: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  knowledgeBase: {
    select: {
      id: true,
      name: true,
      summary: true,
      content: true,
    },
  },
});

type AgentWithStage = Prisma.AgentGetPayload<{
  include: typeof agentStageInclude;
}>;

export interface AgentResponse {
  id: string;
  name: string;
  systemPrompt: string;
  profile: AgentPromptProfile | null;
  compiledPrompt: string;
  isActive: boolean;
  stageId: string | null;
  knowledgeBaseId: string | null;
  createdAt: Date;
  updatedAt: Date;
  knowledgeBase: {
    id: string;
    name: string;
    summary: string | null;
    content: string | null;
  } | null;
  stage: {
    id: string;
    name: string;
    pipeline: {
      id: string;
      name: string;
    };
  } | null;
}

export interface AgentConversationResponse {
  id: string;
  status: string;
  summary: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  card: {
    id: string;
    title: string;
    stageId: string;
  } | null;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: Date;
    whatsAppMessageId: string | null;
  }>;
}

export interface ConversationStatusResponse {
  id: string;
  status: AgentConversationStatus;
  updatedAt: Date;
  lastMessageAt: Date | null;
}

export interface StageAgentAssignmentResponse {
  stageId: string;
  agentId: string | null;
  classificationCriteria: string | null;
}

export interface AgentOperationalOverviewResponse extends AgentResponse {
  metrics: {
    totalCardsInStage: number;
    autopilot: number;
    takeover: number;
    waitingDelay: number;
    running: number;
    completed: number;
    failed: number;
    idle: number;
  };
  recentCards: Array<{
    id: string;
    title: string;
    automationStatus:
      | 'TAKEOVER'
      | 'NO_AGENT'
      | 'AGENT_PAUSED'
      | 'RUNNING'
      | 'WAITING_DELAY'
      | 'COMPLETED'
      | 'FAILED'
      | 'AUTOPILOT'
      | 'IDLE';
    automationLabel: string;
    contactName: string | null;
  }>;
}

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  private mapLifecycleRun(run: any) {
    const steps = (run?.steps ?? []).map((step: any) => ({
      order: step.order,
      status: step.status,
    }));
    const nextPendingStep =
      steps.find((step: any) => step.status === 'PENDING' || step.status === 'QUEUED') ??
      null;

    return {
      id: run.id,
      status: run.status,
      nextPendingStep,
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

  private buildAutomationState(card: any, agent: { id: string; name: string; isActive: boolean }) {
    const normalizedCard = this.attachLifecycleRuns(card);
    const conversation = normalizedCard.agentConversations?.find((item: any) => item.agentId === agent.id) ?? normalizedCard.agentConversations?.[0] ?? null;
    const run = normalizedCard.sequenceRuns?.[0] ?? null;
    const nextPendingStep = run?.steps?.find((step: any) => step.status === 'PENDING' || step.status === 'QUEUED') ?? null;

    if (conversation?.status === AgentConversationStatus.HANDOFF_REQUIRED) {
      return { status: 'TAKEOVER', label: 'Takeover' } as const;
    }

    if (!agent.isActive) {
      return { status: 'AGENT_PAUSED', label: 'Agente pausado' } as const;
    }

    if (run?.status === 'RUNNING') {
      return { status: 'RUNNING', label: 'Em execução' } as const;
    }

    if (run?.status === 'PENDING' && nextPendingStep) {
      return { status: 'WAITING_DELAY', label: 'Aguardando delay' } as const;
    }

    if (run?.status === 'COMPLETED') {
      return { status: 'COMPLETED', label: 'Concluída' } as const;
    }

    if (run?.status === 'FAILED') {
      return { status: 'FAILED', label: 'Com erro' } as const;
    }

    if (conversation?.status === AgentConversationStatus.OPEN) {
      return { status: 'AUTOPILOT', label: 'Piloto automático' } as const;
    }

    return { status: 'IDLE', label: 'Sem execução' } as const;
  }

  public async create(
    tenantId: string,
    dto: CreateAgentDto,
  ): Promise<AgentResponse> {
    await this.ensureValidStage(tenantId, dto.stageId);
    await this.ensureValidKnowledgeBase(tenantId, dto.knowledgeBaseId);

    const createdAgent = await this.prisma.agent.create({
      data: {
        name: dto.name.trim(),
        systemPrompt: dto.systemPrompt?.trim() ?? '',
        profile: serializeAgentPromptProfile(
          normalizeAgentPromptProfile(dto.profile),
        ),
        isActive: dto.isActive ?? true,
        stageId: dto.stageId ?? null,
        knowledgeBaseId: dto.knowledgeBaseId ?? null,
        tenantId,
      },
      include: agentStageInclude,
    });

    return this.mapAgentResponse(createdAgent, {
      tenantName: await this.getTenantName(tenantId),
    });
  }

  public async findAll(tenantId: string): Promise<AgentResponse[]> {
    const [tenantName, agents] = await Promise.all([
      this.getTenantName(tenantId),
      this.prisma.agent.findMany({
        where: { tenantId },
        include: agentStageInclude,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return agents.map((agent) => this.mapAgentResponse(agent, { tenantName }));
  }

  public async getOperationalOverview(
    tenantId: string,
  ): Promise<AgentOperationalOverviewResponse[]> {
    const [tenantName, agents] = await Promise.all([
      this.getTenantName(tenantId),
      this.prisma.agent.findMany({
        where: { tenantId },
        include: {
          ...agentStageInclude,
          stage: {
            select: {
              id: true,
              name: true,
              classificationCriteria: true,
              pipeline: {
                select: {
                  id: true,
                  name: true,
                },
              },
              cards: {
                take: 8,
                orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                include: {
                  contact: {
                    select: {
                      name: true,
                    },
                  },
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
                    take: 1,
                    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                    include: {
                      steps: {
                        orderBy: { order: 'asc' },
                        select: {
                          order: true,
                          status: true,
                        },
                      },
                    },
                  },
                  stageRuleRuns: {
                    take: 1,
                    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
                    include: {
                      steps: {
                        orderBy: { order: 'asc' },
                        select: {
                          order: true,
                          status: true,
                        },
                      },
                    },
                  },
                },
              },
              _count: {
                select: {
                  cards: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return agents.map((agent) => {
      const base = this.mapAgentResponse(agent, { tenantName });
      const stageCards = agent.stage?.cards ?? [];
      const bucket = {
        totalCardsInStage: agent.stage?._count.cards ?? 0,
        autopilot: 0,
        takeover: 0,
        waitingDelay: 0,
        running: 0,
        completed: 0,
        failed: 0,
        idle: 0,
      };

      const recentCards = stageCards.map((card) => {
        const automation = this.buildAutomationState(card, {
          id: agent.id,
          name: agent.name,
          isActive: agent.isActive,
        });

        switch (automation.status) {
          case 'AUTOPILOT':
            bucket.autopilot += 1;
            break;
          case 'TAKEOVER':
            bucket.takeover += 1;
            break;
          case 'WAITING_DELAY':
            bucket.waitingDelay += 1;
            break;
          case 'RUNNING':
            bucket.running += 1;
            break;
          case 'COMPLETED':
            bucket.completed += 1;
            break;
          case 'FAILED':
            bucket.failed += 1;
            break;
          default:
            bucket.idle += 1;
            break;
        }

        return {
          id: card.id,
          title: card.title,
          automationStatus: automation.status,
          automationLabel: automation.label,
          contactName: card.contact?.name ?? null,
        };
      });

      return {
        ...base,
        metrics: bucket,
        recentCards,
      };
    });
  }

  public async findOne(tenantId: string, id: string): Promise<AgentResponse> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, tenantId },
      include: agentStageInclude,
    });

    if (!agent) {
      throw new NotFoundException(
        `Erro no Backend: Agente com ID '${id}' não encontrado neste tenant.`,
      );
    }

    return this.mapAgentResponse(agent, {
      tenantName: await this.getTenantName(tenantId),
    });
  }

  public async update(
    tenantId: string,
    id: string,
    dto: UpdateAgentDto,
  ): Promise<AgentResponse> {
    const existingAgent = await this.prisma.agent.findFirst({
      where: { id, tenantId },
      include: agentStageInclude,
    });

    if (!existingAgent) {
      throw new NotFoundException(
        `Erro no Backend: Agente com ID '${id}' não encontrado neste tenant.`,
      );
    }

    await this.ensureValidStage(tenantId, dto.stageId);
    await this.ensureValidKnowledgeBase(tenantId, dto.knowledgeBaseId);

    const data: Prisma.AgentUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.systemPrompt !== undefined)
      data.systemPrompt = dto.systemPrompt.trim();
    if (dto.profile !== undefined) {
      data.profile = serializeAgentPromptProfile(
        normalizeAgentPromptProfile(dto.profile),
      );
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.stageId !== undefined) data.stageId = dto.stageId;
    if (dto.knowledgeBaseId !== undefined)
      data.knowledgeBaseId = dto.knowledgeBaseId;

    const shouldPauseOpenConversations =
      dto.isActive === false && existingAgent.isActive;

    const updatedAgent = await this.prisma.$transaction(async (tx) => {
      const persistedAgent = await tx.agent.update({
        where: { id },
        data,
        include: agentStageInclude,
      });

      if (shouldPauseOpenConversations) {
        const openConversations = await tx.agentConversation.findMany({
          where: {
            tenantId,
            agentId: id,
            status: AgentConversationStatus.OPEN,
          },
          select: {
            id: true,
            cardId: true,
          },
        });

        if (openConversations.length > 0) {
          await tx.agentConversation.updateMany({
            where: {
              id: {
                in: openConversations.map((conversation) => conversation.id),
              },
            },
            data: {
              status: AgentConversationStatus.HANDOFF_REQUIRED,
            },
          });

          const affectedCards = openConversations
            .map((conversation) => conversation.cardId)
            .filter((cardId): cardId is string => Boolean(cardId));

          if (affectedCards.length > 0) {
            await tx.cardActivity.createMany({
              data: affectedCards.map((cardId) => ({
                cardId,
                type: 'AGENT_PAUSED',
                content: `Agente ${persistedAgent.name} foi desligado globalmente. A conversa entrou em takeover manual.`,
              })),
            });
          }
        }
      }

      return persistedAgent;
    });

    return this.mapAgentResponse(updatedAgent, {
      tenantName: await this.getTenantName(tenantId),
    });
  }

  public async remove(tenantId: string, id: string): Promise<Agent> {
    await this.findOne(tenantId, id);

    return this.prisma.agent.delete({
      where: { id },
    });
  }

  public async listConversations(
    tenantId: string,
    agentId: string,
  ): Promise<AgentConversationResponse[]> {
    await this.findOne(tenantId, agentId);

    const conversations = await this.prisma.agentConversation.findMany({
      where: {
        tenantId,
        agentId,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        card: {
          select: {
            id: true,
            title: true,
            stageId: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      status: conversation.status,
      summary: conversation.summary,
      lastMessageAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      contact: conversation.contact,
      card: conversation.card,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        whatsAppMessageId: message.whatsAppMessageId,
      })),
    }));
  }

  public async updateConversationStatus(
    tenantId: string,
    conversationId: string,
    status: AgentConversationStatus,
  ): Promise<ConversationStatusResponse> {
    const conversation = await this.prisma.agentConversation.findFirst({
      where: {
        id: conversationId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException(
        `Erro no Backend: Conversa com ID '${conversationId}' não encontrada neste tenant.`,
      );
    }

    return this.prisma.agentConversation.update({
      where: { id: conversationId },
      data: { status },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        lastMessageAt: true,
      },
    });
  }

  public async setStageAgent(
    tenantId: string,
    stageId: string,
    dto: { agentId?: string | null; classificationCriteria?: string | null },
  ): Promise<StageAgentAssignmentResponse> {
    const stage = await this.prisma.stage.findFirst({
      where: { id: stageId, pipeline: { tenantId } },
      select: { id: true },
    });

    if (!stage) {
      throw new NotFoundException(
        `Erro no Backend: Etapa com ID '${stageId}' não encontrada neste tenant.`,
      );
    }

    if (dto.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: dto.agentId, tenantId },
        select: { id: true },
      });

      if (!agent) {
        throw new NotFoundException(
          `Erro no Backend: Agente com ID '${dto.agentId}' não encontrado neste tenant.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.agent.updateMany({
        where: { tenantId, stageId },
        data: { stageId: null },
      });

      if (dto.agentId) {
        await tx.agent.update({
          where: { id: dto.agentId },
          data: { stageId },
        });
      }

      const updatedStage = await tx.stage.update({
        where: { id: stageId },
        data: {
          classificationCriteria: dto.classificationCriteria ?? null,
        },
        select: {
          id: true,
          classificationCriteria: true,
          agents: {
            take: 1,
            orderBy: { updatedAt: 'desc' },
            select: { id: true },
          },
        },
      });

      return {
        stageId: updatedStage.id,
        agentId: updatedStage.agents[0]?.id ?? null,
        classificationCriteria: updatedStage.classificationCriteria ?? null,
      };
    });
  }

  public async previewPrompt(
    tenantId: string,
    dto: Pick<
      UpdateAgentDto,
      'name' | 'profile' | 'stageId' | 'systemPrompt' | 'knowledgeBaseId'
    >,
  ): Promise<{ compiledPrompt: string; profile: AgentPromptProfile | null }> {
    const tenantName = await this.getTenantName(tenantId);
    const stageContext = await this.resolveStageContext(tenantId, dto.stageId);
    const knowledgeBaseContext = await this.resolveKnowledgeBaseContext(
      tenantId,
      dto.knowledgeBaseId,
    );
    const profile = normalizeAgentPromptProfile(dto.profile);

    return {
      compiledPrompt: buildAgentCompiledPrompt({
        name: dto.name,
        systemPrompt: dto.systemPrompt,
        profile,
        context: {
          ...stageContext,
          tenantName,
          ...knowledgeBaseContext,
        },
      }),
      profile,
    };
  }

  private async ensureValidStage(
    tenantId: string,
    stageId?: string | null,
  ): Promise<void> {
    if (!stageId) {
      return;
    }

    const stage = await this.prisma.stage.findFirst({
      where: { id: stageId, pipeline: { tenantId } },
    });
    if (!stage) {
      throw new BadRequestException(
        'Erro no Backend: A etapa informada não existe ou não pertence a este tenant.',
      );
    }
  }

  private async ensureValidKnowledgeBase(
    tenantId: string,
    knowledgeBaseId?: string | null,
  ): Promise<void> {
    if (!knowledgeBaseId) {
      return;
    }

    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!knowledgeBase) {
      throw new BadRequestException(
        'Erro no Backend: A base de conhecimento informada nao existe ou nao pertence a este tenant.',
      );
    }
  }

  private async getTenantName(tenantId: string): Promise<string | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    return tenant?.name ?? null;
  }

  private async resolveStageContext(
    tenantId: string,
    stageId?: string | null,
  ): Promise<
    Pick<
      AgentPromptContext,
      'pipelineName' | 'stageName' | 'classificationCriteria'
    >
  > {
    if (!stageId) {
      return {
        pipelineName: null,
        stageName: null,
        classificationCriteria: null,
      };
    }

    const stage = await this.prisma.stage.findFirst({
      where: { id: stageId, pipeline: { tenantId } },
      select: {
        name: true,
        classificationCriteria: true,
        pipeline: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!stage) {
      throw new BadRequestException(
        'Erro no Backend: A etapa informada não existe ou não pertence a este tenant.',
      );
    }

    return {
      pipelineName: stage.pipeline.name,
      stageName: stage.name,
      classificationCriteria: stage.classificationCriteria,
    };
  }

  private async resolveKnowledgeBaseContext(
    tenantId: string,
    knowledgeBaseId?: string | null,
  ): Promise<
    Pick<
      AgentPromptContext,
      'knowledgeBaseName' | 'knowledgeBaseSummary' | 'knowledgeBaseContent'
    >
  > {
    if (!knowledgeBaseId) {
      return {
        knowledgeBaseName: null,
        knowledgeBaseSummary: null,
        knowledgeBaseContent: null,
      };
    }

    const knowledgeBase = await this.prisma.knowledgeBase.findFirst({
      where: {
        id: knowledgeBaseId,
        tenantId,
      },
      select: {
        name: true,
        summary: true,
        content: true,
      },
    });

    if (!knowledgeBase) {
      throw new BadRequestException(
        'Erro no Backend: A base de conhecimento informada nao existe ou nao pertence a este tenant.',
      );
    }

    return {
      knowledgeBaseName: knowledgeBase.name,
      knowledgeBaseSummary: knowledgeBase.summary,
      knowledgeBaseContent: knowledgeBase.content,
    };
  }

  private mapAgentResponse(
    agent: AgentWithStage,
    context: {
      tenantName: string | null;
    },
  ): AgentResponse {
    const profile = normalizeAgentPromptProfile(agent.profile);
    const promptContext: AgentPromptContext = {
      tenantName: context.tenantName,
      pipelineName: agent.stage?.pipeline.name ?? null,
      stageName: agent.stage?.name ?? null,
      classificationCriteria: agent.stage?.classificationCriteria ?? null,
      knowledgeBaseName: agent.knowledgeBase?.name ?? null,
      knowledgeBaseSummary: agent.knowledgeBase?.summary ?? null,
      knowledgeBaseContent: agent.knowledgeBase?.content ?? null,
    };

    return {
      id: agent.id,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      profile,
      compiledPrompt: buildAgentCompiledPrompt({
        name: agent.name,
        systemPrompt: agent.systemPrompt,
        profile,
        context: promptContext,
      }),
      isActive: agent.isActive,
      stageId: agent.stageId,
      knowledgeBaseId: agent.knowledgeBaseId,
      knowledgeBase: agent.knowledgeBase
        ? {
            id: agent.knowledgeBase.id,
            name: agent.knowledgeBase.name,
            summary: agent.knowledgeBase.summary,
            content: agent.knowledgeBase.content,
          }
        : null,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      stage: agent.stage,
    };
  }
}
