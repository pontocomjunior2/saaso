import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { CreatePipelineFromTemplateDto } from './dto/create-pipeline-from-template.dto';
import { PIPELINE_TEMPLATES } from './pipeline-templates';
import { Pipeline } from '@prisma/client';

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  private mapLifecycleRun(run: any) {
    const steps = (run?.steps ?? []).map((step: any) => ({
      id: step.id,
      order: step.order,
      status: step.status,
      scheduledFor: step.scheduledFor,
      completedAt: step.completedAt ?? null,
      channel: step.channel,
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

  private buildAutomationState(card: any, stageAgents: Array<{ id: string; name: string; isActive: boolean }> = []) {
    const normalizedCard = this.attachLifecycleRuns(card);
    const conversation = normalizedCard.agentConversations?.[0] ?? null;
    const run = normalizedCard.sequenceRuns?.[0] ?? null;
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
        cards: (stage.cards ?? []).map((card: any) => {
          const decoratedCard = this.attachLifecycleRuns(card);
          return {
            ...decoratedCard,
            automation: this.buildAutomationState(decoratedCard, stage.agents ?? []),
          };
        }),
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

  public async createFromTemplate(
    tenantId: string,
    dto: CreatePipelineFromTemplateDto,
  ): Promise<Pipeline> {
    const template = PIPELINE_TEMPLATES.find((t) => t.id === dto.templateId);
    if (!template) {
      throw new NotFoundException(
        `Template '${dto.templateId}' nao encontrado.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const pipeline = await tx.pipeline.create({
        data: {
          name: dto.name || template.name,
          tenantId,
        },
      });

      for (const stageDef of template.stages) {
        const stage = await tx.stage.create({
          data: {
            name: stageDef.name,
            order: stageDef.order,
            pipelineId: pipeline.id,
          },
        });

        if (stageDef.messageTemplates.length > 0) {
          await tx.stageMessageTemplate.createMany({
            data: stageDef.messageTemplates.map((mt) => ({
              stageId: stage.id,
              name: mt.name,
              channel: mt.channel,
              subject: mt.subject ?? null,
              body: mt.body,
              tenantId,
            })),
          });
        }
      }

      return pipeline;
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
            messageTemplates: {
              orderBy: { createdAt: 'asc' },
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
            messageTemplates: {
              orderBy: { createdAt: 'asc' },
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
