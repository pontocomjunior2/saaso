import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Audience,
  AudienceKind,
  Campaign,
  CampaignChannel,
  CampaignDelayUnit,
  CampaignStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAudienceDto } from './dto/create-audience.dto';
import { UpdateAudienceDto } from './dto/update-audience.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AudienceFiltersDto } from './dto/audience-filters.dto';
import { CampaignStepDto } from './dto/campaign-step.dto';

export interface AudienceFilters {
  search: string | null;
  tags: string[];
  industries: string[];
  positions: string[];
  companyIds: string[];
  onlyWithPhone: boolean;
  onlyWithEmail: boolean;
}

export interface AudienceSampleContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: {
    id: string;
    name: string;
  } | null;
}

export interface AudienceResponse {
  id: string;
  name: string;
  description: string | null;
  kind: AudienceKind;
  filters: AudienceFilters;
  contactIds: string[];
  contactCount: number;
  campaignCount: number;
  sampleContacts: AudienceSampleContact[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AudienceMaterializationResponse {
  filters: AudienceFilters;
  contactIds: string[];
  contactCount: number;
  sampleContacts: AudienceSampleContact[];
}

export interface CampaignResponse {
  id: string;
  name: string;
  description: string | null;
  channel: CampaignChannel;
  status: CampaignStatus;
  messageTemplate: string | null;
  launchAt: Date | null;
  steps: Array<{
    id: string;
    order: number;
    channel: CampaignChannel;
    delayAmount: number;
    delayUnit: CampaignDelayUnit;
    messageTemplate: string;
  }>;
  audience: {
    id: string;
    name: string;
    contactCount: number;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const audienceInclude = Prisma.validator<Prisma.AudienceInclude>()({
  _count: {
    select: {
      campaigns: true,
    },
  },
});

const campaignInclude = Prisma.validator<Prisma.CampaignInclude>()({
  audience: true,
  steps: true,
});

type AudienceRecord = Prisma.AudienceGetPayload<{
  include: typeof audienceInclude;
}>;

type CampaignRecord = Prisma.CampaignGetPayload<{
  include: typeof campaignInclude;
}>;

const EMPTY_FILTERS: AudienceFilters = {
  search: null,
  tags: [],
  industries: [],
  positions: [],
  companyIds: [],
  onlyWithPhone: false,
  onlyWithEmail: false,
};

@Injectable()
export class CampaignService {
  constructor(private readonly prisma: PrismaService) {}

  public async createAudience(
    tenantId: string,
    dto: CreateAudienceDto,
  ): Promise<AudienceResponse> {
    const kind = dto.kind ?? AudienceKind.DYNAMIC;
    const filters =
      kind === AudienceKind.DYNAMIC
        ? await this.normalizeAudienceFilters(tenantId, dto.filters)
        : { ...EMPTY_FILTERS };
    const contactIds =
      kind === AudienceKind.MANUAL
        ? await this.validateAudienceContactIds(tenantId, dto.contactIds)
        : [];

    if (kind === AudienceKind.MANUAL && contactIds.length === 0) {
      throw new BadRequestException(
        'Erro no Backend: Audiencias manuais exigem pelo menos um contato selecionado.',
      );
    }

    const audience = await this.prisma.$transaction(async (tx) => {
      const createdAudience = await tx.audience.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          description: this.normalizeOptionalText(dto.description),
          kind,
          filters: this.serializeAudienceFilters(filters),
        },
        include: audienceInclude,
      });

      if (kind === AudienceKind.MANUAL && contactIds.length > 0) {
        await tx.audienceContact.createMany({
          data: contactIds.map((contactId) => ({
            audienceId: createdAudience.id,
            contactId,
            tenantId,
          })),
        });
      }

      return createdAudience;
    });

    return this.mapAudienceResponse(tenantId, audience);
  }

  public async findAllAudiences(tenantId: string): Promise<AudienceResponse[]> {
    const audiences = await this.prisma.audience.findMany({
      where: { tenantId },
      include: audienceInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return Promise.all(
      audiences.map((audience) => this.mapAudienceResponse(tenantId, audience)),
    );
  }

  public async findAudience(
    tenantId: string,
    id: string,
  ): Promise<AudienceResponse> {
    return this.mapAudienceResponse(
      tenantId,
      await this.findAudienceRecord(tenantId, id),
    );
  }

  public async resolveAudienceMaterialization(
    tenantId: string,
    audienceId: string,
  ): Promise<AudienceMaterializationResponse> {
    const audience = await this.findAudienceRecord(tenantId, audienceId);
    return this.buildAudienceMaterialization(tenantId, audience);
  }

  public async updateAudience(
    tenantId: string,
    id: string,
    dto: UpdateAudienceDto,
  ): Promise<AudienceResponse> {
    const currentAudience = await this.findAudienceRecord(tenantId, id);
    const nextKind = dto.kind ?? currentAudience.kind;
    const nextFilters =
      nextKind === AudienceKind.DYNAMIC
        ? dto.filters !== undefined
          ? await this.normalizeAudienceFilters(tenantId, dto.filters)
          : currentAudience.kind === AudienceKind.DYNAMIC
            ? this.normalizeAudienceFiltersFromRecord(currentAudience.filters)
            : { ...EMPTY_FILTERS }
        : { ...EMPTY_FILTERS };
    const currentContactIds = await this.listAudienceContactIds(id);
    const nextContactIds =
      nextKind === AudienceKind.MANUAL
        ? dto.contactIds !== undefined
          ? await this.validateAudienceContactIds(tenantId, dto.contactIds)
          : currentAudience.kind === AudienceKind.MANUAL
            ? currentContactIds
            : []
        : [];

    if (nextKind === AudienceKind.MANUAL && nextContactIds.length === 0) {
      throw new BadRequestException(
        'Erro no Backend: Audiencias manuais exigem pelo menos um contato selecionado.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedAudience = await tx.audience.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: this.normalizeOptionalText(dto.description) }
            : {}),
          kind: nextKind,
          filters: this.serializeAudienceFilters(nextFilters),
        },
        include: audienceInclude,
      });

      if (nextKind === AudienceKind.MANUAL) {
        await tx.audienceContact.deleteMany({
          where: { audienceId: id },
        });

        if (nextContactIds.length > 0) {
          await tx.audienceContact.createMany({
            data: nextContactIds.map((contactId) => ({
              audienceId: id,
              contactId,
              tenantId,
            })),
          });
        }
      } else if (currentAudience.kind === AudienceKind.MANUAL) {
        await tx.audienceContact.deleteMany({
          where: { audienceId: id },
        });
      }

      return updatedAudience;
    });

