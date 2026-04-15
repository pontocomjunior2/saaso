import { ConfigService } from '@nestjs/config';
import { EvolutionApiService } from './evolution.service';

describe('EvolutionApiService', () => {
  it('routes inbound webhook messages through whatsapp service unified inbound flow', async () => {
    const configService = {
      get: jest.fn().mockReturnValue(''),
    };
    const agentRunner = {
      processInboundMessage: jest.fn(),
    };
    const prisma = {
      whatsAppAccount: {
        findFirst: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
      },
    };
    const whatsappService = {
      receiveProviderInboundMessage: jest.fn().mockResolvedValue(undefined),
    };

    const service = new (EvolutionApiService as any)(
      configService as ConfigService,
      prisma,
      whatsappService,
      agentRunner,
    ) as EvolutionApiService;

    await service.receiveWebhook({
      instance: 'instance-1',
      pushName: 'Maria',
      key: {
        remoteJid: '5511999999999@s.whatsapp.net',
      },
      message: {
        conversation: 'Olá do Evolution',
      },
    });

    expect(whatsappService.receiveProviderInboundMessage).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      fromPhoneNumber: '5511999999999@s.whatsapp.net',
      contactName: 'Maria',
      message: 'Olá do Evolution',
      source: 'webhook',
    });
    expect(agentRunner.processInboundMessage).not.toHaveBeenCalled();
  });
});
