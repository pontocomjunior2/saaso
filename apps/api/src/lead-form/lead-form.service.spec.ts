import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeadFormService } from './lead-form.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LeadFormService', () => {
  let service: LeadFormService;
  let prismaService: any;

  beforeEach(() => {
    prismaService = {
      stage: {
        findFirst: jest.fn(),
      },
      leadForm: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      leadFormSubmission: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const journeyService = {} as any;
    service = new LeadFormService(prismaService as PrismaService, journeyService);
  });

  it('creates a form with normalized slug and fields', async () => {
    prismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
    prismaService.leadForm.findFirst.mockResolvedValueOnce(null);
    prismaService.leadForm.create.mockResolvedValue({
      id: 'form-1',
      name: 'Inbound Demo',
      slug: 'inbound-demo',
      headline: 'Fale com vendas',
      description: null,
      submitButtonLabel: 'Enviar',
      successTitle: null,
      successMessage: null,
      isActive: true,
      stageId: 'stage-1',
      tenantId: 'tenant-1',
      fields: [
        {
          id: 'full_name',
          key: 'full_name',
          label: 'Nome',
          type: 'text',
          required: true,
          mapTo: 'name',
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      stage: {
        id: 'stage-1',
        name: 'Entrada',
        pipeline: {
          id: 'pipeline-1',
          name: 'Inbound',
        },
      },
    });

    const result = await service.create('tenant-1', {
      name: 'Inbound Demo',
      headline: 'Fale com vendas',
      stageId: 'stage-1',
      fields: [
        {
          id: 'full_name',
          key: 'full_name',
          label: 'Nome',
          type: 'text',
          required: true,
          mapTo: 'name',
        },
      ],
    });

    expect(prismaService.leadForm.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slug: 'inbound-demo',
        }),
      }),
    );
    expect(result.slug).toBe('inbound-demo');
    expect(result.fields).toHaveLength(1);
  });

  it('rejects invalid public submissions when a required field is missing', async () => {
    prismaService.leadForm.findFirst.mockResolvedValue({
      id: 'form-1',
      name: 'Inbound Demo',
      slug: 'inbound-demo',
      headline: null,
      description: null,
      submitButtonLabel: 'Enviar',
      successTitle: null,
      successMessage: null,
      isActive: true,
      stageId: 'stage-1',
      fields: [
        {
          id: 'email',
          key: 'email',
          label: 'E-mail',
          type: 'email',
          required: true,
          mapTo: 'email',
        },
      ],
      tenant: {
        id: 'tenant-1',
        name: 'Saaso Demo',
        slug: 'saaso-demo',
      },
      stage: {
        id: 'stage-1',
        name: 'Entrada',
      },
    });

    await expect(
      service.submitPublicForm('saaso-demo', 'inbound-demo', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates company, contact, card and submission for a valid public form', async () => {
    prismaService.leadForm.findFirst.mockResolvedValue({
      id: 'form-1',
      name: 'Inbound Demo',
      slug: 'inbound-demo',
      headline: null,
      description: null,
      submitButtonLabel: 'Enviar',
      successTitle: null,
      successMessage: null,
      isActive: true,
      stageId: 'stage-1',
      fields: [
        {
          id: 'full_name',
          key: 'full_name',
          label: 'Nome',
          type: 'text',
          required: true,
          mapTo: 'name',
        },
        {
          id: 'email',
          key: 'email',
          label: 'E-mail',
          type: 'email',
          required: true,
          mapTo: 'email',
        },
        {
          id: 'company',
          key: 'company',
          label: 'Empresa',
          type: 'text',
          required: false,
          mapTo: 'companyName',
        },
      ],
      tenant: {
        id: 'tenant-1',
        name: 'Saaso Demo',
        slug: 'saaso-demo',
      },
      stage: {
        id: 'stage-1',
        name: 'Entrada',
      },
    });

    const tx = {
      company: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'company-1' }),
      },
      contact: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'contact-1', name: 'Ana' }),
      },
      card: {
        aggregate: jest.fn().mockResolvedValue({ _max: { position: 2 } }),
        create: jest.fn().mockResolvedValue({ id: 'card-1' }),
      },
      cardActivity: {
        create: jest.fn().mockResolvedValue({ id: 'activity-1' }),
      },
      leadFormSubmission: {
        create: jest.fn().mockResolvedValue({ id: 'submission-1' }),
      },
    };

    prismaService.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await service.submitPublicForm(
      'saaso-demo',
      'inbound-demo',
      {
        full_name: 'Ana',
        email: 'ana@example.com',
        company: 'Acme',
      },
    );

    expect(result.success).toBe(true);
    expect(tx.contact.create).toHaveBeenCalled();
    expect(tx.card.create).toHaveBeenCalled();
    expect(tx.leadFormSubmission.create).toHaveBeenCalled();
  });

  it('throws when public form does not exist', async () => {
    prismaService.leadForm.findFirst.mockResolvedValue(null);

    await expect(
      service.getPublicForm('saaso-demo', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns analytics for a form', async () => {
    prismaService.leadForm.findFirst.mockResolvedValue({
      id: 'form-1',
      name: 'Inbound Demo',
      slug: 'inbound-demo',
      headline: null,
      description: null,
      submitButtonLabel: 'Enviar',
      successTitle: null,
      successMessage: null,
      isActive: true,
      stageId: 'stage-1',
      tenantId: 'tenant-1',
      fields: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      stage: {
        id: 'stage-1',
        name: 'Entrada',
        pipeline: {
          id: 'pipeline-1',
          name: 'Inbound',
        },
      },
    });
    prismaService.leadFormSubmission.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(9);
    prismaService.leadFormSubmission.findMany.mockResolvedValue([
      {
        id: 'submission-1',
        createdAt: new Date('2026-03-16T12:00:00.000Z'),
        contact: {
          id: 'contact-1',
          name: 'Ana',
          email: 'ana@example.com',
          phone: '11999999999',
        },
        card: {
          id: 'card-1',
          title: 'Ana',
        },
      },
    ]);

    const result = await service.getAnalytics('tenant-1', 'form-1');

    expect(result).toEqual({
      formId: 'form-1',
      totalSubmissions: 12,
      submissionsLast7Days: 4,
      submissionsLast30Days: 9,
      latestSubmissionAt: new Date('2026-03-16T12:00:00.000Z'),
      recentSubmissions: [
        {
          id: 'submission-1',
          createdAt: new Date('2026-03-16T12:00:00.000Z'),
          contact: {
            id: 'contact-1',
            name: 'Ana',
            email: 'ana@example.com',
            phone: '11999999999',
          },
          card: {
            id: 'card-1',
            title: 'Ana',
          },
        },
      ],
    });
  });
});