    return this.mapAudienceResponse(tenantId, updated);
  }

  public async removeAudience(tenantId: string, id: string): Promise<Audience> {
    const audience = await this.findAudience(tenantId, id);

    if (audience.campaignCount > 0) {
      throw new BadRequestException(
        'Erro no Backend: Remova ou desvincule as campanhas antes de excluir esta audiencia.',
      );
    }

    return this.prisma.audience.delete({
      where: { id },
    });
  }

  private async findAudienceRecord(
    tenantId: string,
    id: string,
  ): Promise<AudienceRecord> {
    const audience = await this.prisma.audience.findFirst({
      where: { id, tenantId },
      include: audienceInclude,
    });

    if (!audience) {
      throw new NotFoundException(
        `Erro no Backend: Audiencia com ID '${id}' nao encontrada neste tenant.`,
      );
    }

    return audience;
  }

  public async createCampaign(
    tenantId: string,
    dto: CreateCampaignDto,
  ): Promise<CampaignResponse> {
    const audienceId = await this.validateAudienceOwnership(
      tenantId,
      dto.audienceId,
    );
    const steps = this.normalizeCampaignSteps(dto.steps, dto.channel);

    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: this.normalizeOptionalText(dto.description),
        channel: dto.channel ?? CampaignChannel.WHATSAPP,
        status: dto.status ?? CampaignStatus.DRAFT,
        messageTemplate: this.normalizeOptionalText(dto.messageTemplate),
        audienceId,
        launchAt: this.parseOptionalDate(dto.launchAt),
        ...(steps.length > 0
          ? {
              steps: {
                create: steps,
              },
            }
          : {}),
      },
      include: campaignInclude,
    });

    return this.mapCampaignResponse(campaign);
  }

  public async findAllCampaigns(tenantId: string): Promise<CampaignResponse[]> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { tenantId },
      include: campaignInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return Promise.all(
      campaigns.map((campaign) => this.mapCampaignResponse(campaign)),
    );
  }

  public async findCampaign(
    tenantId: string,
    id: string,
  ): Promise<CampaignResponse> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
      include: campaignInclude,
    });

    if (!campaign) {
      throw new NotFoundException(
        `Erro no Backend: Campanha com ID '${id}' nao encontrada neste tenant.`,
      );
    }

    return this.mapCampaignResponse(campaign);
  }

  public async updateCampaign(
    tenantId: string,
    id: string,
    dto: UpdateCampaignDto,
  ): Promise<CampaignResponse> {
    const currentCampaign = await this.findCampaign(tenantId, id);
    const audienceId =
      dto.audienceId !== undefined
        ? await this.validateAudienceOwnership(tenantId, dto.audienceId)
        : undefined;
    const nextChannel = dto.channel ?? currentCampaign.channel;
    const steps =
      dto.steps !== undefined
        ? this.normalizeCampaignSteps(dto.steps, nextChannel)
        : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedCampaign = await tx.campaign.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: this.normalizeOptionalText(dto.description) }
            : {}),
          ...(dto.channel !== undefined ? { channel: dto.channel } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.messageTemplate !== undefined
            ? {
                messageTemplate: this.normalizeOptionalText(
                  dto.messageTemplate,
                ),
              }
            : {}),
          ...(audienceId !== undefined ? { audienceId } : {}),
          ...(dto.launchAt !== undefined
            ? { launchAt: this.parseOptionalDate(dto.launchAt) }
            : {}),
        },
        include: campaignInclude,
      });

      if (steps !== null) {
        await tx.campaignStep.deleteMany({
          where: { campaignId: id },
        });

        if (steps.length > 0) {
          await tx.campaignStep.createMany({
            data: steps.map((step) => ({
              ...step,
              campaignId: id,
            })),
          });
        }

        return tx.campaign.findUniqueOrThrow({
          where: { id },
          include: campaignInclude,
        });
      }

      return updatedCampaign;
    });

    return this.mapCampaignResponse(updated);
  }

  public async removeCampaign(tenantId: string, id: string): Promise<CampaignResponse> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, tenantId },
      include: campaignInclude,
    });

    if (!campaign) {
      throw new NotFoundException(
        `Erro no Backend: Campanha com ID '${id}' nao encontrada neste tenant.`,
      );
    }

    const removed = await this.prisma.campaign.delete({
      where: { id },
    });

    return this.mapCampaignResponse(removed as any);
  }

  private async validateAudienceOwnership(
    tenantId: string,
    audienceId?: string | null,
  ): Promise<string | null> {
    if (audienceId === undefined) {
      return null;
    }

    const normalizedId =
      typeof audienceId === 'string' && audienceId.trim().length > 0
        ? audienceId.trim()
        : null;

    if (!normalizedId) {
      return null;
    }

    const audience = await this.prisma.audience.findFirst({
      where: {
        id: normalizedId,
        tenantId,
      },
      select: { id: true },
    });

    if (!audience) {
      throw new BadRequestException(
        'Erro no Backend: A audiencia escolhida nao existe ou nao pertence a este tenant.',
      );
    }

    return audience.id;
  }

  private async validateAudienceContactIds(
    tenantId: string,
    contactIds?: string[],
  ): Promise<string[]> {
    const normalizedContactIds = this.normalizeStringArray(contactIds);

    if (normalizedContactIds.length === 0) {
      return [];
    }

    const ownedContacts = await this.prisma.contact.findMany({
      where: {
        tenantId,
        id: {
          in: normalizedContactIds,
        },
      },
      select: { id: true },
    });

    if (ownedContacts.length !== normalizedContactIds.length) {
      throw new BadRequestException(
        'Erro no Backend: Um ou mais contatos selecionados nao pertencem a este tenant.',
      );
    }

    return normalizedContactIds;
  }

  private async listAudienceContactIds(audienceId: string): Promise<string[]> {
    const audienceContacts = await this.prisma.audienceContact.findMany({
      where: { audienceId },
      select: { contactId: true },
      orderBy: { createdAt: 'asc' },
    });

    return audienceContacts.map((item) => item.contactId);
  }

  private async normalizeAudienceFilters(
    tenantId: string,
    filters?: AudienceFiltersDto | null,
  ): Promise<AudienceFilters> {
    const normalized: AudienceFilters = {
      search: this.normalizeOptionalText(filters?.search),
      tags: this.normalizeStringArray(filters?.tags),
      industries: this.normalizeStringArray(filters?.industries),
      positions: this.normalizeStringArray(filters?.positions),
      companyIds: this.normalizeStringArray(filters?.companyIds),
      onlyWithPhone: Boolean(filters?.onlyWithPhone),
      onlyWithEmail: Boolean(filters?.onlyWithEmail),
    };

    if (normalized.companyIds.length > 0) {
      const ownedCompanies = await this.prisma.company.findMany({
        where: {
          tenantId,
          id: {
            in: normalized.companyIds,
          },
        },
        select: { id: true },
      });

      if (ownedCompanies.length !== normalized.companyIds.length) {
        throw new BadRequestException(
          'Erro no Backend: Uma ou mais empresas selecionadas nao pertencem a este tenant.',
        );
      }
    }

    return normalized;
  }

  private normalizeAudienceFiltersFromRecord(
    filters?: Prisma.JsonValue | null,
  ): AudienceFilters {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      return { ...EMPTY_FILTERS };
    }

    const record = filters as Record<string, unknown>;

    return {
      search:
        typeof record.search === 'string' && record.search.trim().length > 0
          ? record.search.trim()
          : null,
      tags: this.normalizeUnknownStringArray(record.tags),
      industries: this.normalizeUnknownStringArray(record.industries),
      positions: this.normalizeUnknownStringArray(record.positions),
      companyIds: this.normalizeUnknownStringArray(record.companyIds),
      onlyWithPhone: record.onlyWithPhone === true,
      onlyWithEmail: record.onlyWithEmail === true,
    };
  }

  private async buildAudienceMaterialization(
    tenantId: string,
    audience: AudienceRecord | CampaignRecord['audience'],
  ): Promise<{
    filters: AudienceFilters;
    contactIds: string[];
    contactCount: number;
    sampleContacts: AudienceSampleContact[];
  }> {
    if (!audience) {
      return {
        filters: { ...EMPTY_FILTERS },
        contactIds: [],
        contactCount: 0,
        sampleContacts: [],
      };
    }

    if (audience.kind === AudienceKind.MANUAL) {
      const audienceContacts = await this.prisma.audienceContact.findMany({
        where: {
          tenantId,
          audienceId: audience.id,
        },
        select: {
          contactId: true,
          createdAt: true,
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              company: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        filters: { ...EMPTY_FILTERS },
        contactIds: audienceContacts.map((item) => item.contactId),
        contactCount: audienceContacts.length,
        sampleContacts: audienceContacts
          .slice(0, 4)
          .map((item) => item.contact),
      };
    }

    const filters = this.normalizeAudienceFiltersFromRecord(audience.filters);
    const where = this.buildAudienceWhere(tenantId, filters);
    const [contactCount, sampleContacts] = await Promise.all([
      this.prisma.contact.count({ where }),
      this.prisma.contact.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 4,
      }),
    ]);

    return {
      filters,
      contactIds: [],
      contactCount,
      sampleContacts,
    };
  }

  private buildAudienceWhere(
    tenantId: string,
    filters: AudienceFilters,
  ): Prisma.ContactWhereInput {
    const andFilters: Prisma.ContactWhereInput[] = [{ tenantId }];

    if (filters.search) {
      andFilters.push({
        OR: [
          {
            name: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
          {
            phone: {
              contains: filters.search,
              mode: 'insensitive',
            },
          },
          {
            company: {
              is: {
                name: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      });
    }

    if (filters.tags.length > 0) {
      andFilters.push({
        tags: {
          hasSome: filters.tags,
        },
      });
    }

    if (filters.positions.length > 0) {
      andFilters.push({
        OR: filters.positions.map((position) => ({
          position: {
            equals: position,
            mode: 'insensitive',
          },
        })),
      });
    }

    if (filters.industries.length > 0) {
      andFilters.push({
        company: {
          is: {
            OR: filters.industries.map((industry) => ({
              industry: {
                equals: industry,
                mode: 'insensitive',
              },
            })),
          },
        },
      });
    }

    if (filters.companyIds.length > 0) {
      andFilters.push({
        companyId: {
          in: filters.companyIds,
        },
      });
    }

    if (filters.onlyWithPhone) {
      andFilters.push({
        phone: {
          not: null,
        },
      });
    }

    if (filters.onlyWithEmail) {
      andFilters.push({
        email: {
          not: null,
        },
      });
    }

    return {
      AND: andFilters,
    };
  }

  private async mapAudienceResponse(
    tenantId: string,
    audience: AudienceRecord,
  ): Promise<AudienceResponse> {
    const materializedAudience = await this.buildAudienceMaterialization(
      tenantId,
      audience,
    );

    return {
      id: audience.id,
      name: audience.name,
      description: audience.description,
      kind: audience.kind,
      filters: materializedAudience.filters,
      contactIds: materializedAudience.contactIds,
      contactCount: materializedAudience.contactCount,
      campaignCount: audience._count.campaigns,
      sampleContacts: materializedAudience.sampleContacts,
      createdAt: audience.createdAt,
      updatedAt: audience.updatedAt,
    };
  }

  private async mapCampaignResponse(
    campaign: CampaignRecord,
  ): Promise<CampaignResponse> {
    const materializedAudience = await this.buildAudienceMaterialization(
      campaign.tenantId,
      campaign.audience,
    );

    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      channel: campaign.channel,
      status: campaign.status,
      messageTemplate: campaign.messageTemplate,
      launchAt: campaign.launchAt,
      steps: campaign.steps
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((step) => ({
          id: step.id,
          order: step.order,
          channel: step.channel,
          delayAmount: step.delayAmount,
          delayUnit: step.delayUnit,
          messageTemplate: step.messageTemplate,
        })),
      audience: campaign.audience
        ? {
            id: campaign.audience.id,
            name: campaign.audience.name,
            contactCount: materializedAudience.contactCount,
          }
        : null,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeStringArray(values?: string[]): string[] {
    if (!values?.length) {
      return [];
    }

    return Array.from(
      new Set(
        values.map((value) => value.trim()).filter((value) => value.length > 0),
      ),
    );
  }

  private normalizeUnknownStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return this.normalizeStringArray(
      value.filter((item): item is string => typeof item === 'string'),
    );
  }

  private parseOptionalDate(value?: string | null): Date | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return new Date(trimmed);
  }

  private normalizeCampaignSteps(
    steps?: CampaignStepDto[] | null,
    fallbackChannel?: CampaignChannel,
  ): Array<{
    order: number;
    channel: CampaignChannel;
    delayAmount: number;
    delayUnit: CampaignDelayUnit;
    messageTemplate: string;
  }> {
    if (!steps?.length) {
      return [];
    }

    return steps.map((step, index) => {
      const messageTemplate = step.messageTemplate.trim();

      if (!messageTemplate) {
        throw new BadRequestException(
          'Erro no Backend: Cada etapa da campanha precisa de uma mensagem.',
        );
      }

      return {
        order: index + 1,
        channel: step.channel ?? fallbackChannel ?? CampaignChannel.WHATSAPP,
        delayAmount: step.delayAmount ?? 0,
        delayUnit: step.delayUnit ?? CampaignDelayUnit.HOURS,
        messageTemplate,
      };
    });
  }

  private serializeAudienceFilters(
    filters: AudienceFilters,
  ): Prisma.InputJsonValue {
    return filters as unknown as Prisma.InputJsonValue;
  }
}
