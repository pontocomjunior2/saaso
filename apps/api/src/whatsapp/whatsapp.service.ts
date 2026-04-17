import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectWhatsAppDto } from './dto/connect-whatsapp.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { SimulateInboundMessageDto } from './dto/simulate-inbound-message.dto';
import {
  MessageDirection,
  MessageStatus,
  Prisma,
  type WhatsAppMessage,
  WhatsAppEventKind,
  WhatsAppStatus,
} from '@prisma/client';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { JourneyService } from '../journey/journey.service';
import { IWhatsAppProvider } from './providers/whatsapp-provider.interface';
import { MetaCloudProvider } from './providers/meta-cloud.provider';
import { EvolutionApiService } from './evolution.service';

export interface WhatsAppAccountResponse {
  id: string;
  phoneNumber: string | null;
  phoneNumberId: string | null;
  wabaId: string | null;
  status: WhatsAppStatus;
  provider: string;
  instanceName: string | null;
  assignedPipelineId: string | null;
  assignedPipelineName: string | null;
  hasAccessToken: boolean;
  connectionMode: 'cloud_api' | 'local_demo' | 'configuration_incomplete';
  isOperational: boolean;
  supportsSimulator: boolean;
  canSendOfficialOutbound: boolean;
  canReceiveOfficialWebhook: boolean;
  verifyTokenConfigured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InboxThreadMessage {
  id: string;
  content: string;
  direction: MessageDirection;
  status: string;
  createdAt: Date;
}

export interface InboxThreadCard {
  id: string;
  title: string;
  updatedAt: Date;
  stage: {
    id: string;
    name: string;
    pipeline: {
      id: string;
      name: string;
    };
  };
}

export interface InboxThreadAgent {
  id: string;
  name: string;
  isActive: boolean;
}

export interface InboxThreadConversation {
  id: string;
  status: string;
  summary: string | null;
  lastMessageAt: Date | null;
  updatedAt: Date;
  agent: InboxThreadAgent;
  card: InboxThreadCard | null;
}

export interface InboxThreadSummary {
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    company: {
      id: string;
      name: string;
    } | null;
  };
  latestMessage: InboxThreadMessage | null;
  latestConversation: InboxThreadConversation | null;
  latestCard: InboxThreadCard | null;
  assignedAgent: InboxThreadAgent | null;
  messageCount: number;
}

export interface InboxThreadDetail extends InboxThreadSummary {
  account: WhatsAppAccountResponse | null;
  messages: InboxThreadMessage[];
}

export interface WhatsAppEventResponse {
  id: string;
  tenantId: string;
  accountId: string | null;
  contactId: string | null;
  kind: WhatsAppEventKind;
  status: MessageStatus | null;
  externalId: string | null;
  source: string;
  error: string | null;
  payload: unknown;
  createdAt: Date;
}

interface ReceiveInboundInput {
  tenantId: string;
  accountId?: string | null;
  fromPhoneNumber: string;
  message: string;
  contactName?: string;
  companyName?: string;
  stageId?: string;
  externalId?: string;
  source: 'webhook' | 'simulator' | 'manual';
}

interface NormalizedWebhookPayload {
  type: 'message';
  toPhoneNumber?: string;
  phoneNumberId?: string;
  fromPhoneNumber: string;
  contactName?: string;
  message: string;
  externalId?: string;
}

interface NormalizedWebhookStatusPayload {
  type: 'status';
  externalId: string;
  phoneNumberId?: string;
  toPhoneNumber?: string;
  recipientPhoneNumber?: string;
  status: MessageStatus;
  rawStatus: string;
}

type NormalizedWebhookEvent =
  | NormalizedWebhookPayload
  | NormalizedWebhookStatusPayload;

interface OutboundDispatchResult {
  deliveryMode: 'cloud_api' | 'local_demo';
  status: MessageStatus;
  externalId: string | null;
  deliveryError: string | null;
}

interface WhatsAppOperationalState {
  connectionMode: WhatsAppAccountResponse['connectionMode'];
  isOperational: boolean;
  supportsSimulator: boolean;
  canSendOfficialOutbound: boolean;
  canReceiveOfficialWebhook: boolean;
  verifyTokenConfigured: boolean;
}

