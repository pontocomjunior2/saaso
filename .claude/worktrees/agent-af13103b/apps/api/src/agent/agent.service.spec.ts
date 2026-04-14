import { Test, TestingModule } from '@nestjs/testing';
import { AgentService } from './agent.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AgentService', () => {
  let service: AgentService;
  let prismaService: {
    tenant: {
      findUnique: jest.Mock;
    };
    stage: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaService = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ name: 'Saaso Demo' }),
      },
      stage: {
        findFirst: jest.fn().mockResolvedValue({
          name: 'Qualificação',
          pipeline: {
            name: 'Vendas Inbound',
          },
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('builds a prompt preview with tenant and stage context', async () => {
    const preview = await service.previewPrompt('tenant-1', {
      name: 'Qualificador',
      stageId: 'stage-1',
      systemPrompt: 'Faça perguntas objetivas.',
      profile: {
        objective: 'Entender urgência e maturidade',
        tone: 'Consultivo',
      },
    });

    expect(preview.compiledPrompt).toContain('Saaso Demo');
    expect(preview.compiledPrompt).toContain('Vendas Inbound');
    expect(preview.compiledPrompt).toContain('Qualificação');
    expect(preview.compiledPrompt).toContain('Faça perguntas objetivas.');
  });
});
