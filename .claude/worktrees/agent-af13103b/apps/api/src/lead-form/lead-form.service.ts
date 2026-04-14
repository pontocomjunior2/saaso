import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentConversationStatus,
  AgentMessageRole,
  Prisma,
  type LeadForm,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadFormDto } from './dto/create-lead-form.dto';
import { UpdateLeadFormDto } from './dto/update-lead-form.dto';
import { LeadFormFieldDto } from './dto/lead-form-field.dto';
import { JourneyService } from '../journey/journey.service';

export interface LeadFormFieldOption {
  label: string;
  value: string;
}

export interface LeadFormField {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'select';
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  mapTo?:
    | 'name'
    | 'email'
    | 'phone'
    | 'position'
    | 'companyName'
    | 'cardTitle'
    | 'custom';
  options?: LeadFormFieldOption[];
}

export interface LeadFormResponse {
  id: string;
  name: string;
  slug: string;
  headline: string | null;
  description: string | null;
  submitButtonLabel: string | null;
  successTitle: string | null;
  successMessage: string | null;
  isActive: boolean;
  stageId: string;
  createdAt: Date;
  updatedAt: Date;
  fields: LeadFormField[];
  stage: {
    id: string;
    name: string;
    pipeline: {
      id: string;
      name: string;
    };
  };
}

export interface PublicLeadFormResponse {
  name: string;
  slug: string;
  headline: string | null;
  description: string | null;
  submitButtonLabel: string;
  successTitle: string | null;
  successMessage: string | null;
  fields: LeadFormField[];
}

export interface LeadFormAnalyticsResponse {
  formId: string;
  totalSubmissions: number;
  submissionsLast7Days: number;
  submissionsLast30Days: number;
  latestSubmissionAt: Date | null;
  recentSubmissions: Array<{
    id: string;
    createdAt: Date;
    contact: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
    } | null;
    card: {
      id: string;
      title: string;
    } | null;
  }>;
}

const leadFormInclude = Prisma.validator<Prisma.LeadFormInclude>()({
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
});

type LeadFormWithStage = Prisma.LeadFormGetPayload<{
  include: typeof leadFormInclude;
}>;