@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AgentRunnerService))
    private readonly agentRunnerService: AgentRunnerService,
    private readonly journeyService: JourneyService,
    private readonly metaCloudProvider: MetaCloudProvider,
    private readonly evolutionProvider: EvolutionApiService,
  ) {}

  public async upsertAccount(
    tenantId: string,
    dto: ConnectWhatsAppDto,
  ): Promise<WhatsAppAccountResponse> {
    const existing = await this.prisma.whatsAppAccount.findFirst({
      where: { tenantId },
    });

    const nextAccessToken =
      dto.accessToken?.trim() || existing?.accessToken || null;
    const nextPhoneNumber = dto.phoneNumber?.trim() || existing?.phoneNumber || '';
    const nextPhoneNumberId =
      dto.phoneNumberId?.trim() || existing?.phoneNumberId || null;
    const nextWabaId = dto.wabaId?.trim() || existing?.wabaId || null;
    const nextProvider = dto.provider?.trim() || existing?.provider || 'meta_cloud';
    const nextInstanceName =
      dto.instanceName?.trim() || existing?.instanceName || null;
    const nextApiKey = dto.apiKey?.trim() || existing?.apiKey || null;
    const nextWebhookUrl = dto.webhookUrl?.trim() || existing?.webhookUrl || null;
    const nextStatus = this.resolveStoredAccountStatus({
      phoneNumber: nextPhoneNumber,
      phoneNumberId: nextPhoneNumberId,
      accessToken: nextAccessToken,
      wabaId: nextWabaId,
      provider: nextProvider,
      instanceName: nextInstanceName,
    });

    const account = existing
      ? await this.prisma.whatsAppAccount.update({
          where: { id: existing.id },
          data: {
            phoneNumber: nextPhoneNumber,
            phoneNumberId: nextPhoneNumberId,
            wabaId: nextWabaId,
            accessToken: nextAccessToken,
            status: nextStatus,
            provider: nextProvider,
            instanceName: nextInstanceName,
            apiKey: nextApiKey,
            webhookUrl: nextWebhookUrl,
          },
        })
      : await this.prisma.whatsAppAccount.create({
          data: {
            phoneNumber: nextPhoneNumber || undefined,
            phoneNumberId: nextPhoneNumberId || undefined,
            wabaId: nextWabaId || undefined,
            accessToken: nextAccessToken || undefined,
            status: nextStatus,
            tenantId,
            provider: nextProvider,
            instanceName: nextInstanceName || undefined,
            apiKey: nextApiKey || undefined,
            webhookUrl: nextWebhookUrl || undefined,
          },
        });

    const mappedAccount = this.mapAccount(account);
    if (!mappedAccount) {
      throw new BadRequestException(
        'Erro no Backend: Nao foi possivel persistir a conta WhatsApp.',
      );
    }

    return mappedAccount;
  }

  public async getAccount(
    tenantId: string,
  ): Promise<WhatsAppAccountResponse | null> {
    const account = await this.prisma.whatsAppAccount.findFirst({
      where: { tenantId },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return this.mapAccount(account);
  }

  public async listAccounts(
    tenantId: string,
  ): Promise<WhatsAppAccountResponse[]> {
    const accounts = await this.prisma.whatsAppAccount.findMany({
      where: { tenantId },
      include: {
        pipeline: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    return accounts.map((a) => this.mapAccount(a)).filter(Boolean) as WhatsAppAccountResponse[];
  }

  public async createAccount(
    tenantId: string,
    dto: {
      provider?: string;
      phoneNumber?: string;
      phoneNumberId?: string;
      wabaId?: string;
      accessToken?: string;
      instanceName?: string;
      apiKey?: string;
      webhookUrl?: string;
    },
  ): Promise<WhatsAppAccountResponse> {
    const provider = dto.provider || 'meta_cloud';
    const phoneNumber = dto.phoneNumber?.trim() || null;
    const phoneNumberId = dto.phoneNumberId?.trim() || null;
    const wabaId = dto.wabaId?.trim() || null;
    const accessToken = dto.accessToken?.trim() || null;
    const instanceName = dto.instanceName?.trim() || null;
    const apiKey = dto.apiKey?.trim() || null;
    const webhookUrl = dto.webhookUrl?.trim() || null;
    const account = await this.prisma.whatsAppAccount.create({
      data: {
        tenantId,
        provider,
        phoneNumber,
        phoneNumberId,
        wabaId,
        accessToken,
        instanceName,
        apiKey,
        webhookUrl,
        status: this.resolveStoredAccountStatus({
          phoneNumber,
          phoneNumberId,
          accessToken,
          wabaId,
          provider,
          instanceName,
        }),
      },
    });
    return this.mapAccount(account)!;
  }

  public async updateAccount(
    tenantId: string,
    id: string,
    dto: {
      provider?: string;
      phoneNumber?: string;
      phoneNumberId?: string;
      wabaId?: string;
      accessToken?: string;
      instanceName?: string;
      apiKey?: string;
      webhookUrl?: string;
    },
  ): Promise<WhatsAppAccountResponse> {
    const existing = await this.prisma.whatsAppAccount.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new BadRequestException(
        'Erro no Backend: Conta WhatsApp nao encontrada neste tenant.',
      );
    }
    const provider = dto.provider?.trim() || existing.provider;
    const phoneNumber =
      dto.phoneNumber !== undefined ? dto.phoneNumber.trim() || null : existing.phoneNumber;
    const phoneNumberId =
      dto.phoneNumberId !== undefined ? dto.phoneNumberId.trim() || null : existing.phoneNumberId;
    const wabaId = dto.wabaId !== undefined ? dto.wabaId.trim() || null : existing.wabaId;
    const accessToken =
      dto.accessToken !== undefined ? dto.accessToken.trim() || null : existing.accessToken;
    const instanceName =
      dto.instanceName !== undefined ? dto.instanceName.trim() || null : existing.instanceName;
    const apiKey = dto.apiKey !== undefined ? dto.apiKey.trim() || null : existing.apiKey;
    const webhookUrl =
      dto.webhookUrl !== undefined ? dto.webhookUrl.trim() || null : existing.webhookUrl;
    const account = await this.prisma.whatsAppAccount.update({
      where: { id },
      data: {
        provider,
        phoneNumber,
        phoneNumberId,
        wabaId,
        accessToken,
        instanceName,
        apiKey,
        webhookUrl,
        status: this.resolveStoredAccountStatus({
          phoneNumber,
          phoneNumberId,
          accessToken,
          wabaId,
          provider,
          instanceName,
        }),
      },
    });
    return this.mapAccount(account)!;
  }

  public async disconnectAccount(
    tenantId: string,
    id: string,
  ): Promise<{ ok: true }> {
    const existing = await this.prisma.whatsAppAccount.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new BadRequestException(
        'Erro no Backend: Conta WhatsApp nao encontrada neste tenant.',
      );
    }
    if (existing.provider === 'evolution' && existing.instanceName) {
      await this.evolutionProvider.disconnectInstance(existing.instanceName);
    }
    await this.prisma.whatsAppAccount.update({
      where: { id },
      data: { status: 'DISCONNECTED' },
    });
    return { ok: true };
  }

  public async deleteAccount(
    tenantId: string,
    id: string,
  ): Promise<{ ok: true }> {
    const existing = await this.prisma.whatsAppAccount.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new BadRequestException(
        'Erro no Backend: Conta WhatsApp nao encontrada neste tenant.',
      );
    }
    await this.prisma.whatsAppAccount.delete({ where: { id } });
    return { ok: true };
  }

  public async getEvolutionQrCode(instanceName: string): Promise<string> {
    return this.evolutionProvider.getQrCode(instanceName);
  }

  public async getEvolutionConnectionState(instanceName: string): Promise<string> {
    return this.evolutionProvider.getInstanceState(instanceName);
  }

  public async listInboxThreads(
    tenantId: string,
  ): Promise<InboxThreadSummary[]> {
    const contacts = await this.prisma.contact.findMany({
      where: {
        tenantId,
        OR: [{ messages: { some: {} } }, { agentConversations: { some: {} } }],
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        agentConversations: {
          take: 1,
          orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
            card: {
              select: {
                id: true,
                title: true,
                updatedAt: true,
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
            },
          },
        },
        cards: {
          take: 1,
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            title: true,
            updatedAt: true,
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
                agents: {
                  take: 1,
                  orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
                  select: {
                    id: true,
                    name: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    return contacts
      .map((contact) => ({
        contact: {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          company: contact.company,
        },
        latestMessage: this.mapInboxMessage(contact.messages[0] ?? null),
        latestConversation: this.mapInboxConversation(
          contact.agentConversations[0] ?? null,
        ),
        latestCard: this.mapInboxCard(contact.cards[0] ?? null),
        assignedAgent: this.resolveAssignedAgent(
          contact.agentConversations[0]?.agent ?? null,
          contact.cards[0] ?? null,
        ),
        messageCount: contact._count.messages,
      }))
      .sort((left, right) => {
        const rightDate =
          right.latestMessage?.createdAt ??
          right.latestConversation?.lastMessageAt ??
          right.latestConversation?.updatedAt ??
          new Date(0);
        const leftDate =
          left.latestMessage?.createdAt ??
          left.latestConversation?.lastMessageAt ??
          left.latestConversation?.updatedAt ??
          new Date(0);

        return rightDate.getTime() - leftDate.getTime();
      });
  }

  public async getInboxThread(
    tenantId: string,
    contactId: string,
  ): Promise<InboxThreadDetail> {
    const [account, contact] = await Promise.all([
      this.prisma.whatsAppAccount.findFirst({
        where: { tenantId },
      }),
      this.prisma.contact.findFirst({
        where: {
          id: contactId,
          tenantId,
        },
        include: {
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          agentConversations: {
            take: 1,
            orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
            include: {
              agent: {
                select: {
                  id: true,
                  name: true,
                  isActive: true,
                },
              },
              card: {
                select: {
                  id: true,
                  title: true,
                  updatedAt: true,
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
                      agents: {
                        take: 1,
                        orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
                        select: {
                          id: true,
                          name: true,
                          isActive: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          cards: {
            take: 1,
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            select: {
              id: true,
              title: true,
              updatedAt: true,
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
                  agents: {
                    take: 1,
                    orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
                    select: {
                      id: true,
                      name: true,
                      isActive: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),
    ]);

    if (!contact) {
      throw new NotFoundException(
        'Erro no Backend: Thread de inbox não encontrada neste tenant.',
      );
    }

    return {
      account: this.mapAccount(account),
      contact: {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        company: contact.company,
      },
      latestMessage: this.mapInboxMessage(
        contact.messages[contact.messages.length - 1] ?? null,
      ),
      latestConversation: this.mapInboxConversation(
        contact.agentConversations[0] ?? null,
      ),
      latestCard: this.mapInboxCard(contact.cards[0] ?? null),
      assignedAgent: this.resolveAssignedAgent(
        contact.agentConversations[0]?.agent ?? null,
        contact.cards[0] ?? null,
      ),
      messageCount: contact._count.messages,
      messages: contact.messages
        .map((message) => this.mapInboxMessage(message))
        .filter(Boolean) as InboxThreadMessage[],
    };
  }

  public async logMessage(
    tenantId: string,
    dto: CreateMessageDto,
  ): Promise<
    WhatsAppMessage & {
      deliveryMode?: 'cloud_api' | 'local_demo';
      deliveryError?: string | null;
    }
  > {
    const direction = dto.direction ?? MessageDirection.OUTBOUND;
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, tenantId },
    });

    if (!contact) {
      throw new BadRequestException(
        'Erro no Backend: Contato não encontrado neste tenant.',
      );
    }

    if (direction === MessageDirection.INBOUND) {
      const message = await this.prisma.whatsAppMessage.create({
        data: {
          contactId: dto.contactId,
          content: dto.content,
          direction,
          externalId: dto.externalId,
          status: MessageStatus.SENT,
        },
      });

      await this.agentRunnerService.processInboundMessage({
        tenantId,
        contactId: dto.contactId,
        cardId: dto.cardId,
        messageContent: dto.content,
        whatsAppMessageId: message.id,
      });

      return message;
    }

    const account = await this.prisma.whatsAppAccount.findFirst({
      where: { tenantId },
    });

    if (!contact.phone?.trim()) {
      throw new BadRequestException(
        'Erro no Backend: O contato precisa de telefone para receber mensagem outbound.',
      );
    }

    if (!account) {
      throw new BadRequestException(
        'Erro no Backend: Configure uma conta WhatsApp antes de enviar mensagens outbound.',
      );
    }

    const dispatchResult = await this.dispatchOutboundMessage(
      account,
      contact.phone,
      dto.content,
      dto.externalId,
    );

    const message = await this.prisma.whatsAppMessage.create({
      data: {
        contactId: dto.contactId,
        content: dto.content,
        direction,
        externalId: dispatchResult.externalId,
        status: dispatchResult.status,
      },
    });

    await this.recordWhatsAppEvent({
      tenantId,
      accountId: account.id,
      contactId: contact.id,
      kind: WhatsAppEventKind.OUTBOUND_SEND,
      source: dispatchResult.deliveryMode,
      status: dispatchResult.status,
      externalId: dispatchResult.externalId,
      payload: {
        contactId: dto.contactId,
        cardId: dto.cardId ?? null,
        content: dto.content,
        direction,
        deliveryMode: dispatchResult.deliveryMode,
      },
      error: dispatchResult.deliveryError,
    });

    if (dto.cardId) {
      await this.prisma.cardActivity.create({
        data: {
          cardId: dto.cardId,
          type:
            dispatchResult.status === MessageStatus.FAILED
              ? 'WHATSAPP_OUTBOUND_FAILED'
              : 'WHATSAPP_OUTBOUND',
          content:
            dispatchResult.status === MessageStatus.FAILED
              ? `Falha ao enviar mensagem outbound via WhatsApp (${dispatchResult.deliveryMode}).`
              : `Mensagem outbound enviada via WhatsApp (${dispatchResult.deliveryMode}).`,
        },
      });
    }

    return {
      ...message,
      deliveryMode: dispatchResult.deliveryMode,
      deliveryError: dispatchResult.deliveryError,
    };
  }

  public async simulateInboundMessage(
    tenantId: string,
    dto: SimulateInboundMessageDto,
  ) {
    const account = await this.prisma.whatsAppAccount.findFirst({
      where: { tenantId },
    });
    const operationalState = account
      ? this.resolveOperationalState(account)
      : null;

    if (!account || !operationalState?.supportsSimulator) {
      throw new BadRequestException(
        'Erro no Backend: Configure e conecte uma conta WhatsApp antes de simular mensagens inbound.',
      );
    }

    return this.receiveInboundMessage({
      tenantId,
      fromPhoneNumber: dto.fromPhoneNumber,
      contactName: dto.contactName,
      companyName: dto.companyName,
      message: dto.message,
      stageId: dto.stageId,
      externalId: dto.externalId,
      source: 'simulator',
    });
  }

  public async receiveProviderInboundMessage(input: ReceiveInboundInput) {
    return this.receiveInboundMessage(input);
  }

  public async getMessages(
    tenantId: string,
    contactId: string,
  ): Promise<WhatsAppMessage[]> {
    return this.prisma.whatsAppMessage.findMany({
      where: {
        contactId,
        contact: { tenantId },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async listEvents(
    tenantId: string,
    limit = 25,
  ): Promise<WhatsAppEventResponse[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const events = await this.prisma.whatsAppEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });

    return events.map((event) => ({
      id: event.id,
      tenantId: event.tenantId,
      accountId: event.accountId,
      contactId: event.contactId,
      kind: event.kind,
      status: event.status,
      externalId: event.externalId,
      source: event.source,
      error: event.error,
      payload: event.payload,
      createdAt: event.createdAt,
    }));
  }

  public async handleWebhook(payload: unknown) {
    const normalizedEvents = this.normalizeWebhookEvents(payload);
    if (normalizedEvents.length === 0) {
      return {
        accepted: false,
        reason: 'payload_not_supported',
      };
    }

    let acceptedMessages = 0;
    let updatedStatuses = 0;
    let ignoredStatusUpdates = 0;
    let ignoredMessages = 0;

    for (const event of normalizedEvents) {
      if (event.type === 'status') {
        const account = await this.resolveAccountForWebhook({
          type: 'message',
          toPhoneNumber:
            event.toPhoneNumber ?? event.recipientPhoneNumber ?? undefined,
          phoneNumberId: event.phoneNumberId,
          fromPhoneNumber: event.recipientPhoneNumber ?? 'status-webhook',
          message: event.rawStatus,
          externalId: event.externalId,
        } as NormalizedWebhookPayload);
        const updated = await this.applyWebhookStatus(event);
        if (account) {
          await this.recordWhatsAppEvent({
            tenantId: account.tenantId,
            accountId: account.id,
            kind: WhatsAppEventKind.WEBHOOK_STATUS,
            source: 'webhook',
            status: event.status,
            externalId: event.externalId,
            payload: event,
          });
        }
        if (updated) {
          updatedStatuses += 1;
        } else {
          ignoredStatusUpdates += 1;
        }

        continue;
      }

      const account = await this.resolveAccountForWebhook(event);
      if (!account) {
        ignoredMessages += 1;
        continue;
      }

      await this.recordWhatsAppEvent({
        tenantId: account.tenantId,
        accountId: account.id,
        kind: WhatsAppEventKind.WEBHOOK_MESSAGE,
        source: 'webhook',
        externalId: event.externalId,
        payload: event,
      });

      await this.receiveInboundMessage({
        tenantId: account.tenantId,
        accountId: account.id,
        fromPhoneNumber: event.fromPhoneNumber,
        contactName: event.contactName,
        message: event.message,
        externalId: event.externalId,
        source: 'webhook',
      });
      acceptedMessages += 1;
    }

    return {
      accepted: true,
      acceptedMessages,
      updatedStatuses,
      ignoredMessages,
      ignoredStatusUpdates,
    };
  }

  public verifyWebhookChallenge(query: Record<string, unknown>) {
    const mode =
      typeof query['hub.mode'] === 'string'
        ? query['hub.mode']
        : typeof query.mode === 'string'
          ? query.mode
          : null;
    const verifyToken =
      typeof query['hub.verify_token'] === 'string'
        ? query['hub.verify_token']
        : typeof query.verify_token === 'string'
          ? query.verify_token
          : null;
    const challenge =
      typeof query['hub.challenge'] === 'string'
        ? query['hub.challenge']
        : typeof query.challenge === 'string'
          ? query.challenge
          : null;
    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
    if (!expectedToken) {
      throw new ForbiddenException(
        'Erro no Backend: WHATSAPP_WEBHOOK_VERIFY_TOKEN não configurado.',
      );
    }

    if (mode !== 'subscribe' || !challenge) {
      throw new BadRequestException(
        'Erro no Backend: Requisicao de verificacao do webhook invalida.',
      );
    }

    if (verifyToken !== expectedToken) {
      throw new ForbiddenException(
        'Erro no Backend: Verify token do webhook invalido.',
      );
    }

    return challenge;
  }

  async syncEvolutionInstanceStatus(
    tenantId: string,
    instanceName: string,
  ): Promise<{ evolutionState: string; dbStatus: string; synced: boolean }> {
    return this.evolutionProvider.syncInstanceStatus(tenantId, instanceName);
  }

  // -- Provider resolution (new) --

  private async resolveProvider(account: {
    provider?: string | null;
    instanceName?: string | null;
    phoneNumber?: string | null;
    phoneNumberId?: string | null;
    accessToken?: string | null;
    wabaId?: string | null;
  }): Promise<IWhatsAppProvider> {
    const providerName = account.provider ?? 'meta_cloud';
    if (providerName === 'evolution') {
      return this.evolutionProvider;
    }
    return this.metaCloudProvider;
  }

  private async dispatchOutboundMessage(
    account: {
      phoneNumber: string | null;
      phoneNumberId: string | null;
      accessToken: string | null;
      provider?: string | null;
      instanceName?: string | null;
    },
    toPhoneNumber: string,
    content: string,
    externalId?: string,
  ): Promise<OutboundDispatchResult> {
    const normalizedPhone = this.normalizePhone(toPhoneNumber);
    if (!normalizedPhone) {
      throw new BadRequestException(
        'Erro no Backend: O contato precisa de um telefone válido para envio outbound.',
      );
    }

    const operationalState = this.resolveOperationalState(account);
    if (!operationalState.isOperational) {
      throw new BadRequestException(
        'Erro no Backend: O canal WhatsApp ainda não está operacional neste workspace.',
      );
    }

    // Provider-based dispatch
    const providerName = account.provider ?? 'meta_cloud';
    if (providerName === 'evolution') {
      try {
        await this.evolutionProvider.sendMessage(normalizedPhone, content, undefined, { instanceName: account.instanceName ?? undefined });
        return {
          deliveryMode: 'cloud_api',
          status: MessageStatus.SENT,
          externalId: externalId ?? `wamid.evolution.${Date.now()}`,
          deliveryError: null,
        };
      } catch (error) {
        return {
          deliveryMode: 'cloud_api',
          status: MessageStatus.FAILED,
          externalId: externalId ?? null,
          deliveryError:
            error instanceof Error
              ? error.message
              : 'Erro desconhecido ao enviar via Evolution API.',
        };
      }
    }

    if (
      operationalState.connectionMode === 'cloud_api' &&
      account.accessToken &&
      account.phoneNumberId
    ) {
      return this.dispatchCloudApiMessage({
        accessToken: account.accessToken,
        phoneNumberId: account.phoneNumberId,
        toPhoneNumber: normalizedPhone,
        content,
        externalId,
      });
    }

    // Meta Cloud with local_demo fallback
    try {
      await this.metaCloudProvider.sendMessage(normalizedPhone, content);
      return {
        deliveryMode: 'cloud_api',
        status: MessageStatus.SENT,
        externalId: externalId ?? `wamid.cloud.${Date.now()}`,
        deliveryError: null,
      };
    } catch (error) {
      return {
        deliveryMode: 'cloud_api',
        status: MessageStatus.FAILED,
        externalId: externalId ?? null,
        deliveryError:
          error instanceof Error
            ? error.message
            : 'Erro desconhecido ao enviar via Meta Cloud API.',
      };
    }
  }

  private async recordWhatsAppEvent(input: {
    tenantId: string;
    kind: WhatsAppEventKind;
    source: string;
    accountId?: string | null;
    contactId?: string | null;
    status?: MessageStatus | null;
    externalId?: string | null;
    payload?: unknown;
    error?: string | null;
  }): Promise<void> {
    await this.prisma.whatsAppEvent.create({
      data: {
        tenantId: input.tenantId,
        accountId: input.accountId ?? null,
        contactId: input.contactId ?? null,
        kind: input.kind,
        status: input.status ?? null,
        externalId: input.externalId ?? null,
        source: input.source,
        payload: input.payload as Prisma.InputJsonValue | undefined,
        error: input.error ?? null,
      },
    });
  }

  private async dispatchCloudApiMessage(input: {
    accessToken: string;
    phoneNumberId: string;
    toPhoneNumber: string;
    content: string;
    externalId?: string;
  }): Promise<OutboundDispatchResult> {
    const apiBaseUrl = (
      process.env.WHATSAPP_CLOUD_API_BASE_URL?.trim() ||
      'https://graph.facebook.com/v23.0'
    ).replace(/\/$/, '');

    try {
      const response = await fetch(
        `${apiBaseUrl}/${input.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${input.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: input.toPhoneNumber,
            type: 'text',
            text: {
              preview_url: false,
              body: input.content,
            },
          }),
        },
      );

      const responseBody = (await response.json().catch(() => null)) as Record<
        string,
        unknown
      > | null;

      if (!response.ok) {
        return {
          deliveryMode: 'cloud_api',
          status: MessageStatus.FAILED,
          externalId: input.externalId ?? null,
          deliveryError: this.extractCloudApiError(
            response.status,
            responseBody,
          ),
        };
      }

      const externalId = this.extractCloudApiMessageId(responseBody);

      return {
        deliveryMode: 'cloud_api',
        status: MessageStatus.SENT,
        externalId:
          externalId ?? input.externalId ?? `wamid.cloud.${Date.now()}`,
        deliveryError: null,
      };
    } catch (error) {
      return {
        deliveryMode: 'cloud_api',
        status: MessageStatus.FAILED,
        externalId: input.externalId ?? null,
        deliveryError:
          error instanceof Error
            ? error.message
            : 'Erro desconhecido ao enviar via Cloud API.',
      };
    }
  }

  private async receiveInboundMessage(input: ReceiveInboundInput) {
    const normalizedPhone = this.normalizePhone(input.fromPhoneNumber);
    if (!normalizedPhone) {
      throw new BadRequestException(
        'Erro no Backend: O telefone inbound recebido é inválido.',
      );
    }

    const account = input.accountId
      ? await this.prisma.whatsAppAccount.findFirst({
          where: {
            id: input.accountId,
            tenantId: input.tenantId,
          },
        })
      : await this.prisma.whatsAppAccount.findFirst({
          where: {
            tenantId: input.tenantId,
          },
        });

    if (!account) {
      throw new BadRequestException(
        'Erro no Backend: Tenant sem conta WhatsApp configurada.',
      );
    }

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      let companyId: string | undefined;

      if (input.companyName?.trim()) {
        const normalizedCompanyName = input.companyName.trim();
        const existingCompany = await tx.company.findFirst({
          where: {
            tenantId: input.tenantId,
            name: {
              equals: normalizedCompanyName,
              mode: 'insensitive',
            },
          },
        });

        const company =
          existingCompany ??
          (await tx.company.create({
            data: {
              tenantId: input.tenantId,
              name: normalizedCompanyName,
            },
          }));

        companyId = company.id;
      }

      const existingContacts = await tx.contact.findMany({
        where: {
          tenantId: input.tenantId,
          phone: {
            not: null,
          },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          companyId: true,
          email: true,
          position: true,
          tags: true,
        },
      });

      const existingContact = existingContacts.find(
        (contact) => this.normalizePhone(contact.phone) === normalizedPhone,
      );

      const contact = existingContact
        ? await tx.contact.update({
            where: { id: existingContact.id },
            data: {
              name:
                existingContact.name ||
                input.contactName?.trim() ||
                normalizedPhone,
              phone: existingContact.phone ?? input.fromPhoneNumber.trim(),
              companyId: companyId ?? existingContact.companyId,
              tags: Array.from(
                new Set([...(existingContact.tags ?? []), 'whatsapp']),
              ),
            },
          })
        : await tx.contact.create({
            data: {
              tenantId: input.tenantId,
              name:
                input.contactName?.trim() || `Lead WhatsApp ${normalizedPhone}`,
              phone: input.fromPhoneNumber.trim(),
              companyId,
              tags: ['whatsapp'],
            },
          });

        const existingCard = await tx.card.findFirst({
          where: {
            tenantId: input.tenantId,
            contactId: contact.id,
            ...(account?.id
              ? {
                  stage: {
                    pipeline: {
                      whatsAppAccountId: account.id,
                    },
                  },
                }
              : {}),
          },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          stageId: true,
        },
      });

      let cardId = existingCard?.id;
      let stageId = existingCard?.stageId;

        if (!cardId) {
          const targetStage = await this.resolveInboundStage(
            tx,
            input.tenantId,
            input.stageId,
            account?.id,
          );
        const lastCardInfo = await tx.card.aggregate({
          where: { stageId: targetStage.id },
          _max: { position: true },
        });

        const createdCard = await tx.card.create({
          data: {
            title: `WhatsApp · ${contact.name}`,
            stageId: targetStage.id,
            position:
              lastCardInfo._max.position !== null
                ? lastCardInfo._max.position + 1
                : 0,
            tenantId: input.tenantId,
            contactId: contact.id,
            customFields: {
              source: 'whatsapp_inbound',
              channel: 'whatsapp',
              createdVia: 'webhook_or_simulation',
              lastInboundAt: new Date().toISOString(),
            },
          },
        });

        await tx.cardActivity.create({
          data: {
            cardId: createdCard.id,
            type: 'CREATED',
            content: `Lead criado automaticamente via WhatsApp na etapa ${targetStage.pipeline.name} > ${targetStage.name}.`,
          },
        });

        cardId = createdCard.id;
        stageId = createdCard.stageId;
      }

      if (!cardId || !stageId) {
        throw new BadRequestException(
          'Erro no Backend: Não foi possível determinar o card para a mensagem inbound.',
        );
      }

      const message = await tx.whatsAppMessage.create({
        data: {
          contactId: contact.id,
          content: input.message.trim(),
          direction: MessageDirection.INBOUND,
          externalId: input.externalId,
          status: MessageStatus.DELIVERED,
        },
      });

      await tx.cardActivity.create({
        data: {
          cardId,
          type: 'WHATSAPP_INBOUND',
          content: `Mensagem inbound recebida via WhatsApp: ${this.truncate(input.message.trim(), 140)}`,
        },
      });

      return {
        accountId: account.id,
        contactId: contact.id,
        cardId,
        stageId,
        messageId: message.id,
      };
    });

    await this.recordWhatsAppEvent({
      tenantId: input.tenantId,
      accountId: transactionResult.accountId,
      contactId: transactionResult.contactId,
      kind:
        input.source === 'simulator'
          ? WhatsAppEventKind.WEBHOOK_SIMULATOR
          : WhatsAppEventKind.WEBHOOK_MESSAGE,
      source: input.source,
      externalId: input.externalId,
      payload: {
        fromPhoneNumber: normalizedPhone,
        message: input.message.trim(),
        companyName: input.companyName ?? null,
        stageId: input.stageId ?? null,
      },
    });

    const runnerResult = await this.agentRunnerService.processInboundMessage({
      tenantId: input.tenantId,
      contactId: transactionResult.contactId,
      cardId: transactionResult.cardId,
      messageContent: input.message.trim(),
      whatsAppMessageId: transactionResult.messageId,
    });

    if (runnerResult.status === 'no_agent') {
      await this.prisma.cardActivity.create({
        data: {
          cardId: transactionResult.cardId,
          type: 'AGENT_PENDING',
          content:
            'Mensagem inbound recebida, mas nao existe agente ativo para a etapa atual.',
        },
      });
    }

    await this.journeyService.triggerJourneysForEvent(
      input.tenantId,
      'whatsapp_inbound_received',
      {
        origin: 'whatsapp_inbound',
        phoneNumber: normalizedPhone,
        externalId: input.externalId ?? null,
        messageContent: input.message.trim(),
        contactId: transactionResult.contactId,
        cardId: transactionResult.cardId,
        stageId: transactionResult.stageId,
        whatsAppMessageId: transactionResult.messageId,
      },
    );

    return {
      accountId: transactionResult.accountId,
      contactId: transactionResult.contactId,
      cardId: transactionResult.cardId,
      messageId: transactionResult.messageId,
      runner: runnerResult,
    };
  }

  private async resolveInboundStage(
    tx: Prisma.TransactionClient,
    tenantId: string,
    stageId?: string,
    accountId?: string | null,
  ): Promise<{
    id: string;
    name: string;
    pipeline: {
      id: string;
      name: string;
    };
  }> {
    if (stageId) {
      const stage = await tx.stage.findFirst({
        where: {
          id: stageId,
          pipeline: {
            tenantId,
          },
        },
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
      });

      if (!stage) {
        throw new BadRequestException(
          'Erro no Backend: A etapa escolhida para inbound não pertence a este tenant.',
        );
      }

      return stage;
    }

    if (accountId) {
      const pipelineWithConfiguredStage = await tx.pipeline.findFirst({
        where: {
          tenantId,
          whatsAppAccountId: accountId,
        },
        select: {
          id: true,
          name: true,
          whatsAppInboundStage: {
            select: {
              id: true,
              name: true,
            },
          },
          stages: {
            orderBy: { order: 'asc' },
            take: 1,
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const configuredStage =
        pipelineWithConfiguredStage?.whatsAppInboundStage ??
        pipelineWithConfiguredStage?.stages[0] ??
        null;

      if (pipelineWithConfiguredStage && configuredStage) {
        return {
          id: configuredStage.id,
          name: configuredStage.name,
          pipeline: {
            id: pipelineWithConfiguredStage.id,
            name: pipelineWithConfiguredStage.name,
          },
        };
      }
    }

    const pipeline = await tx.pipeline.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        stages: {
          orderBy: { order: 'asc' },
          take: 1,
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const fallbackStage = pipeline?.stages[0];
    if (!pipeline || !fallbackStage) {
      throw new BadRequestException(
        'Erro no Backend: O tenant precisa de pelo menos um pipeline com etapa inicial para receber mensagens inbound.',
      );
    }

    return {
      id: fallbackStage.id,
      name: fallbackStage.name,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
      },
    };
  }

  private async resolveAccountForWebhook(input: NormalizedWebhookPayload) {
    if (input.phoneNumberId) {
      const accountByPhoneNumberId =
        await this.prisma.whatsAppAccount.findFirst({
          where: {
            phoneNumberId: input.phoneNumberId,
          },
        });

      if (accountByPhoneNumberId) {
        return accountByPhoneNumberId;
      }
    }

    if (!input.toPhoneNumber) {
      return null;
    }

    const accounts = await this.prisma.whatsAppAccount.findMany({
      where: {
        phoneNumber: {
          not: null,
        },
      },
    });

    const normalizedTargetPhone = this.normalizePhone(input.toPhoneNumber);
    return (
      accounts.find(
        (account) =>
          this.normalizePhone(account.phoneNumber) === normalizedTargetPhone,
      ) ?? null
    );
  }

  private async applyWebhookStatus(
    payload: NormalizedWebhookStatusPayload,
  ): Promise<boolean> {
    const existingMessage = await this.prisma.whatsAppMessage.findFirst({
      where: {
        externalId: payload.externalId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existingMessage) {
      return false;
    }

    if (existingMessage.status !== payload.status) {
      await this.prisma.whatsAppMessage.update({
        where: { id: existingMessage.id },
        data: { status: payload.status },
      });
    }

    return true;
  }

  private normalizeWebhookEvents(payload: unknown): NormalizedWebhookEvent[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const directPayload = payload as Record<string, unknown>;
    if (
      typeof directPayload.fromPhoneNumber === 'string' &&
      typeof directPayload.message === 'string'
    ) {
      return [
        {
          type: 'message',
          toPhoneNumber:
            typeof directPayload.toPhoneNumber === 'string'
              ? directPayload.toPhoneNumber
              : undefined,
          phoneNumberId:
            typeof directPayload.phoneNumberId === 'string'
              ? directPayload.phoneNumberId
              : undefined,
          fromPhoneNumber: directPayload.fromPhoneNumber,
          contactName:
            typeof directPayload.contactName === 'string'
              ? directPayload.contactName
              : undefined,
          message: directPayload.message,
          externalId:
            typeof directPayload.externalId === 'string'
              ? directPayload.externalId
              : undefined,
        },
      ];
    }

    const entries = Array.isArray(directPayload.entry)
      ? directPayload.entry
      : [];
    const normalizedEvents: NormalizedWebhookEvent[] = [];

    for (const entry of entries) {
      const changes =
        entry &&
        typeof entry === 'object' &&
        Array.isArray((entry as { changes?: unknown[] }).changes)
          ? (entry as { changes: unknown[] }).changes
          : [];

      for (const change of changes) {
        const value =
          change && typeof change === 'object'
            ? (change as { value?: Record<string, unknown> }).value
            : null;

        if (!value) {
          continue;
        }

        const metadata = value.metadata as
          | { phone_number_id?: unknown; display_phone_number?: unknown }
          | undefined;
        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        const messages = Array.isArray(value.messages) ? value.messages : [];
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];
        const firstContact = contacts[0] as
          | { profile?: { name?: unknown } }
          | undefined;

        for (const message of messages) {
          if (!message || typeof message !== 'object') {
            continue;
          }

          const fromPhoneNumber =
            typeof (message as { from?: unknown }).from === 'string'
              ? (message as { from: string }).from
              : null;
          const content = this.extractWebhookMessageContent(
            message as Record<string, unknown>,
          );

          if (!fromPhoneNumber || !content) {
            continue;
          }

          normalizedEvents.push({
            type: 'message',
            toPhoneNumber:
              typeof metadata?.display_phone_number === 'string'
                ? metadata.display_phone_number
                : undefined,
            phoneNumberId:
              typeof metadata?.phone_number_id === 'string'
                ? metadata.phone_number_id
                : undefined,
            fromPhoneNumber,
            contactName:
              typeof firstContact?.profile?.name === 'string'
                ? firstContact.profile.name
                : undefined,
            message: content,
            externalId:
              typeof (message as { id?: unknown }).id === 'string'
                ? (message as { id: string }).id
                : undefined,
          });
        }

        for (const statusEvent of statuses) {
          if (!statusEvent || typeof statusEvent !== 'object') {
            continue;
          }

          const mappedStatus = this.mapWebhookStatusToMessageStatus(
            (statusEvent as { status?: unknown }).status,
          );
          const externalId =
            typeof (statusEvent as { id?: unknown }).id === 'string'
              ? (statusEvent as { id: string }).id
              : null;

          if (!mappedStatus || !externalId) {
            continue;
          }

          normalizedEvents.push({
            type: 'status',
            externalId,
            phoneNumberId:
              typeof metadata?.phone_number_id === 'string'
                ? metadata.phone_number_id
                : undefined,
            toPhoneNumber:
              typeof metadata?.display_phone_number === 'string'
                ? metadata.display_phone_number
                : undefined,
            recipientPhoneNumber:
              typeof (statusEvent as { recipient_id?: unknown })
                .recipient_id === 'string'
                ? (statusEvent as { recipient_id: string }).recipient_id
                : undefined,
            status: mappedStatus,
            rawStatus: String((statusEvent as { status?: unknown }).status),
          });
        }
      }
    }

    return normalizedEvents;
  }

  private extractWebhookMessageContent(
    message: Record<string, unknown>,
  ): string | null {
    const text = message.text as { body?: unknown } | undefined;
    if (typeof text?.body === 'string' && text.body.trim().length > 0) {
      return text.body.trim();
    }

    const button = message.button as { text?: unknown } | undefined;
    if (typeof button?.text === 'string' && button.text.trim().length > 0) {
      return `Botao pressionado: ${button.text.trim()}`;
    }

    const interactive = message.interactive as
      | {
          button_reply?: { title?: unknown };
          list_reply?: { title?: unknown };
        }
      | undefined;
    if (
      typeof interactive?.button_reply?.title === 'string' &&
      interactive.button_reply.title.trim().length > 0
    ) {
      return `Interacao: ${interactive.button_reply.title.trim()}`;
    }

    if (
      typeof interactive?.list_reply?.title === 'string' &&
      interactive.list_reply.title.trim().length > 0
    ) {
      return `Interacao: ${interactive.list_reply.title.trim()}`;
    }

    const reaction = message.reaction as { emoji?: unknown } | undefined;
    if (
      typeof reaction?.emoji === 'string' &&
      reaction.emoji.trim().length > 0
    ) {
      return `Reacao recebida: ${reaction.emoji.trim()}`;
    }

    const image = message.image as { caption?: unknown } | undefined;
    if (typeof image?.caption === 'string' && image.caption.trim().length > 0) {
      return `Imagem enviada: ${image.caption.trim()}`;
    }

    const document = message.document as
      | { caption?: unknown; filename?: unknown }
      | undefined;
    if (
      typeof document?.caption === 'string' &&
      document.caption.trim().length > 0
    ) {
      return `Documento enviado: ${document.caption.trim()}`;
    }

    if (
      typeof document?.filename === 'string' &&
      document.filename.trim().length > 0
    ) {
      return `Documento enviado: ${document.filename.trim()}`;
    }

    const type =
      typeof message.type === 'string' ? message.type.trim().toLowerCase() : '';

    if (type === 'audio') {
      return 'Audio recebido via WhatsApp.';
    }

    if (type === 'video') {
      return 'Video recebido via WhatsApp.';
    }

    if (type === 'image') {
      return 'Imagem recebida via WhatsApp.';
    }

    if (type === 'document') {
      return 'Documento recebido via WhatsApp.';
    }

    return null;
  }

  private mapWebhookStatusToMessageStatus(
    status: unknown,
  ): MessageStatus | null {
    if (typeof status !== 'string') {
      return null;
    }

    switch (status.trim().toLowerCase()) {
      case 'sent':
        return MessageStatus.SENT;
      case 'delivered':
        return MessageStatus.DELIVERED;
      case 'read':
        return MessageStatus.READ;
      case 'failed':
        return MessageStatus.FAILED;
      default:
        return null;
    }
  }

  private normalizePhone(value?: string | null): string {
    return (value ?? '').replace(/\D/g, '');
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 1)}…`;
  }

  private resolveStoredAccountStatus(input: {
    phoneNumber?: string | null;
    phoneNumberId?: string | null;
    accessToken?: string | null;
    wabaId?: string | null;
    provider?: string | null;
    instanceName?: string | null;
  }): WhatsAppStatus {
    const hasPhoneNumber = Boolean(this.normalizePhone(input.phoneNumber));
    const hasInstanceName = Boolean(input.instanceName);
    const hasCloudHints = Boolean(
      input.accessToken?.trim() ||
      input.phoneNumberId?.trim() ||
      input.wabaId?.trim(),
    );

    if (!hasPhoneNumber && !hasInstanceName && hasCloudHints) {
      return WhatsAppStatus.ERROR;
    }

    if (!hasPhoneNumber && !hasInstanceName) {
      return WhatsAppStatus.DISCONNECTED;
    }

    return WhatsAppStatus.CONNECTED;
  }

  private resolveOperationalState(input: {
    phoneNumber?: string | null;
    phoneNumberId?: string | null;
    accessToken?: string | null;
    wabaId?: string | null;
    provider?: string | null;
    instanceName?: string | null;
  }): WhatsAppOperationalState {
    const providerName = input.provider ?? 'meta_cloud';
    const hasPhoneNumber = Boolean(this.normalizePhone(input.phoneNumber));
    const hasInstanceName = Boolean(input.instanceName);
    const hasAccessToken = Boolean(input.accessToken?.trim());
    const hasPhoneNumberId = Boolean(input.phoneNumberId?.trim());
    const hasWabaId = Boolean(input.wabaId?.trim());
    const hasPartialCloudConfiguration = Boolean(
      hasAccessToken || hasPhoneNumberId || hasWabaId,
    );
    const verifyTokenConfigured = Boolean(
      process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim(),
    );
    const canSendOfficialOutbound =
      hasPhoneNumber && hasAccessToken && hasPhoneNumberId;
    const canReceiveOfficialWebhook = hasPhoneNumber && hasPhoneNumberId;

    if (!hasPhoneNumber && !hasInstanceName) {
      return {
        connectionMode: 'configuration_incomplete',
        isOperational: false,
        supportsSimulator: false,
        canSendOfficialOutbound: false,
        canReceiveOfficialWebhook: false,
        verifyTokenConfigured,
      };
    }

    if (providerName === 'evolution' && hasInstanceName) {
      return {
        connectionMode: 'cloud_api',
        isOperational: true,
        supportsSimulator: true,
        canSendOfficialOutbound: true,
        canReceiveOfficialWebhook: true,
        verifyTokenConfigured,
      };
    }

    if (canSendOfficialOutbound) {
      return {
        connectionMode: 'cloud_api',
        isOperational: true,
        supportsSimulator: true,
        canSendOfficialOutbound: true,
        canReceiveOfficialWebhook,
        verifyTokenConfigured,
      };
    }

    if (hasPartialCloudConfiguration) {
      return {
        connectionMode: 'configuration_incomplete',
        isOperational: true,
        supportsSimulator: true,
        canSendOfficialOutbound: false,
        canReceiveOfficialWebhook,
        verifyTokenConfigured,
      };
    }

    return {
      connectionMode: 'local_demo',
      isOperational: true,
      supportsSimulator: true,
      canSendOfficialOutbound: false,
      canReceiveOfficialWebhook: false,
      verifyTokenConfigured,
    };
  }

  private extractCloudApiError(
    statusCode: number,
    responseBody: Record<string, unknown> | null,
  ): string {
    const error =
      responseBody && typeof responseBody.error === 'object'
        ? (responseBody.error as Record<string, unknown>)
        : null;
    const message =
      error && typeof error.message === 'string' ? error.message : null;
    const errorCode =
      error && typeof error.code === 'number'
        ? ` code ${error.code}`
        : error && typeof error.code === 'string'
          ? ` code ${error.code}`
          : '';

    if (message) {
      return `Cloud API respondeu com status ${statusCode}${errorCode}: ${message}`;
    }

    return `Cloud API respondeu com status ${statusCode}.`;
  }

  private extractCloudApiMessageId(
    responseBody: Record<string, unknown> | null,
  ): string | null {
    if (!responseBody) {
      return null;
    }

    if (typeof responseBody.message_id === 'string') {
      return responseBody.message_id;
    }

    const messages = responseBody.messages;
    if (!Array.isArray(messages)) {
      return null;
    }

    const firstMessage: unknown = messages[0];
    if (
      typeof firstMessage === 'object' &&
      firstMessage !== null &&
      typeof (firstMessage as { id?: unknown }).id === 'string'
    ) {
      return (firstMessage as { id: string }).id;
    }

    return null;
  }

  private mapAccount(
    account: {
      id: string;
      phoneNumber: string | null;
      phoneNumberId: string | null;
      wabaId: string | null;
      accessToken: string | null;
      status: WhatsAppStatus;
      provider?: string | null;
      instanceName?: string | null;
      pipeline?: {
        id: string;
        name: string;
      } | null;
      createdAt: Date;
      updatedAt: Date;
    } | null,
  ): WhatsAppAccountResponse | null {
    if (!account) {
      return null;
    }

    const operationalState = this.resolveOperationalState(account);

    return {
      id: account.id,
      phoneNumber: account.phoneNumber,
      phoneNumberId: account.phoneNumberId,
      wabaId: account.wabaId,
      status: account.status,
      provider: account.provider ?? 'meta_cloud',
      instanceName: account.instanceName ?? null,
      assignedPipelineId: account.pipeline?.id ?? null,
      assignedPipelineName: account.pipeline?.name ?? null,
      hasAccessToken: Boolean(account.accessToken),
      connectionMode: operationalState.connectionMode,
      isOperational: operationalState.isOperational,
      supportsSimulator: operationalState.supportsSimulator,
      canSendOfficialOutbound: operationalState.canSendOfficialOutbound,
      canReceiveOfficialWebhook: operationalState.canReceiveOfficialWebhook,
      verifyTokenConfigured: operationalState.verifyTokenConfigured,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private mapInboxMessage(
    message: WhatsAppMessage | null,
  ): InboxThreadMessage | null {
    if (!message) {
      return null;
    }

    return {
      id: message.id,
      content: message.content,
      direction: message.direction,
      status: message.status,
      createdAt: message.createdAt,
    };
  }

  private mapInboxConversation(
    conversation: {
      id: string;
      status: string;
      summary: string | null;
      lastMessageAt: Date | null;
      updatedAt: Date;
      agent: {
        id: string;
        name: string;
        isActive: boolean;
      };
      card: {
        id: string;
        title: string;
        updatedAt: Date;
        stage: {
          id: string;
          name: string;
          pipeline: {
            id: string;
            name: string;
          };
        };
      } | null;
    } | null,
  ): InboxThreadConversation | null {
    if (!conversation) {
      return null;
    }

    return {
      id: conversation.id,
      status: conversation.status,
      summary: conversation.summary,
      lastMessageAt: conversation.lastMessageAt,
      updatedAt: conversation.updatedAt,
      agent: conversation.agent,
      card: this.mapInboxCard(conversation.card),
    };
  }

  private mapInboxAgent(
    agent: {
      id: string;
      name: string;
      isActive: boolean;
    } | null,
  ): InboxThreadAgent | null {
    if (!agent) {
      return null;
    }

    return {
      id: agent.id,
      name: agent.name,
      isActive: agent.isActive,
    };
  }

  private resolveAssignedAgent(
    conversationAgent: {
      id: string;
      name: string;
      isActive: boolean;
    } | null,
    card: {
      stage?: unknown;
    } | null,
  ): InboxThreadAgent | null {
    const stage = card?.stage as
      | {
          agents?: Array<{
            id: string;
            name: string;
            isActive: boolean;
          }>;
        }
      | undefined;

    return this.mapInboxAgent(conversationAgent ?? stage?.agents?.[0] ?? null);
  }

  private mapInboxCard(
    card: {
      id: string;
      title: string;
      updatedAt: Date;
      stage: {
        id: string;
        name: string;
        pipeline: {
          id: string;
          name: string;
        };
      };
    } | null,
  ): InboxThreadCard | null {
    if (!card) {
      return null;
    }

    return {
      id: card.id,
      title: card.title,
      updatedAt: card.updatedAt,
      stage: card.stage,
    };
  }
}
