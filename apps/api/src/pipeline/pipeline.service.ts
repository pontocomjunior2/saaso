import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { Pipeline } from '@prisma/client';

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  private buildAutomationState(card: any, stageAgents: Array<{ id: string; name: string; isActive: boolean }> = []) {
    const conversation = card.agentConversations?.[0] ?? null;
    const run = card.sequenceRuns?.[0] ?? null;
    const assignedAgent = conversation?.agent ?? stageAgents[0] ?? null;
    const nextPendingStep = run?.steps?.find((step: any) => step.status === 'PENDING' || step.status === 'QUEUED') ?? null;

    if (conversation?.status === 'HANDOFF_REQUIRED') {
      return {
        status: 'TAKEOVER',
        label: 'Takeover',
        description: 'Humano assumiu a conversa e o agente aguarda religamento do piloto automático.',
        nextAction: 'Reativar piloto automático para o agente retomar do ponto atual.',
      };
    }

    if (!assignedAgent) {
      return {
        status: 'NO_AGENT',
        label: 'Sem agente',
        description: 'Nenhum agente foi configurado para esta etapa do funil.',
        nextAction: 'Definir agente para permitir operação autônoma.',
      };
    }

    if (assignedAgent.isActive === false) {
      return {
        status: 'AGENT_PAUSED',
        label: 'Agente pausado',
        description: 'Existe agente vinculado à etapa, mas ele está desligado globalmente.',
        nextAction: 'Reativar o agente ou seguir manualmente.',
      };
    }

    if (run?.status === 'RUNNING') {
      return {
        status: 'RUNNING',
        label: 'Em execução',
        description: `A régua está em execução${run.campaign?.name ? ` na campanha ${run.campaign.name}` : ''}.`,
        nextAction: nextPendingStep
          ? `Próxima ação ${nextPendingStep.order} via ${nextPendingStep.channel}.`
          : 'Aguardando conclusão da execução atual.',
      };
    }

    if (run?.status === 'PENDING') {
      return {
        status: 'WAITING_DELAY',
        label: 'Aguardando delay',
        description: 'A régua está aguardando o próximo disparo agendado.',
        nextAction: nextPendingStep
          ? `Próxima ação ${nextPendingStep.order} agendada para a janela configurada.`
          : 'Sem próxima ação pendente identificada.',
      };
    }

    if (run?.status === 'COMPLETED') {
      return {
        status: 'COMPLETED',
        label: 'Concluída',
        description: 'A régua vinculada a este card foi concluída.',
        nextAction: 'Monitorar resposta do lead ou reiniciar um novo fluxo.',
      };
    }

    if (run?.status === 'FAILED') {
      return {
        status: 'FAILED',
        label: 'Com erro',
        description: 'A execução da régua encontrou erro e precisa de revisão.',
        nextAction: 'Inspecionar a execução e reprogramar a etapa pendente.',
      };
    }

    if (conversation?.status === 'OPEN') {
      return {
        status: 'AUTOPILOT',
        label: 'Piloto automático',
        description: `O agente ${assignedAgent.name} está elegível para conduzir esta conversa automaticamente.`,
        nextAction: 'Acompanhar resposta do lead e avanço do card.',
      };
    }

    return {
      status: 'IDLE',
      label: 'Sem execução',
      description: 'O card existe, mas ainda não há conversa ou régua ativa suficiente para operação autônoma.',
      nextAction: 'Aguardar entrada do lead ou acionar o fluxo manualmente.',
    };
  }

  private decoratePipeline(pipeline: any) {
    return {
      ...pipeline,
      stages: pipeline.stages.map((stage: any) => ({
        ...stage,
        cards: (stage.cards ?? []).map((card: any) => ({
          ...card,
          automation: this.buildAutomationState(card, stage.agents ?? []),
        })),
      })),
    };
  }

  public async create(
    tenantId: string,
    dto: CreatePipelineDto,
  ): Promise<Pipeline> {
    return this.prisma.pipeline.create({
      data: {
        name: dto.name,
        tenantId,
      },
    });
  }

  public async findAll(tenantId: string): Promise<Pipeline[]> {
    const pipelines = await this.prisma.pipeline.findMany({
      where: { tenantId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            cards: {
              orderBy: { position: 'asc' },
              include: {
                contact: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                assignee: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                activities: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
                agentConversations: {
                  orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
                  take: 1,
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
                  take: 1,
                  include: {
                    campaign: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                    steps: {
                      orderBy: { order: 'asc' },
                      take: 3,
                      select: {
                        id: true,
                        order: true,
                        status: true,
                        scheduledFor: true,
                        completedAt: true,
                        channel: true,
                      },
                    },
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pipelines.map((pipeline) => this.decoratePipeline(pipeline));
  }

  public async findOne(tenantId: string, id: string): Promise<Pipeline> {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, tenantId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            cards: {
              orderBy: { position: 'asc' },
              include: {
                contact: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                assignee: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                activities: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
                agentConversations: {
                  orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
                  take: 1,
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
                  take: 1,
                  include: {
                    campaign: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                    steps: {
                      orderBy: { order: 'asc' },
                      take: 3,
                      select: {
                        id: true,
                        order: true,
                        status: true,
                        scheduledFor: true,
                        completedAt: true,
                        channel: true,
                      },
                    },
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
          },
        },
      },
    });

    if (!pipeline) {
      throw new NotFoundException(
        `Erro no Backend: Pipeline com ID '${id}' não encontrado neste tenant.`,
      );
    }

    return this.decoratePipeline(pipeline);
  }

  public async update(
    tenantId: string,
    id: string,
    dto: UpdatePipelineDto,
  ): Promise<Pipeline> {
    // Valida se o pipeline existe e pertence ao tenant
    await this.findOne(tenantId, id);

    return this.prisma.pipeline.update({
      where: { id },
      data: { ...dto },
    });
  }

  public async remove(tenantId: string, id: string): Promise<Pipeline> {
    // Valida se o pipeline existe e pertence ao tenant
    await this.findOne(tenantId, id);

    return this.prisma.pipeline.delete({
      where: { id },
    });
  }
}
