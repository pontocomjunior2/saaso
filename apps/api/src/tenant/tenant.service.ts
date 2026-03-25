import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CampaignChannel,
  CampaignDelayUnit,
  CampaignStatus,
  Prisma,
  Tenant,
  WhatsAppStatus,
} from '@prisma/client';
import {
  DEFAULT_TENANT_FEATURE_FLAGS,
  normalizeTenantFeatureFlags,
  TenantFeatureFlags,
  toTenantFeatureFlagsJson,
} from './tenant-feature-flags';
import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  CreateWizardCampaignDto,
  WizardInputType,
} from './dto/create-wizard-campaign.dto';
import {
  WizardCampaignSetupResponse,
  WizardCampaignSetupDetailResponse,
  WizardDelayConfig,
} from './wizard.types';

@Injectable()
export class TenantService {
  private static readonly WIZARD_BLUEPRINT_FILE =
    'SERVUS_Blueprint_Automacao.json';

  constructor(private readonly prisma: PrismaService) {}

  public async createTenant(name: string, slug: string): Promise<Tenant> {
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new BadRequestException(
        `Erro no Backend: O tenant com slug '${slug}' já existe.`,
      );
    }

    return this.prisma.tenant.create({
      data: {
        name,
        slug,
        featureFlags: toTenantFeatureFlagsJson(DEFAULT_TENANT_FEATURE_FLAGS),
      },
    });
  }

  public async getTenantById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  public async getFeatureFlags(tenantId: string): Promise<TenantFeatureFlags> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { featureFlags: true },
    });

    return normalizeTenantFeatureFlags(
      tenant?.featureFlags as Partial<TenantFeatureFlags> | null,
    );
  }

  public async updateFeatureFlags(
    tenantId: string,
    featureFlags: Partial<TenantFeatureFlags>,
  ): Promise<TenantFeatureFlags> {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        featureFlags: toTenantFeatureFlagsJson(
          normalizeTenantFeatureFlags(featureFlags),
        ),
      },
    });

    return this.getFeatureFlags(tenantId);
  }

  public async getWizardBlueprint() {
    const blueprintPath = await this.resolveWizardBlueprintPath();

    try {
      const content = await readFile(blueprintPath, 'utf-8');
      return JSON.parse(content.replace(/^\uFEFF/, '')) as unknown;
    } catch {
      throw new InternalServerErrorException(
        `Erro no Backend: Nao foi possivel ler o blueprint da automacao em '${blueprintPath}'.`,
      );
    }
  }

  public async getWizardCampaignSetup(
    tenantId: string,
    campaignId: string,
  ): Promise<WizardCampaignSetupDetailResponse> {
    const resources = await this.findWizardCampaignResources(tenantId, campaignId);
    const { campaign, pipeline, journey, stages, agents, form, whatsapp } = resources;

    const stageIdByKey = new Map(stages.map((stage) => [stage.stageKey, stage.stageId]));
    const agentByStageId = new Map(
      agents.filter((agent) => agent.stageId).map((agent) => [agent.stageId!, agent]),
    );

    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      pipelineId: pipeline?.id ?? null,
      pipelineName: pipeline?.name ?? `${this.extractClientName(campaign.name)} · Pipeline`,
      clientName: this.extractClientName(campaign.name),
      description: campaign.description ?? '',
      inputType:
        campaign.channel === CampaignChannel.WHATSAPP && !form
          ? WizardInputType.WHATSAPP
          : WizardInputType.FORM,
      form: form
        ? {
            id: form.id,
            name: form.name,
            headline: form.headline ?? '',
            description: form.description ?? '',
            fields: form.fields,
          }
        : null,
      whatsapp: whatsapp
        ? {
            id: whatsapp.id,
            phoneNumber: whatsapp.phoneNumber,
            phoneNumberId: whatsapp.phoneNumberId,
            wabaId: whatsapp.wabaId,
            accessToken: whatsapp.accessToken,
          }
        : null,
      agents: stages.map((stage) => {
        const linkedAgent =
          (stage.stageId ? agentByStageId.get(stage.stageId) : null) ?? null;
        return {
          id: linkedAgent?.id ?? null,
          stageKey: stage.stageKey,
          name: linkedAgent?.name ?? stage.agentLabel ?? `Agente ${stage.stageName}`,
          systemPrompt:
            linkedAgent?.systemPrompt ??
            `Voce conduz a etapa ${stage.stageName}. Objetivo: ${stage.objective ?? 'movimentar o lead com clareza'}.`,
          profile: linkedAgent?.profile ?? null,
        };
      }),
      rule: stages.map((stage) => ({
        stageId: stageIdByKey.get(stage.stageKey) ?? null,
        stageKey: stage.stageKey,
        stageName: stage.stageName,
        description: stage.description,
        objective: stage.objective,
        agentLabel: stage.agentLabel,
        tasks: stage.tasks,
      })),
    };
  }

  public async createWizardCampaign(
    tenantId: string,
    dto: CreateWizardCampaignDto,
  ): Promise<WizardCampaignSetupResponse> {
    if (dto.rule.length === 0) {
      throw new BadRequestException(
        'Erro no Backend: A campanha precisa de pelo menos uma etapa de regua.',
      );
    }

    if (dto.inputType === WizardInputType.FORM && !dto.form) {
      throw new BadRequestException(
        'Erro no Backend: Configure um formulario antes de salvar a campanha.',
      );
    }

    if (dto.inputType === WizardInputType.WHATSAPP && !dto.whatsapp) {
      throw new BadRequestException(
        'Erro no Backend: Configure um canal WhatsApp antes de salvar a campanha.',
      );
    }

    const rule = dto.rule.map((stage, index) => ({
      ...stage,
      stageKey: stage.stageKey.trim(),
      stageName: stage.stageName.trim(),
      order: index,
      tasks: stage.tasks ?? [],
    }));

    const pipelineName =
      this.normalizeOptionalText(dto.pipelineName) ??
      `${dto.clientName.trim()} · Operacao`;
    const campaignDescription =
      this.normalizeOptionalText(dto.description) ??
      `Campanha criada pelo wizard para ${dto.clientName.trim()}.`;

    return this.prisma.$transaction(async (tx) => {
      const pipeline = await tx.pipeline.create({
        data: {
          tenantId,
          name: pipelineName,
        },
      });

      const createdStages = await Promise.all(
        rule.map((stage) =>
          tx.stage.create({
            data: {
              pipelineId: pipeline.id,
              name: stage.stageName,
              order: stage.order,
            },
          }),
        ),
      );

      const stageIdByKey = new Map(
        createdStages.map((stage, index) => [rule[index].stageKey, stage.id]),
      );

      const form =
        dto.inputType === WizardInputType.FORM && dto.form
          ? await tx.leadForm.create({
              data: {
                tenantId,
                stageId: createdStages[0].id,
                name: dto.form.name.trim(),
                slug: this.uniqueSlug(
                  await this.generateAvailableSlug(
                    tx,
                    tenantId,
                    dto.form.slug ?? dto.form.name,
                  ),
                ),
                headline:
                  this.normalizeOptionalText(dto.form.headline) ??
                  `Receba os leads de ${dto.clientName.trim()}`,
                description: this.normalizeOptionalText(dto.form.description),
                submitButtonLabel: 'Enviar',
                successTitle: 'Recebido',
                successMessage:
                  'Seu lead entrou no funil e a automacao pode iniciar.',
                fields: this.normalizeFormFields(dto.form.fields),
              },
            })
          : null;

      const whatsapp =
        dto.inputType === WizardInputType.WHATSAPP && dto.whatsapp
          ? await tx.whatsAppAccount.create({
              data: {
                tenantId,
                phoneNumber: dto.whatsapp.phoneNumber.trim(),
                phoneNumberId:
                  this.normalizeOptionalText(dto.whatsapp.phoneNumberId) ??
                  null,
                wabaId: this.normalizeOptionalText(dto.whatsapp.wabaId) ?? null,
                accessToken:
                  this.normalizeOptionalText(dto.whatsapp.accessToken) ?? null,
                status: this.resolveStoredAccountStatus({
                  phoneNumber: dto.whatsapp.phoneNumber.trim(),
                  phoneNumberId: this.normalizeOptionalText(
                    dto.whatsapp.phoneNumberId,
                  ),
                  accessToken: this.normalizeOptionalText(
                    dto.whatsapp.accessToken,
                  ),
                  wabaId: this.normalizeOptionalText(dto.whatsapp.wabaId),
                }),
              },
            })
          : null;

      const agents = await Promise.all(
        dto.agents.map((agent) =>
          tx.agent.create({
            data: {
              tenantId,
              name: agent.name.trim(),
              systemPrompt:
                this.normalizeOptionalText(agent.systemPrompt) ??
                `Conduza a etapa ${agent.stageKey} com linguagem objetiva e registre o progresso do lead no card.`,
              profile:
                (agent.profile as Prisma.InputJsonValue | undefined) ??
                Prisma.JsonNull,
              isActive: true,
              stageId: stageIdByKey.get(agent.stageKey) ?? null,
            },
          }),
        ),
      );

      const flattenedSteps = rule.flatMap((stage) =>
        stage.tasks
          .filter((task) => this.normalizeChannel(task.canal) && task.template)
          .map((task, indexInStage) => ({
            stageKey: stage.stageKey,
            orderInStage: indexInStage,
            channel: this.normalizeChannel(task.canal)!,
            messageTemplate: task.template!.trim(),
            delay: this.parseDelayConfig(task.timing),
            subject: this.normalizeOptionalText(task.assunto),
            type: this.normalizeOptionalText(task.tipo),
          })),
      );

      const primaryChannel =
        flattenedSteps[0]?.channel ?? CampaignChannel.WHATSAPP;

      const campaign = await tx.campaign.create({
        data: {
          tenantId,
          name: dto.campaignName.trim(),
          description: campaignDescription,
          channel: primaryChannel,
          status: CampaignStatus.ACTIVE,
          messageTemplate: flattenedSteps[0]?.messageTemplate ?? null,
          steps: {
            create: flattenedSteps.map((step, index) => ({
              order: index + 1,
              channel: step.channel,
              delayAmount: step.delay.amount,
              delayUnit: step.delay.unit,
              messageTemplate: this.composeCampaignStepMessage(step),
            })),
          },
        },
        include: {
          steps: true,
        },
      });

      const { nodes, edges } = this.buildJourneyGraph(
        dto,
        createdStages.map((stage, index) => ({
          id: stage.id,
          name: stage.name,
          order: index,
          key: rule[index].stageKey,
        })),
      );

      const journey = await tx.journey.create({
        data: {
          tenantId,
          name: `${dto.campaignName.trim()} · Regua`,
          isActive: false,
          nodes,
          edges,
        },
      });

      return {
        clientName: dto.clientName.trim(),
        pipeline: {
          id: pipeline.id,
          name: pipeline.name,
          stageCount: createdStages.length,
        },
        campaign: {
          id: campaign.id,
          name: campaign.name,
          channel: campaign.channel,
          stepCount: campaign.steps.length,
        },
        journey: {
          id: journey.id,
          name: journey.name,
          nodeCount: Array.isArray(nodes) ? nodes.length : 0,
        },
        form: form
          ? {
              id: form.id,
              slug: form.slug,
            }
          : null,
        whatsapp: whatsapp
          ? {
              id: whatsapp.id,
              phoneNumber: whatsapp.phoneNumber,
              status: whatsapp.status,
            }
          : null,
        agents: agents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          stageId: agent.stageId,
        })),
      };
    });
  }

  public async updateWizardCampaign(
    tenantId: string,
    campaignId: string,
    dto: CreateWizardCampaignDto,
  ): Promise<WizardCampaignSetupResponse> {
    if (dto.rule.length === 0) {
      throw new BadRequestException(
        'Erro no Backend: A campanha precisa de pelo menos uma etapa de regua.',
      );
    }

    const resources = await this.findWizardCampaignResources(tenantId, campaignId);
    const existingStageIds = resources.stages.map((stage) => stage.stageId).filter(Boolean) as string[];

    if (existingStageIds.length !== dto.rule.length) {
      throw new BadRequestException(
        'Erro no Backend: O wizard nao consegue alterar a quantidade de etapas desta campanha existente.',
      );
    }

    const normalizedRule = dto.rule.map((stage, index) => ({
      ...stage,
      stageKey: stage.stageKey.trim(),
      stageName: stage.stageName.trim(),
      order: index,
      tasks: stage.tasks ?? [],
      stageId: existingStageIds[index],
    }));

    const flattenedSteps = normalizedRule.flatMap((stage) =>
      stage.tasks
        .filter((task) => this.normalizeChannel(task.canal) && task.template)
        .map((task, indexInStage) => ({
          stageKey: stage.stageKey,
          orderInStage: indexInStage,
          channel: this.normalizeChannel(task.canal)!,
          messageTemplate: task.template!.trim(),
          delay: this.parseDelayConfig(task.timing),
          subject: this.normalizeOptionalText(task.assunto),
          type: this.normalizeOptionalText(task.tipo),
        })),
    );

    const primaryChannel =
      flattenedSteps[0]?.channel ??
      (dto.inputType === WizardInputType.WHATSAPP
        ? CampaignChannel.WHATSAPP
        : CampaignChannel.EMAIL);

    const campaignDescription =
      this.normalizeOptionalText(dto.description) ??
      `Campanha criada pelo wizard para ${dto.clientName.trim()}.`;

    return this.prisma.$transaction(async (tx) => {
      if (resources.pipeline) {
        await tx.pipeline.update({
          where: { id: resources.pipeline.id },
          data: {
            name:
              this.normalizeOptionalText(dto.pipelineName) ??
              `${dto.clientName.trim()} · Operacao`,
          },
        });
      }

      for (const [index, stage] of normalizedRule.entries()) {
        await tx.stage.update({
          where: { id: stage.stageId },
          data: {
            name: stage.stageName,
            order: index,
          },
        });
      }

      if (dto.inputType === WizardInputType.FORM && dto.form) {
        if (resources.form) {
          await tx.leadForm.update({
            where: { id: resources.form.id },
            data: {
              name: dto.form.name.trim(),
              slug: this.uniqueSlug(
                await this.generateAvailableSlug(
                  tx,
                  tenantId,
                  dto.form.slug ?? dto.form.name,
                ),
              ),
              headline:
                this.normalizeOptionalText(dto.form.headline) ??
                `Receba os leads de ${dto.clientName.trim()}`,
              description: this.normalizeOptionalText(dto.form.description),
              fields: this.normalizeFormFields(dto.form.fields),
              stageId: normalizedRule[0].stageId,
            },
          });
        } else {
          await tx.leadForm.create({
            data: {
              tenantId,
              stageId: normalizedRule[0].stageId,
              name: dto.form.name.trim(),
              slug: this.uniqueSlug(
                await this.generateAvailableSlug(
                  tx,
                  tenantId,
                  dto.form.slug ?? dto.form.name,
                ),
              ),
              headline:
                this.normalizeOptionalText(dto.form.headline) ??
                `Receba os leads de ${dto.clientName.trim()}`,
              description: this.normalizeOptionalText(dto.form.description),
              submitButtonLabel: 'Enviar',
              successTitle: 'Recebido',
              successMessage:
                'Seu lead entrou no funil e a automacao pode iniciar.',
              fields: this.normalizeFormFields(dto.form.fields),
            },
          });
        }
      }

      if (dto.inputType === WizardInputType.WHATSAPP && dto.whatsapp) {
        if (resources.whatsapp) {
          await tx.whatsAppAccount.update({
            where: { id: resources.whatsapp.id },
            data: {
              phoneNumber: dto.whatsapp.phoneNumber.trim(),
              phoneNumberId:
                this.normalizeOptionalText(dto.whatsapp.phoneNumberId) ?? null,
              wabaId: this.normalizeOptionalText(dto.whatsapp.wabaId) ?? null,
              accessToken:
                this.normalizeOptionalText(dto.whatsapp.accessToken) ?? null,
              status: this.resolveStoredAccountStatus({
                phoneNumber: dto.whatsapp.phoneNumber.trim(),
                phoneNumberId: this.normalizeOptionalText(dto.whatsapp.phoneNumberId),
                accessToken: this.normalizeOptionalText(dto.whatsapp.accessToken),
                wabaId: this.normalizeOptionalText(dto.whatsapp.wabaId),
              }),
            },
          });
        } else {
          await tx.whatsAppAccount.create({
            data: {
              tenantId,
              phoneNumber: dto.whatsapp.phoneNumber.trim(),
              phoneNumberId:
                this.normalizeOptionalText(dto.whatsapp.phoneNumberId) ?? null,
              wabaId: this.normalizeOptionalText(dto.whatsapp.wabaId) ?? null,
              accessToken:
                this.normalizeOptionalText(dto.whatsapp.accessToken) ?? null,
              status: this.resolveStoredAccountStatus({
                phoneNumber: dto.whatsapp.phoneNumber.trim(),
                phoneNumberId: this.normalizeOptionalText(dto.whatsapp.phoneNumberId),
                accessToken: this.normalizeOptionalText(dto.whatsapp.accessToken),
                wabaId: this.normalizeOptionalText(dto.whatsapp.wabaId),
              }),
            },
          });
        }
      }

      for (const agentInput of dto.agents) {
        const stage = normalizedRule.find((item) => item.stageKey === agentInput.stageKey);
        if (!stage) {
          continue;
        }

        if (agentInput.id) {
          await tx.agent.update({
            where: { id: agentInput.id },
            data: {
              name: agentInput.name.trim(),
              systemPrompt:
                this.normalizeOptionalText(agentInput.systemPrompt) ??
                `Conduza a etapa ${agentInput.stageKey} com linguagem objetiva e registre o progresso do lead no card.`,
              profile:
                (agentInput.profile as Prisma.InputJsonValue | undefined) ??
                Prisma.JsonNull,
              isActive: true,
              stageId: stage.stageId,
            },
          });
        } else {
          await tx.agent.create({
            data: {
              tenantId,
              name: agentInput.name.trim(),
              systemPrompt:
                this.normalizeOptionalText(agentInput.systemPrompt) ??
                `Conduza a etapa ${agentInput.stageKey} com linguagem objetiva e registre o progresso do lead no card.`,
              profile:
                (agentInput.profile as Prisma.InputJsonValue | undefined) ??
                Prisma.JsonNull,
              isActive: true,
              stageId: stage.stageId,
            },
          });
        }
      }

      await tx.campaignStep.deleteMany({
        where: { campaignId },
      });

      const campaign = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          name: dto.campaignName.trim(),
          description: campaignDescription,
          channel: primaryChannel,
          status: CampaignStatus.ACTIVE,
          messageTemplate: flattenedSteps[0]?.messageTemplate ?? null,
          steps: {
            create: flattenedSteps.map((step, index) => ({
              order: index + 1,
              channel: step.channel,
              delayAmount: step.delay.amount,
              delayUnit: step.delay.unit,
              messageTemplate: this.composeCampaignStepMessage(step),
            })),
          },
        },
        include: {
          steps: true,
        },
      });

      const { nodes, edges } = this.buildJourneyGraph(
        dto,
        normalizedRule.map((stage) => ({
          id: stage.stageId,
          name: stage.stageName,
          order: stage.order,
          key: stage.stageKey,
        })),
      );

      const journey = await tx.journey.update({
        where: { id: resources.journey.id },
        data: {
          name: `${dto.campaignName.trim()} · Regua`,
          nodes,
          edges,
        },
      });

      const refreshedAgents = await tx.agent.findMany({
        where: {
          tenantId,
          stageId: {
            in: normalizedRule.map((stage) => stage.stageId),
          },
        },
      });

      return {
        clientName: dto.clientName.trim(),
        pipeline: {
          id: resources.pipeline?.id ?? '',
          name:
            this.normalizeOptionalText(dto.pipelineName) ??
            `${dto.clientName.trim()} · Operacao`,
          stageCount: normalizedRule.length,
        },
        campaign: {
          id: campaign.id,
          name: campaign.name,
          channel: campaign.channel,
          stepCount: campaign.steps.length,
        },
        journey: {
          id: journey.id,
          name: journey.name,
          nodeCount: Array.isArray(nodes) ? nodes.length : 0,
        },
        form:
          dto.inputType === WizardInputType.FORM
            ? {
                id: resources.form?.id ?? '',
                slug: this.slugify(dto.form?.slug ?? dto.form?.name ?? ''),
              }
            : null,
        whatsapp:
          dto.inputType === WizardInputType.WHATSAPP
            ? {
                id: resources.whatsapp?.id ?? '',
                phoneNumber: dto.whatsapp?.phoneNumber ?? null,
                status: this.resolveStoredAccountStatus({
                  phoneNumber: dto.whatsapp?.phoneNumber ?? null,
                  phoneNumberId: this.normalizeOptionalText(dto.whatsapp?.phoneNumberId),
                  accessToken: this.normalizeOptionalText(dto.whatsapp?.accessToken),
                  wabaId: this.normalizeOptionalText(dto.whatsapp?.wabaId),
                }),
              }
            : null,
        agents: refreshedAgents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          stageId: agent.stageId,
        })),
      };
    });
  }

  private normalizeOptionalText(value?: string | null): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private async resolveWizardBlueprintPath() {
    const candidates = [
      join(
        process.cwd(),
        'Saaso_blueprint-automacao',
        TenantService.WIZARD_BLUEPRINT_FILE,
      ),
      join(
        process.cwd(),
        '..',
        'Saaso_blueprint-automacao',
        TenantService.WIZARD_BLUEPRINT_FILE,
      ),
      resolve(
        __dirname,
        '../../../../Saaso_blueprint-automacao',
        TenantService.WIZARD_BLUEPRINT_FILE,
      ),
      resolve(
        __dirname,
        '../../../../../Saaso_blueprint-automacao',
        TenantService.WIZARD_BLUEPRINT_FILE,
      ),
    ];

    for (const candidate of candidates) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }

    throw new InternalServerErrorException(
      `Erro no Backend: Blueprint da automacao nao encontrado. Caminhos verificados: ${candidates.join(
        ', ',
      )}`,
    );
  }

  private extractClientName(campaignName: string) {
    const [clientName] = campaignName.split(' · ');
    return clientName?.trim() || campaignName.trim();
  }

  private async findWizardCampaignResources(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(
        `Erro no Backend: Campanha com ID '${campaignId}' nao encontrada neste tenant.`,
      );
    }

    const journey = await this.prisma.journey.findFirst({
      where: {
        tenantId,
        OR: [
          { name: `${campaign.name} · Regua` },
          { name: { startsWith: campaign.name } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!journey) {
      throw new BadRequestException(
        'Erro no Backend: Esta campanha nao possui uma regua do wizard compativel para edicao.',
      );
    }

    const nodes = Array.isArray(journey.nodes)
      ? (journey.nodes as Array<Record<string, unknown>>)
      : [];

    const stageEntries = nodes
      .map((node) => {
        const data =
          node && typeof node === 'object' && node.data && typeof node.data === 'object'
            ? (node.data as Record<string, unknown>)
            : null;
        const blueprintConfig =
          data?.blueprintConfig &&
          typeof data.blueprintConfig === 'object' &&
          !Array.isArray(data.blueprintConfig)
            ? (data.blueprintConfig as Record<string, unknown>)
            : null;

        if (!blueprintConfig || typeof data?.stageKey !== 'string') {
          return null;
        }

        return {
          stageId: typeof data.stageId === 'string' ? data.stageId : null,
          stageKey: data.stageKey,
          stageName:
            typeof blueprintConfig.stageName === 'string'
              ? blueprintConfig.stageName
              : typeof data.label === 'string'
                ? data.label
                : data.stageKey,
          description:
            typeof blueprintConfig.description === 'string'
              ? blueprintConfig.description
              : undefined,
          objective:
            typeof blueprintConfig.objective === 'string'
              ? blueprintConfig.objective
              : undefined,
          agentLabel:
            typeof blueprintConfig.agentLabel === 'string'
              ? blueprintConfig.agentLabel
              : undefined,
          order:
            typeof blueprintConfig.order === 'number'
              ? blueprintConfig.order
              : 0,
          tasks: [] as Array<Record<string, unknown>>,
        };
      })
      .filter(Boolean) as Array<{
      stageId: string | null;
      stageKey: string;
      stageName: string;
      description?: string;
      objective?: string;
      agentLabel?: string;
      order: number;
      tasks: Array<Record<string, unknown>>;
    }>;

    const stageMap = new Map(stageEntries.map((stage) => [stage.stageKey, stage]));

    for (const node of nodes) {
      const data =
        node && typeof node === 'object' && node.data && typeof node.data === 'object'
          ? (node.data as Record<string, unknown>)
          : null;
      const stageKey =
        data && typeof data.stageKey === 'string' ? data.stageKey : null;
      const blueprintTask =
        data?.blueprintTask &&
        typeof data.blueprintTask === 'object' &&
        !Array.isArray(data.blueprintTask)
          ? (data.blueprintTask as Record<string, unknown>)
          : null;

      if (!stageKey || !blueprintTask || !stageMap.has(stageKey)) {
        continue;
      }

      stageMap.get(stageKey)!.tasks.push(JSON.parse(JSON.stringify(blueprintTask)));
    }

    const stages = Array.from(stageMap.values()).sort((left, right) => left.order - right.order);
    const stageIds = stages.map((stage) => stage.stageId).filter(Boolean) as string[];

    const stageRecords = stageIds.length
      ? await this.prisma.stage.findMany({
          where: { id: { in: stageIds } },
          include: {
            pipeline: true,
            leadForms: {
              orderBy: { updatedAt: 'desc' },
            },
            agents: {
              orderBy: { updatedAt: 'desc' },
            },
          },
        })
      : [];

    const stageRecordById = new Map(stageRecords.map((stage) => [stage.id, stage]));
    const pipeline =
      stages[0]?.stageId ? stageRecordById.get(stages[0].stageId)?.pipeline ?? null : null;

    const agents = stages
      .flatMap((stage) =>
        stage.stageId ? stageRecordById.get(stage.stageId)?.agents ?? [] : [],
      )
      .filter((agent, index, collection) => collection.findIndex((item) => item.id === agent.id) === index);

    const form =
      stages
        .flatMap((stage) =>
          stage.stageId ? stageRecordById.get(stage.stageId)?.leadForms ?? [] : [],
        )
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ?? null;

    const whatsapp =
      campaign.channel === CampaignChannel.WHATSAPP
        ? await this.prisma.whatsAppAccount.findFirst({
            where: { tenantId },
            orderBy: { updatedAt: 'desc' },
          })
        : null;

    return {
      campaign,
      journey,
      pipeline,
      stages,
      agents,
      form,
      whatsapp,
    };
  }

  private normalizeFormFields(value: unknown) {
    if (Array.isArray(value) && value.length > 0) {
      return value as Prisma.InputJsonValue;
    }

    return [
      {
        id: 'nome',
        key: 'name',
        label: 'Nome',
        type: 'text',
        placeholder: 'Nome do lead',
        required: true,
        mapTo: 'name',
      },
      {
        id: 'email',
        key: 'email',
        label: 'Email',
        type: 'email',
        placeholder: 'voce@empresa.com',
        required: true,
        mapTo: 'email',
      },
      {
        id: 'telefone',
        key: 'phone',
        label: 'WhatsApp',
        type: 'phone',
        placeholder: '(11) 99999-9999',
        required: false,
        mapTo: 'phone',
      },
    ] as Prisma.InputJsonValue;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private composeCampaignStepMessage(step: {
    messageTemplate: string;
    subject: string | null;
    type: string | null;
  }) {
    const fragments = [step.type, step.subject, step.messageTemplate].filter(
      Boolean,
    );
    return fragments.join('\n\n');
  }

  private normalizeChannel(channel?: unknown): CampaignChannel | null {
    const candidates = Array.isArray(channel)
      ? channel
      : channel == null
        ? []
        : [channel];

    for (const candidate of candidates) {
      if (typeof candidate !== 'string') {
        continue;
      }

      const normalized = candidate.trim().toLowerCase();
      if (!normalized) {
        continue;
      }

      if (normalized.includes('whatsapp')) {
        return CampaignChannel.WHATSAPP;
      }

      if (normalized.includes('email')) {
        return CampaignChannel.EMAIL;
      }
    }

    return null;
  }

  private parseDelayConfig(timing?: string | null): WizardDelayConfig {
    const normalized = timing?.trim().toLowerCase() ?? '';
    const dayMatch = normalized.match(/d\+?\s*(\d+)/i);
    if (dayMatch) {
      return {
        amount: Number(dayMatch[1]),
        unit: CampaignDelayUnit.DAYS,
      };
    }

    const hourMatch = normalized.match(/(\d+)\s*h/);
    if (hourMatch) {
      return {
        amount: Number(hourMatch[1]),
        unit: CampaignDelayUnit.HOURS,
      };
    }

    const minuteMatch = normalized.match(/(\d+)\s*min/);
    if (minuteMatch) {
      return {
        amount: Number(minuteMatch[1]),
        unit: CampaignDelayUnit.MINUTES,
      };
    }

    return {
      amount: 0,
      unit: CampaignDelayUnit.HOURS,
    };
  }

  private buildJourneyGraph(
    dto: CreateWizardCampaignDto,
    stages: Array<{ id: string; name: string; order: number; key: string }>,
  ) {
    const nodes: Prisma.InputJsonValue[] = [];
    const edges: Prisma.InputJsonValue[] = [];
    const triggerId = 'trigger-entry';

    nodes.push({
      id: triggerId,
      type: 'default',
      position: { x: 80, y: 120 },
      data: {
        label:
          dto.inputType === WizardInputType.FORM
            ? 'Entrada por formulario'
            : 'Entrada por WhatsApp',
        kind: 'trigger',
        eventType:
          dto.inputType === WizardInputType.FORM
            ? 'lead_form_submitted'
            : 'whatsapp_inbound_received',
      },
    });

    let previousNodeId = triggerId;

    stages.forEach((stage, stageIndex) => {
      const stageConfig = dto.rule[stageIndex];
      const stageNodeId = `stage-${stage.id}`;

      nodes.push({
        id: stageNodeId,
        type: 'default',
        position: { x: 340 + stageIndex * 320, y: 120 },
        data: {
          label: stage.name,
          kind: 'action',
          actionType: 'append_card_activity',
          message: `Etapa ${stage.name}: ${stageConfig.objective ?? 'Sem objetivo definido.'}`,
          stageId: stage.id,
          stageKey: stage.key,
          blueprintConfig: this.toJsonValue(stageConfig),
        },
      });

      edges.push({
        id: `${previousNodeId}-${stageNodeId}`,
        source: previousNodeId,
        target: stageNodeId,
      });

      previousNodeId = stageNodeId;

      stageConfig.tasks.forEach((task, taskIndex) => {
        const delay = this.parseDelayConfig(task.timing);
        const taskNodeId = `stage-${stage.id}-task-${taskIndex + 1}`;

        nodes.push({
          id: taskNodeId,
          type: 'default',
          position: { x: 340 + stageIndex * 320, y: 260 + taskIndex * 140 },
          data: {
            label: task.tipo ?? `Acao ${taskIndex + 1}`,
            kind: delay.amount > 0 ? 'delay' : 'action',
            delayInHours:
              delay.unit === CampaignDelayUnit.HOURS ? delay.amount : undefined,
            delayInMinutes:
              delay.unit === CampaignDelayUnit.MINUTES
                ? delay.amount
                : undefined,
            actionType: delay.amount > 0 ? undefined : 'append_card_activity',
            message: task.template ?? task.condicao ?? '',
            stageId: stage.id,
            stageKey: stage.key,
            blueprintTask: this.toJsonValue(task),
          },
        });

        edges.push({
          id: `${previousNodeId}-${taskNodeId}`,
          source: previousNodeId,
          target: taskNodeId,
        });

        previousNodeId = taskNodeId;
      });
    });

    return {
      nodes: nodes as Prisma.InputJsonArray,
      edges: edges as Prisma.InputJsonArray,
    };
  }

  private resolveStoredAccountStatus(input: {
    phoneNumber: string | null;
    phoneNumberId: string | null;
    accessToken: string | null;
    wabaId: string | null;
  }): WhatsAppStatus {
    if (
      input.phoneNumber &&
      input.phoneNumberId &&
      input.accessToken &&
      input.wabaId
    ) {
      return WhatsAppStatus.CONNECTED;
    }

    if (input.phoneNumber) {
      return WhatsAppStatus.QR_READY;
    }

    return WhatsAppStatus.DISCONNECTED;
  }

  private async generateAvailableSlug(
    tx: Prisma.TransactionClient,
    tenantId: string,
    source: string,
  ) {
    const base = this.slugify(source);
    let attempt = base;
    let counter = 2;

    while (
      await tx.leadForm.findFirst({
        where: {
          tenantId,
          slug: attempt,
        },
        select: { id: true },
      })
    ) {
      attempt = `${base}-${counter}`;
      counter += 1;
    }

    return attempt;
  }

  private uniqueSlug(value: string) {
    return value || `form-${Date.now()}`;
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }
}
