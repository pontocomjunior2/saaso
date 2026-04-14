import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import {
  Contact,
  AgentConversationStatus,
  AgentMessageRole,
} from '@prisma/client';
import { CreateManualEntryDto } from './dto/create-manual-entry.dto';

export interface SegmentBucket {
  key: string;
  label: string;
  count: number;
}

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeTags(tags?: string[]): string[] {
    if (!tags?.length) {
      return [];
    }

    return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
  }

  public async create(
    tenantId: string,
    dto: CreateContactDto,
  ): Promise<Contact> {
    if (dto.companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: dto.companyId, tenantId },
      });
      if (!company) {
        throw new BadRequestException(
          'Erro no Backend: A empresa informada não existe ou não pertence a este tenant.',
        );
      }
    }

    return this.prisma.contact.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        position: dto.position,
        tags: this.normalizeTags(dto.tags),
        companyId: dto.companyId,
        tenantId,
      },
    });
  }

  public async findAll(tenantId: string, search?: string): Promise<any[]> {
    const whereClause: any = { tenantId };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.contact.findMany({
      where: whereClause,
      include: {
        company: { select: { id: true, name: true, industry: true } },
        cards: {
          select: {
            id: true,
            title: true,
            stage: {
              select: {
                id: true,
                name: true,
                pipeline: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            cards: true,
            messages: true,
            agentConversations: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  public async findOne(tenantId: string, id: string): Promise<Contact> {
    const contact = await this.prisma.contact.findFirst({
      where: { id, tenantId },
      include: {
        company: true,
      },
    });

    if (!contact) {
      throw new NotFoundException(
        `Erro no Backend: Contato com ID '${id}' não encontrado neste tenant.`,
      );
    }

    return contact;
  }

  public async update(
    tenantId: string,
    id: string,
    dto: UpdateContactDto,
  ): Promise<Contact> {
    await this.findOne(tenantId, id); // Garantir posse

    if (dto.companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: dto.companyId, tenantId },
      });
      if (!company) {
        throw new BadRequestException(
          'Erro no Backend: A empresa informada não existe ou não pertence a este tenant.',
        );
      }
    }

    return this.prisma.contact.update({
      where: { id },
      data: {
        ...dto,
        tags: dto.tags ? this.normalizeTags(dto.tags) : undefined,
      },
    });
  }

  public async remove(tenantId: string, id: string): Promise<Contact> {
    await this.findOne(tenantId, id);

    return this.prisma.contact.delete({
      where: { id },
    });
  }

  public async findSegments(tenantId: string): Promise<{
    tags: SegmentBucket[];
    industries: SegmentBucket[];
    positions: SegmentBucket[];
  }> {
    const [contacts, companies] = await Promise.all([
      this.prisma.contact.findMany({
        where: { tenantId },
        select: {
          tags: true,
          position: true,
        },
      }),
      this.prisma.company.findMany({
        where: { tenantId },
        select: {
          industry: true,
        },
      }),
    ]);

    const tagMap = new Map<string, number>();
    const industryMap = new Map<string, number>();
    const positionMap = new Map<string, number>();

    contacts.forEach((contact) => {
      contact.tags.forEach((tag) => {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      });

      if (contact.position?.trim()) {
        const normalizedPosition = contact.position.trim();
        positionMap.set(
          normalizedPosition,
          (positionMap.get(normalizedPosition) ?? 0) + 1,
        );
      }
    });

    companies.forEach((company) => {
      if (company.industry?.trim()) {
        const normalizedIndustry = company.industry.trim();
        industryMap.set(
          normalizedIndustry,
          (industryMap.get(normalizedIndustry) ?? 0) + 1,
        );
      }
    });

    const toBuckets = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([label, count]) => ({
          key: label.toLowerCase().replace(/\s+/g, '-'),
          label,
          count,
        }))
        .sort(
          (left, right) =>
            right.count - left.count ||
            left.label.localeCompare(right.label, 'pt-BR'),
        );

    return {
      tags: toBuckets(tagMap),
      industries: toBuckets(industryMap),
      positions: toBuckets(positionMap),
    };
  }

  public async createManualEntry(tenantId: string, dto: CreateManualEntryDto) {
    const stage = await this.prisma.stage.findFirst({
      where: {
        id: dto.stageId,
        pipeline: {
          tenantId,
        },
      },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!stage) {
      throw new BadRequestException(
        'Erro no Backend: A etapa escolhida não existe ou não pertence a este tenant.',
      );
    }

    if (dto.assigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assigneeId, tenantId },
      });

      if (!assignee) {
        throw new BadRequestException(
          'Erro no Backend: O responsável informado não pertence a este tenant.',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      let companyId: string | null = null;

      if (dto.companyId) {
        const existingCompany = await tx.company.findFirst({
          where: { id: dto.companyId, tenantId },
        });

        if (!existingCompany) {
          throw new BadRequestException(
            'Erro no Backend: A empresa selecionada não pertence a este tenant.',
          );
        }

        companyId = existingCompany.id;
      } else if (dto.companyName?.trim()) {
        const normalizedCompanyName = dto.companyName.trim();
        const existingCompany = await tx.company.findFirst({
          where: {
            tenantId,
            name: {
              equals: normalizedCompanyName,
              mode: 'insensitive',
            },
          },
        });

        if (existingCompany) {
          companyId = existingCompany.id;

          await tx.company.update({
            where: { id: existingCompany.id },
            data: {
              industry: dto.industry?.trim() || existingCompany.industry,
              website: dto.website?.trim() || existingCompany.website,
            },
          });
        } else {
          const createdCompany = await tx.company.create({
            data: {
              tenantId,
              name: normalizedCompanyName,
              industry: dto.industry?.trim() || undefined,
              website: dto.website?.trim() || undefined,
            },
          });
          companyId = createdCompany.id;
        }
      }

      const dedupeConditions = [
        dto.email
          ? {
              email: {
                equals: dto.email.trim(),
                mode: 'insensitive' as const,
              },
            }
          : null,
        dto.phone
          ? {
              phone: dto.phone.trim(),
            }
          : null,
      ].filter(
        (
          condition,
        ): condition is
          | { email: { equals: string; mode: 'insensitive' } }
          | { phone: string } => Boolean(condition),
      );

      const existingContact = dedupeConditions.length
        ? await tx.contact.findFirst({
            where: {
              tenantId,
              OR: dedupeConditions,
            },
          })
        : null;

      const normalizedTags = this.normalizeTags(dto.tags);
      const contact = existingContact
        ? await tx.contact.update({
            where: { id: existingContact.id },
            data: {
              name: dto.contactName.trim(),
              email: dto.email?.trim() || existingContact.email,
              phone: dto.phone?.trim() || existingContact.phone,
              position: dto.position?.trim() || existingContact.position,
              companyId: companyId ?? existingContact.companyId,
              tags: Array.from(
                new Set([...(existingContact.tags ?? []), ...normalizedTags]),
              ),
            },
          })
        : await tx.contact.create({
            data: {
              tenantId,
              name: dto.contactName.trim(),
              email: dto.email?.trim() || undefined,
              phone: dto.phone?.trim() || undefined,
              position: dto.position?.trim() || undefined,
              companyId,
              tags: normalizedTags,
            },
          });

      const lastCardInfo = await tx.card.aggregate({
        where: { stageId: dto.stageId },
        _max: { position: true },
      });

      const card = await tx.card.create({
        data: {
          title:
            dto.cardTitle?.trim() ||
            `Lead manual · ${contact.name}${companyId ? ` · ${dto.companyName?.trim() || 'Conta'}` : ''}`,
          stageId: dto.stageId,
          tenantId,
          assigneeId: dto.assigneeId,
          contactId: contact.id,
          position:
            lastCardInfo._max.position !== null
              ? lastCardInfo._max.position + 1
              : 0,
        },
      });

      await tx.cardActivity.create({
        data: {
          cardId: card.id,
          type: 'MANUAL_ENTRY',
          content: `Entrada manual criada em ${stage.pipeline.name} > ${stage.name}.`,
        },
      });

      const conversationAgent =
        (await tx.agent.findFirst({
          where: {
            tenantId,
            stageId: dto.stageId,
            isActive: true,
          },
          orderBy: { updatedAt: 'desc' },
        })) ||
        (await tx.agent.findFirst({
          where: {
            tenantId,
            isActive: true,
          },
          orderBy: { updatedAt: 'desc' },
        }));

      const conversation = conversationAgent
        ? await tx.agentConversation.create({
            data: {
              tenantId,
              agentId: conversationAgent.id,
              contactId: contact.id,
              cardId: card.id,
              status: dto.manualTakeover
                ? AgentConversationStatus.HANDOFF_REQUIRED
                : AgentConversationStatus.OPEN,
              summary:
                dto.note?.trim() || 'Lead criado manualmente pelo workspace.',
              lastMessageAt: new Date(),
            },
          })
        : null;

      if (conversation && dto.note?.trim()) {
        await tx.agentMessage.create({
          data: {
            conversationId: conversation.id,
            role: AgentMessageRole.SYSTEM,
            content: dto.note.trim(),
          },
        });
      }

      return {
        companyId,
        contact,
        card,
        conversation,
      };
    });
  }
}