@Injectable()
export class LeadFormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journeyService: JourneyService,
  ) {}

  public async create(
    tenantId: string,
    dto: CreateLeadFormDto,
  ): Promise<LeadFormResponse> {
    await this.ensureValidStage(tenantId, dto.stageId);
    const fields = this.normalizeFields(dto.fields);
    const slug = await this.ensureUniqueSlug(tenantId, dto.slug ?? dto.name);

    const form = await this.prisma.leadForm.create({
      data: {
        name: dto.name.trim(),
        slug,
        headline: this.normalizeOptionalText(dto.headline),
        description: this.normalizeOptionalText(dto.description),
        submitButtonLabel: this.normalizeOptionalText(dto.submitButtonLabel),
        successTitle: this.normalizeOptionalText(dto.successTitle),
        successMessage: this.normalizeOptionalText(dto.successMessage),
        isActive: dto.isActive ?? true,
        stageId: dto.stageId,
        tenantId,
        fields: fields as unknown as Prisma.InputJsonValue,
      },
      include: leadFormInclude,
    });

    return this.mapLeadForm(form);
  }

  public async findAll(tenantId: string): Promise<LeadFormResponse[]> {
    const forms = await this.prisma.leadForm.findMany({
      where: { tenantId },
      include: leadFormInclude,
      orderBy: { createdAt: 'desc' },
    });

    return forms.map((form) => this.mapLeadForm(form));
  }

  public async findOne(
    tenantId: string,
    id: string,
  ): Promise<LeadFormResponse> {
    const form = await this.prisma.leadForm.findFirst({
      where: { id, tenantId },
      include: leadFormInclude,
    });

    if (!form) {
      throw new NotFoundException(
        `Erro no Backend: Formulario com ID '${id}' nao encontrado neste tenant.`,
      );
    }

    return this.mapLeadForm(form);
  }

  public async getAnalytics(
    tenantId: string,
    id: string,
  ): Promise<LeadFormAnalyticsResponse> {
    await this.findOne(tenantId, id);

    const now = new Date();
    const last7Days = new Date(now);
    last7Days.setDate(last7Days.getDate() - 7);

    const last30Days = new Date(now);
    last30Days.setDate(last30Days.getDate() - 30);

    const [
      totalSubmissions,
      submissionsLast7Days,
      submissionsLast30Days,
      recentSubmissions,
    ] = await Promise.all([
      this.prisma.leadFormSubmission.count({
        where: {
          tenantId,
          formId: id,
        },
      }),
      this.prisma.leadFormSubmission.count({
        where: {
          tenantId,
          formId: id,
          createdAt: {
            gte: last7Days,
          },
        },
      }),
      this.prisma.leadFormSubmission.count({
        where: {
          tenantId,
          formId: id,
          createdAt: {
            gte: last30Days,
          },
        },
      }),
      this.prisma.leadFormSubmission.findMany({
        where: {
          tenantId,
          formId: id,
        },
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          card: {
            select: {
              id: true,
              title: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 8,
      }),
    ]);

    return {
      formId: id,
      totalSubmissions,
      submissionsLast7Days,
      submissionsLast30Days,
      latestSubmissionAt: recentSubmissions[0]?.createdAt ?? null,
      recentSubmissions: recentSubmissions.map((submission) => ({
        id: submission.id,
        createdAt: submission.createdAt,
        contact: submission.contact,
        card: submission.card,
      })),
    };
  }

  public async update(
    tenantId: string,
    id: string,
    dto: UpdateLeadFormDto,
  ): Promise<LeadFormResponse> {
    const existing = await this.prisma.leadForm.findFirst({
      where: { id, tenantId },
      include: leadFormInclude,
    });

    if (!existing) {
      throw new NotFoundException(
        `Erro no Backend: Formulario com ID '${id}' nao encontrado neste tenant.`,
      );
    }

    if (dto.stageId) {
      await this.ensureValidStage(tenantId, dto.stageId);
    }

    const data: Prisma.LeadFormUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.slug !== undefined)
      data.slug = await this.ensureUniqueSlug(tenantId, dto.slug, id);
    if (dto.headline !== undefined)
      data.headline = this.normalizeOptionalText(dto.headline);
    if (dto.description !== undefined)
      data.description = this.normalizeOptionalText(dto.description);
    if (dto.submitButtonLabel !== undefined)
      data.submitButtonLabel = this.normalizeOptionalText(
        dto.submitButtonLabel,
      );
    if (dto.successTitle !== undefined)
      data.successTitle = this.normalizeOptionalText(dto.successTitle);
    if (dto.successMessage !== undefined)
      data.successMessage = this.normalizeOptionalText(dto.successMessage);
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.stageId !== undefined) data.stageId = dto.stageId;
    if (dto.fields !== undefined) {
      data.fields = this.normalizeFields(
        dto.fields,
      ) as unknown as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.leadForm.update({
      where: { id },
      data,
      include: leadFormInclude,
    });

    return this.mapLeadForm(updated);
  }

  public async remove(tenantId: string, id: string): Promise<LeadForm> {
    await this.findOne(tenantId, id);

    return this.prisma.$transaction(async (tx) => {
      await tx.leadFormSubmission.deleteMany({
        where: { formId: id, tenantId },
      });

      return tx.leadForm.delete({
        where: { id },
      });
    });
  }

  public async getPublicForm(
    tenantSlug: string,
    slug: string,
  ): Promise<PublicLeadFormResponse> {
    const form = await this.prisma.leadForm.findFirst({
      where: {
        slug,
        isActive: true,
        tenant: {
          slug: tenantSlug,
        },
      },
    });

    if (!form) {
      throw new NotFoundException(
        'Erro no Backend: Formulario publico nao encontrado ou inativo.',
      );
    }

    return {
      name: form.name,
      slug: form.slug,
      headline: form.headline,
      description: form.description,
      submitButtonLabel: form.submitButtonLabel ?? 'Enviar',
      successTitle: form.successTitle,
      successMessage: form.successMessage,
      fields: this.normalizeStoredFields(form.fields),
    };
  }

  public async submitPublicForm(
    tenantSlug: string,
    slug: string,
    payload: Record<string, unknown>,
  ): Promise<{ success: true; successTitle: string; successMessage: string }> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException(
        'Erro no Backend: Payload do formulario invalido.',
      );
    }

    const form = await this.prisma.leadForm.findFirst({
      where: {
        slug,
        isActive: true,
        tenant: { slug: tenantSlug },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        stage: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!form) {
      throw new NotFoundException(
        'Erro no Backend: Formulario publico nao encontrado ou inativo.',
      );
    }

    const fields = this.normalizeStoredFields(form.fields);
    const normalizedPayload = this.validateSubmissionPayload(fields, payload);

    const mappedValues = {
      name: this.getMappedValue(fields, normalizedPayload, 'name'),
      email: this.getMappedValue(fields, normalizedPayload, 'email'),
      phone: this.getMappedValue(fields, normalizedPayload, 'phone'),
      position: this.getMappedValue(fields, normalizedPayload, 'position'),
      companyName: this.getMappedValue(
        fields,
        normalizedPayload,
        'companyName',
      ),
      cardTitle: this.getMappedValue(fields, normalizedPayload, 'cardTitle'),
    };

    const contactName =
      mappedValues.name ||
      mappedValues.email ||
      mappedValues.phone ||
      `Lead ${form.tenant.name}`;

    const submissionContext = await this.prisma.$transaction(async (tx) => {
      let companyId: string | undefined;
      if (mappedValues.companyName) {
        const existingCompany = await tx.company.findFirst({
          where: {
            tenantId: form.tenant.id,
            name: {
              equals: mappedValues.companyName,
              mode: 'insensitive',
            },
          },
        });

        const company = existingCompany
          ? existingCompany
          : await tx.company.create({
              data: {
                name: mappedValues.companyName,
                tenantId: form.tenant.id,
              },
            });

        companyId = company.id;
      }

      const contactLookupConditions: Array<Record<string, unknown>> = [];
      if (mappedValues.email) {
        contactLookupConditions.push({
          email: {
            equals: mappedValues.email,
            mode: 'insensitive',
          },
        });
      }
      if (mappedValues.phone) {
        contactLookupConditions.push({
          phone: mappedValues.phone,
        });
      }

      const existingContact =
        contactLookupConditions.length > 0
          ? await tx.contact.findFirst({
              where: {
                tenantId: form.tenant.id,
                OR: contactLookupConditions,
              },
            })
          : null;

      const contact = existingContact
        ? await tx.contact.update({
            where: { id: existingContact.id },
            data: {
              name: existingContact.name || contactName,
              email: mappedValues.email ?? existingContact.email,
              phone: mappedValues.phone ?? existingContact.phone,
              position: mappedValues.position ?? existingContact.position,
              companyId: companyId ?? existingContact.companyId,
            },
          })
        : await tx.contact.create({
            data: {
              tenantId: form.tenant.id,
              name: contactName,
              email: mappedValues.email,
              phone: mappedValues.phone,
              position: mappedValues.position,
              companyId,
              tags: [],
            },
          });

      const lastCardInfo = await tx.card.aggregate({
        where: { stageId: form.stageId },
        _max: { position: true },
      });

      const card = await tx.card.create({
        data: {
          title: mappedValues.cardTitle || contact.name,
          stageId: form.stageId,
          position:
            lastCardInfo._max.position !== null
              ? lastCardInfo._max.position + 1
              : 0,
          tenantId: form.tenant.id,
          contactId: contact.id,
          customFields: {
            source: 'website_form',
            formId: form.id,
            formSlug: form.slug,
            formName: form.name,
            submittedAt: new Date().toISOString(),
            answers: normalizedPayload,
          },
        },
      });

      await tx.cardActivity.create({
        data: {
          cardId: card.id,
          type: 'CREATED',
          content: `Card criado via formulario ${form.name} na etapa ${form.stage.name}.`,
        },
      });

      await tx.cardActivity.create({
        data: {
          cardId: card.id,
          type: 'FORM_SUBMISSION',
          content: `Lead capturado pelo formulario ${form.name}.`,
        },
      });

      await tx.leadFormSubmission.create({
        data: {
          formId: form.id,
          tenantId: form.tenant.id,
          contactId: contact.id,
          cardId: card.id,
          payload: normalizedPayload as unknown as Prisma.InputJsonValue,
        },
      });

      const conversationAgent =
        (await tx.agent.findFirst({
          where: {
            tenantId: form.tenant.id,
            stageId: form.stageId,
            isActive: true,
          },
          orderBy: { updatedAt: 'desc' },
        })) ||
        (await tx.agent.findFirst({
          where: {
            tenantId: form.tenant.id,
            isActive: true,
          },
          orderBy: { updatedAt: 'desc' },
        }));

      if (conversationAgent) {
        const summary = `Lead capturado via formulario ${form.name}. Aguardando abordagem inicial do agente.`;
        const conversation = await tx.agentConversation.create({
          data: {
            tenantId: form.tenant.id,
            agentId: conversationAgent.id,
            contactId: contact.id,
            cardId: card.id,
            status: AgentConversationStatus.OPEN,
            summary,
            lastMessageAt: new Date(),
          },
        });

        await tx.agentMessage.create({
          data: {
            conversationId: conversation.id,
            role: AgentMessageRole.SYSTEM,
            content: this.buildFormSubmissionSystemNote(
              form.name,
              form.stage.name,
              normalizedPayload,
            ),
          },
        });

        await tx.cardActivity.create({
          data: {
            cardId: card.id,
            type: 'AGENT_ROUTED',
            content: `Lead encaminhado para o agente ${conversationAgent.name} a partir do formulario ${form.name}.`,
          },
        });
      } else {
        await tx.cardActivity.create({
          data: {
            cardId: card.id,
            type: 'AGENT_PENDING',
            content: `Lead capturado via formulario ${form.name}, mas o tenant ainda nao possui agente ativo para assumir a conversa.`,
          },
        });
      }
      return {
        contactId: contact.id,
        cardId: card.id,
        stageId: card.stageId,
      };
    });

    await this.journeyService.triggerJourneysForEvent(
      form.tenant.id,
      'lead_form_submitted',
      {
        origin: 'lead_form_public',
        formId: form.id,
        formName: form.name,
        formSlug: form.slug,
        stageId: submissionContext.stageId,
        contactId: submissionContext.contactId,
        cardId: submissionContext.cardId,
        answers: normalizedPayload,
      },
    );

    return {
      success: true,
      successTitle: form.successTitle ?? 'Cadastro recebido',
      successMessage:
        form.successMessage ??
        'Recebemos seus dados. O time vai seguir com o atendimento a partir desta jornada.',
    };
  }

  private async ensureValidStage(
    tenantId: string,
    stageId: string,
  ): Promise<void> {
    const stage = await this.prisma.stage.findFirst({
      where: {
        id: stageId,
        pipeline: { tenantId },
      },
    });

    if (!stage) {
      throw new BadRequestException(
        'Erro no Backend: A etapa informada nao existe ou nao pertence a este tenant.',
      );
    }
  }

  private async ensureUniqueSlug(
    tenantId: string,
    input: string,
    currentFormId?: string,
  ): Promise<string> {
    const slug = this.slugify(input);
    if (!slug) {
      throw new BadRequestException(
        'Erro no Backend: Nao foi possivel gerar um slug valido para o formulario.',
      );
    }

    const existing = await this.prisma.leadForm.findFirst({
      where: {
        tenantId,
        slug,
        ...(currentFormId ? { id: { not: currentFormId } } : {}),
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Erro no Backend: Ja existe um formulario com slug '${slug}' neste tenant.`,
      );
    }

    return slug;
  }

  private normalizeFields(fields: LeadFormFieldDto[]): LeadFormField[] {
    const normalized = fields.map((field) => ({
      id: this.normalizeFieldToken(field.id, 'identificador'),
      key: this.normalizeFieldToken(field.key, 'chave'),
      label: field.label.trim(),
      type: field.type as LeadFormField['type'],
      placeholder: this.normalizeOptionalText(field.placeholder) ?? undefined,
      helpText: this.normalizeOptionalText(field.helpText) ?? undefined,
      required: field.required ?? false,
      mapTo: (field.mapTo as LeadFormField['mapTo']) ?? 'custom',
      options:
        field.type === 'select'
          ? this.normalizeFieldOptions(field.options)
          : undefined,
    }));

    const ids = new Set<string>();
    const keys = new Set<string>();

    for (const field of normalized) {
      if (ids.has(field.id)) {
        throw new BadRequestException(
          `Erro no Backend: O identificador '${field.id}' esta duplicado no formulario.`,
        );
      }
      if (keys.has(field.key)) {
        throw new BadRequestException(
          `Erro no Backend: A chave '${field.key}' esta duplicada no formulario.`,
        );
      }
      ids.add(field.id);
      keys.add(field.key);
    }

    return normalized;
  }

  private normalizeStoredFields(value: Prisma.JsonValue): LeadFormField[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is Prisma.JsonObject => this.isJsonObject(item))
      .map((item) => ({
        id: String(item.id ?? ''),
        key: String(item.key ?? ''),
        label: String(item.label ?? ''),
        type: (item.type ?? 'text') as LeadFormField['type'],
        placeholder:
          typeof item.placeholder === 'string' ? item.placeholder : undefined,
        helpText: typeof item.helpText === 'string' ? item.helpText : undefined,
        required: Boolean(item.required),
        mapTo: (item.mapTo ?? 'custom') as LeadFormField['mapTo'],
        options: Array.isArray(item.options)
          ? item.options
              .filter((option): option is Prisma.JsonObject =>
                this.isJsonObject(option),
              )
              .map((option: Prisma.JsonObject) => ({
                label: String(option.label ?? ''),
                value: String(option.value ?? ''),
              }))
          : undefined,
      }));
  }

  private buildFormSubmissionSystemNote(
    formName: string,
    stageName: string,
    payload: Record<string, unknown>,
  ): string {
    const answerLines = Object.entries(payload)
      .map(([key, value]) => {
        if (value === null || value === undefined) {
          return null;
        }

        const normalizedValue =
          typeof value === 'string'
            ? value.trim()
            : Array.isArray(value)
              ? value.join(', ')
              : String(value);

        if (!normalizedValue) {
          return null;
        }

        return `- ${key}: ${normalizedValue}`;
      })
      .filter(Boolean)
      .join('\n');

    return [
      `Origem: formulario publico "${formName}"`,
      `Etapa inicial: ${stageName}`,
      answerLines
        ? 'Respostas capturadas:'
        : 'Nenhuma resposta detalhada foi registrada.',
      answerLines,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private normalizeFieldOptions(
    options?: LeadFormFieldDto['options'],
  ): LeadFormFieldOption[] {
    if (!options || options.length === 0) {
      throw new BadRequestException(
        'Erro no Backend: Campos do tipo select precisam de opcoes.',
      );
    }

    return options.map((option) => ({
      label: option.label.trim(),
      value: option.value.trim(),
    }));
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeFieldToken(value: string, fieldName: string): string {
    const normalized = this.slugify(value).replace(/-/g, '_');
    if (!normalized) {
      throw new BadRequestException(
        `Erro no Backend: O ${fieldName} do campo e invalido.`,
      );
    }

    return normalized;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private isJsonObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private validateSubmissionPayload(
    fields: LeadFormField[],
    payload: Record<string, unknown>,
  ): Record<string, string> {
    const normalizedPayload: Record<string, string> = {};

    for (const field of fields) {
      const rawValue = payload[field.key];
      const normalizedValue =
        typeof rawValue === 'string' ? rawValue.trim() : '';

      if (field.required && !normalizedValue) {
        throw new BadRequestException(
          `Erro no Backend: O campo '${field.label}' e obrigatorio.`,
        );
      }

      if (!normalizedValue) {
        continue;
      }

      if (
        field.type === 'email' &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)
      ) {
        throw new BadRequestException(
          `Erro no Backend: O campo '${field.label}' precisa de um e-mail valido.`,
        );
      }

      if (field.type === 'select') {
        const validOptions = field.options?.map((option) => option.value) ?? [];
        if (!validOptions.includes(normalizedValue)) {
          throw new BadRequestException(
            `Erro no Backend: O valor informado para '${field.label}' nao e permitido.`,
          );
        }
      }

      normalizedPayload[field.key] = normalizedValue;
    }

    return normalizedPayload;
  }

  private getMappedValue(
    fields: LeadFormField[],
    payload: Record<string, string>,
    mapTo: NonNullable<LeadFormField['mapTo']>,
  ): string | undefined {
    const mappedField = fields.find((field) => field.mapTo === mapTo);
    if (!mappedField) {
      return undefined;
    }

    return payload[mappedField.key];
  }

  private mapLeadForm(form: LeadFormWithStage): LeadFormResponse {
    return {
      id: form.id,
      name: form.name,
      slug: form.slug,
      headline: form.headline,
      description: form.description,
      submitButtonLabel: form.submitButtonLabel,
      successTitle: form.successTitle,
      successMessage: form.successMessage,
      isActive: form.isActive,
      stageId: form.stageId,
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
      fields: this.normalizeStoredFields(form.fields),
      stage: form.stage,
    };
  }
}
