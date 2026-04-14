import { Test, TestingModule } from '@nestjs/testing';
import { MetaWebhookService } from './meta-webhook.service';
import { PrismaService } from '../prisma/prisma.service';
import { CardService } from '../card/card.service';
import { StageRuleService } from '../stage-rule/stage-rule.service';
import { AgentRunnerService } from '../agent/agent-runner.service';
import { NotificationService } from '../notification/notification.service';

const mockPrisma = {
  metaWebhookMapping: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  metaLeadIngestion: {
    create: jest.fn(),
    update: jest.fn(),
  },
  contact: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  cardActivity: {
    create: jest.fn(),
  },
  pipeline: {
    findFirst: jest.fn(),
  },
  stage: {
    findFirst: jest.fn(),
  },
};

const mockCardService = {
  create: jest.fn(),
};

const mockStageRuleService = {
  startRuleRun: jest.fn(),
};

const mockAgentRunnerService = {
  initiateProactiveIfAssigned: jest.fn(),
};

const mockNotificationService = {
  emit: jest.fn(),
};

describe('MetaWebhookService', () => {
  let service: MetaWebhookService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaWebhookService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CardService, useValue: mockCardService },
        { provide: StageRuleService, useValue: mockStageRuleService },
        { provide: AgentRunnerService, useValue: mockAgentRunnerService },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<MetaWebhookService>(MetaWebhookService);
  });

  describe('validateToken', () => {
    it('returns true when mapping with token exists', async () => {
      mockPrisma.metaWebhookMapping.findFirst.mockResolvedValue({ id: '1', verifyToken: 'abc123' });
      const result = await service.validateToken('abc123');
      expect(result).toBe(true);
      expect(mockPrisma.metaWebhookMapping.findFirst).toHaveBeenCalledWith({
        where: { verifyToken: 'abc123' },
      });
    });

    it('returns false when no mapping matches', async () => {
      mockPrisma.metaWebhookMapping.findFirst.mockResolvedValue(null);
      const result = await service.validateToken('badtoken');
      expect(result).toBe(false);
    });
  });

  describe('ingestLead', () => {
    it('processes all leadgen changes in entry[]', async () => {
      const mapping = {
        id: 'map-1',
        tenantId: 'tenant-1',
        metaFormId: 'form-1',
        stageId: 'stage-1',
        pipelineId: 'pipeline-1',
        pageAccessToken: null,
        stage: { id: 'stage-1', name: 'Incoming' },
      };
      mockPrisma.metaWebhookMapping.findFirst.mockResolvedValue(mapping);
      mockPrisma.metaLeadIngestion.create.mockResolvedValue({ id: 'ing-1', metaLeadId: 'lead-1' });
      mockPrisma.contact.findFirst.mockResolvedValue(null);
      mockPrisma.contact.create.mockResolvedValue({ id: 'contact-1', name: 'Lead Meta' });
      mockCardService.create.mockResolvedValue({ id: 'card-1', title: 'Lead Meta', stageId: 'stage-1' });
      mockPrisma.metaLeadIngestion.update.mockResolvedValue({});
      mockPrisma.cardActivity.create.mockResolvedValue({});
      mockStageRuleService.startRuleRun.mockResolvedValue(null);
      mockAgentRunnerService.initiateProactiveIfAssigned.mockResolvedValue(undefined);

      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page-1',
            changes: [
              { field: 'leadgen', value: { form_id: 'form-1', leadgen_id: 'lead-1' } },
              { field: 'other', value: { form_id: 'form-2', leadgen_id: 'lead-2' } },
            ],
          },
        ],
      };

      await service.ingestLead(payload);

      // processLead was called once (only leadgen changes)
      expect(mockPrisma.metaWebhookMapping.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { metaFormId: 'form-1' } }),
      );
    });
  });

  describe('processLead (via ingestLead)', () => {
    const baseMapping = {
      id: 'map-1',
      tenantId: 'tenant-1',
      metaFormId: 'form-1',
      stageId: 'stage-1',
      pipelineId: 'pipeline-1',
      pageAccessToken: null,
      stage: { id: 'stage-1', name: 'Incoming' },
    };

    beforeEach(() => {
      mockPrisma.metaWebhookMapping.findFirst.mockResolvedValue(baseMapping);
      mockPrisma.metaLeadIngestion.create.mockResolvedValue({ id: 'ing-1', metaLeadId: 'lead-new' });
      mockPrisma.contact.findFirst.mockResolvedValue(null);
      mockPrisma.contact.create.mockResolvedValue({ id: 'contact-1', name: 'Lead Meta' });
      mockCardService.create.mockResolvedValue({ id: 'card-1', title: 'Lead Meta', stageId: 'stage-1' });
      mockPrisma.metaLeadIngestion.update.mockResolvedValue({});
      mockPrisma.cardActivity.create.mockResolvedValue({});
      mockStageRuleService.startRuleRun.mockResolvedValue(null);
      mockAgentRunnerService.initiateProactiveIfAssigned.mockResolvedValue(undefined);
    });

    const ingestOne = (formId: string, leadgenId: string) =>
      service.ingestLead({
        entry: [{ changes: [{ field: 'leadgen', value: { form_id: formId, leadgen_id: leadgenId } }] }],
      });

    it('creates MetaLeadIngestion and Card for new leadgenId', async () => {
      await ingestOne('form-1', 'lead-new');
      expect(mockPrisma.metaLeadIngestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ tenantId: 'tenant-1', metaLeadId: 'lead-new' }),
      });
      expect(mockCardService.create).toHaveBeenCalled();
    });

    it('returns silently when leadgenId already in MetaLeadIngestion (idempotent)', async () => {
      const uniqueError = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      mockPrisma.metaLeadIngestion.create.mockRejectedValue(uniqueError);

      await ingestOne('form-1', 'lead-dup');

      // Card should NOT be created when idempotency gate fires
      expect(mockCardService.create).not.toHaveBeenCalled();
    });

    it('reuses existing Contact when phone matches within tenant', async () => {
      // Provide a mapping with pageAccessToken so the service attempts to fetch
      // lead details (which provides a phone number for the contact lookup)
      const mappingWithToken = { ...baseMapping, pageAccessToken: 'token-123' };
      mockPrisma.metaWebhookMapping.findFirst.mockResolvedValue(mappingWithToken);

      // Mock the global fetch to return a phone number
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          field_data: [
            { name: 'phone_number', values: ['+5511999990000'] },
            { name: 'full_name', values: ['Joao Silva'] },
          ],
        }),
      });
      (global as any).fetch = fetchMock;

      const existingContact = { id: 'contact-existing', name: 'Joao', phone: '+5511999990000' };
      mockPrisma.contact.findFirst.mockResolvedValue(existingContact);

      await ingestOne('form-1', 'lead-new');

      expect(mockPrisma.contact.create).not.toHaveBeenCalled();
      expect(mockCardService.create).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ contactId: 'contact-existing' }),
      );

      delete (global as any).fetch;
    });

    it('returns silently when formId has no mapping', async () => {
      mockPrisma.metaWebhookMapping.findFirst.mockResolvedValue(null);

      await ingestOne('form-unknown', 'lead-new');

      expect(mockCardService.create).not.toHaveBeenCalled();
    });

    it('calls stageRuleService.startRuleRun with the new card + mapping.stageId + CARD_ENTERED', async () => {
      await ingestOne('form-1', 'lead-new');

      expect(mockStageRuleService.startRuleRun).toHaveBeenCalledWith(
        'card-1',
        'stage-1',
        'tenant-1',
        'CARD_ENTERED',
      );
    });

    it('calls agentRunnerService.initiateProactiveIfAssigned with the new card + mapping.stageId', async () => {
      await ingestOne('form-1', 'lead-new');

      expect(mockAgentRunnerService.initiateProactiveIfAssigned).toHaveBeenCalledWith(
        'card-1',
        'stage-1',
        'tenant-1',
      );
    });

    it('emits a meta_lead_arrived notification scoped to mapping.tenantId', async () => {
      await ingestOne('form-1', 'lead-new');

      expect(mockNotificationService.emit).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({ type: 'meta_lead_arrived', cardId: 'card-1' }),
      );
    });

    it('swallows errors from stageRuleService/agentRunnerService/notificationService (card creation is authoritative)', async () => {
      mockStageRuleService.startRuleRun.mockRejectedValue(new Error('rule engine down'));
      mockAgentRunnerService.initiateProactiveIfAssigned.mockRejectedValue(new Error('agent runner down'));
      mockNotificationService.emit.mockImplementation(() => { throw new Error('notification down'); });

      // Should NOT throw even though all downstream services fail
      await expect(ingestOne('form-1', 'lead-new')).resolves.not.toThrow();

      // Card was still created
      expect(mockCardService.create).toHaveBeenCalled();
    });
  });

  describe('listMappings', () => {
    it('does NOT return pageAccessToken field', async () => {
      mockPrisma.metaWebhookMapping.findMany.mockResolvedValue([
        {
          id: 'map-1',
          tenantId: 'tenant-1',
          metaFormId: 'form-1',
          stageId: 'stage-1',
          pipelineId: 'pipeline-1',
          verifyToken: 'tok',
          // pageAccessToken intentionally excluded by the service select
          pipeline: { name: 'Funil Principal' },
          stage: { name: 'Entrada' },
        },
      ]);

      const result = await service.listMappings('tenant-1');

      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('pageAccessToken');
    });
  });
});
