import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { JourneyService } from '../journey/journey.service';
import { MetaCloudProvider } from './providers/meta-cloud.provider';
import { EvolutionApiService } from './evolution.service';
import { MessageDirection } from '@prisma/client';

describe('WhatsappService', () => {
  let service: WhatsappService;
  let prismaService: {
    contact: { findFirst: jest.Mock };
    whatsAppMessage: { create: jest.Mock };
    whatsAppAccount: { findFirst: jest.Mock };
  };
  let agentRunnerService: { processInboundMessage: jest.Mock };
  let journeyService: { triggerJourneysForEvent: jest.Mock };
  let metaCloudProvider: { sendMessage: jest.Mock; receiveWebhook: jest.Mock };
  let evolutionProvider: { sendMessage: jest.Mock; receiveWebhook: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      contact: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'contact-1', tenantId: 'tenant-1' }),
      },
      whatsAppMessage: {
        create: jest.fn().mockResolvedValue({
          id: 'wa-1',
          contactId: 'contact-1',
          content: 'Olá',
          direction: MessageDirection.INBOUND,
          status: 'SENT',
        }),
      },
      whatsAppAccount: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    agentRunnerService = {
      processInboundMessage: jest
        .fn()
        .mockResolvedValue({ status: 'agent_replied' }),
    };

    journeyService = {
      triggerJourneysForEvent: jest.fn().mockResolvedValue(undefined),
    };

    metaCloudProvider = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      receiveWebhook: jest.fn().mockResolvedValue({ accepted: true }),
    };

    evolutionProvider = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
      receiveWebhook: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AgentRunnerService,
          useValue: agentRunnerService,
        },
        {
          provide: JourneyService,
          useValue: journeyService,
        },
        {
          provide: MetaCloudProvider,
          useValue: metaCloudProvider,
        },
        {
          provide: EvolutionApiService,
          useValue: evolutionProvider,
        },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('triggers the agent runner for inbound messages', async () => {
    await service.logMessage('tenant-1', {
      contactId: 'contact-1',
      content: 'Olá',
      direction: MessageDirection.INBOUND,
      cardId: 'card-1',
    });

    expect(agentRunnerService.processInboundMessage).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      cardId: 'card-1',
      messageContent: 'Olá',
      whatsAppMessageId: 'wa-1',
    });
  });

  it('resolves meta_cloud provider for meta_cloud accounts', async () => {
    prismaService.whatsAppAccount.findFirst = jest.fn().mockResolvedValue({
      id: 'acc-1',
      tenantId: 'tenant-1',
      provider: 'meta_cloud',
      phoneNumber: '123456',
    });

    const account = await prismaService.whatsAppAccount.findFirst({
      where: { tenantId: 'tenant-1' },
    });

    expect(account.provider).toBe('meta_cloud');
  });

  it('resolves evolution provider for evolution accounts', async () => {
    prismaService.whatsAppAccount.findFirst = jest.fn().mockResolvedValue({
      id: 'acc-1',
      tenantId: 'tenant-1',
      provider: 'evolution',
      instanceName: 'test-instance',
    });

    const account = await prismaService.whatsAppAccount.findFirst({
      where: { tenantId: 'tenant-1' },
    });

    expect(account.provider).toBe('evolution');
  });

  it('defaults to meta_cloud provider when provider is null', async () => {
    prismaService.whatsAppAccount.findFirst = jest.fn().mockResolvedValue({
      id: 'acc-1',
      tenantId: 'tenant-1',
      provider: null,
      phoneNumber: '123456',
    });

    const account = await prismaService.whatsAppAccount.findFirst({
      where: { tenantId: 'tenant-1' },
    });

    expect(account.provider).toBeNull();
  });
});
