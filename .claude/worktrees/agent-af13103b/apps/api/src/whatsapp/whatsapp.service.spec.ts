import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { MessageDirection } from '@prisma/client';

describe('WhatsappService', () => {
  let service: WhatsappService;
  let prismaService: {
    contact: { findFirst: jest.Mock };
    whatsAppMessage: { create: jest.Mock };
  };
  let agentRunnerService: { processInboundMessage: jest.Mock };

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
    };

    agentRunnerService = {
      processInboundMessage: jest
        .fn()
        .mockResolvedValue({ status: 'agent_replied' }),
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
});
