import { Prisma, PrismaClient, UserRole, WhatsAppStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEFAULT_TENANT_FEATURE_FLAGS,
  toTenantFeatureFlagsJson,
} from '../src/tenant/tenant-feature-flags';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  const slug = 'saaso-demo';
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: {
      name: 'Saaso Demo',
      featureFlags: toTenantFeatureFlagsJson(DEFAULT_TENANT_FEATURE_FLAGS),
    },
    create: {
      name: 'Saaso Demo',
      slug,
      featureFlags: toTenantFeatureFlagsJson(DEFAULT_TENANT_FEATURE_FLAGS),
    },
  });

  const salt = await bcrypt.genSalt();
  const hashedPassword = await bcrypt.hash('admin123', salt);

  const admin = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'admin@saaso.com',
        tenantId: tenant.id,
      },
    },
    update: {
      name: 'Admin Demo',
      password: hashedPassword,
      role: UserRole.OWNER,
    },
    create: {
      name: 'Admin Demo',
      email: 'admin@saaso.com',
      password: hashedPassword,
      role: UserRole.OWNER,
      tenantId: tenant.id,
    },
  });

  const pipeline =
    (await prisma.pipeline.findFirst({
      where: {
        tenantId: tenant.id,
        name: 'Vendas Inbound',
      },
    })) ??
    (await prisma.pipeline.create({
      data: { name: 'Vendas Inbound', tenantId: tenant.id },
    }));

  const stageBlueprints = [
    { name: 'Lead', order: 1 },
    { name: 'Qualificação', order: 2 },
    { name: 'Proposta', order: 3 },
    { name: 'Ganho', order: 4 },
  ] as const;

  const stages = new Map<string, { id: string; name: string; order: number }>();

  for (const stageBlueprint of stageBlueprints) {
    const stage =
      (await prisma.stage.findFirst({
        where: {
          pipelineId: pipeline.id,
          name: stageBlueprint.name,
        },
      })) ??
      (await prisma.stage.create({
        data: {
          name: stageBlueprint.name,
          order: stageBlueprint.order,
          pipelineId: pipeline.id,
        },
      }));

    if (stage.order !== stageBlueprint.order) {
      await prisma.stage.update({
        where: { id: stage.id },
        data: { order: stageBlueprint.order },
      });
    }

    stages.set(stage.name, {
      id: stage.id,
      name: stage.name,
      order: stageBlueprint.order,
    });
  }

  const companies = await Promise.all([
    ensureCompany({
      tenantId: tenant.id,
      name: 'Aurora AI Studio',
      industry: 'Consultoria em IA',
      website: 'https://aurora-ai.example.com',
    }),
    ensureCompany({
      tenantId: tenant.id,
      name: 'Nexa Commerce',
      industry: 'E-commerce premium',
      website: 'https://nexa-commerce.example.com',
    }),
    ensureCompany({
      tenantId: tenant.id,
      name: 'Pulse Industrial',
      industry: 'Manufatura B2B',
      website: 'https://pulse-industrial.example.com',
    }),
  ]);

  const contacts = await Promise.all([
    ensureContact({
      tenantId: tenant.id,
      companyId: companies[0].id,
      name: 'Marina Costa',
      email: 'marina@aurora-ai.example.com',
      phone: '+55 11 99888-1122',
      position: 'Head de Revenue',
      tags: ['vip', 'inbound'],
    }),
    ensureContact({
      tenantId: tenant.id,
      companyId: companies[1].id,
      name: 'Diego Ramos',
      email: 'diego@nexa-commerce.example.com',
      phone: '+55 21 98877-5544',
      position: 'Diretor Comercial',
      tags: ['whatsapp', 'expansao'],
    }),
    ensureContact({
      tenantId: tenant.id,
      companyId: companies[2].id,
      name: 'Patricia Lima',
      email: 'patricia@pulse-industrial.example.com',
      phone: '+55 31 97766-4433',
      position: 'COO',
      tags: ['enterprise'],
    }),
  ]);

  await Promise.all([
    ensureCard({
      tenantId: tenant.id,
      stageId: stages.get('Lead')!.id,
      title: 'Diagnóstico comercial para Aurora AI Studio',
      position: 0,
      contactId: contacts[0].id,
      assigneeId: admin.id,
    }),
    ensureCard({
      tenantId: tenant.id,
      stageId: stages.get('Qualificação')!.id,
      title: 'Mapear objeções da Nexa Commerce',
      position: 0,
      contactId: contacts[1].id,
      assigneeId: admin.id,
    }),
    ensureCard({
      tenantId: tenant.id,
      stageId: stages.get('Proposta')!.id,
      title: 'Proposta enterprise para Pulse Industrial',
      position: 0,
      contactId: contacts[2].id,
      assigneeId: admin.id,
    }),
    ensureCard({
      tenantId: tenant.id,
      stageId: stages.get('Ganho')!.id,
      title: 'Renovação anual da conta Aurora',
      position: 0,
      contactId: contacts[0].id,
      assigneeId: admin.id,
    }),
  ]);

  await ensureAgent({
    tenantId: tenant.id,
    stageId: stages.get('Qualificação')!.id,
    name: 'Qualificador Conversacional',
    systemPrompt:
      'Você atua como SDR digital premium. Qualifique leads pelo WhatsApp, identifique orçamento, urgência e maturidade e entregue um resumo objetivo para o time comercial.',
    profile: {
      persona: 'SDR consultivo com postura executiva',
      objective:
        'Descobrir fit, urgência e potencial de avanço antes da reunião comercial.',
      tone: 'Consultivo, direto e cordial',
      language: 'Português do Brasil',
      businessContext:
        'A Saaso vende um CRM com agentes de IA para operação comercial no WhatsApp e em pipelines visuais.',
      targetAudience:
        'Gestores comerciais, founders e líderes de receita em empresas B2B.',
      valueProposition:
        'Reduzir follow-up manual e transformar atendimento comercial em operação contínua com IA.',
      responseLength: 'Curta a média, sempre orientada a próxima ação',
      qualificationChecklist: [
        'Entender tamanho do time comercial',
        'Mapear canal principal de entrada dos leads',
        'Confirmar urgência de implementação',
      ],
      handoffTriggers: [
        'Pedido explícito para falar com humano',
        'Discussão de proposta comercial ou negociação avançada',
        'Bloqueio por segurança, compliance ou objeção sensível',
      ],
      guardrails: [
        'Não inventar integração inexistente',
        'Não prometer preço sem contexto',
        'Não insistir quando o lead pedir pausa',
      ],
      callToAction:
        'Conduzir para diagnóstico comercial com especialista da equipe.',
      customInstructions:
        'Se perceber urgência alta, priorize agenda. Se o lead estiver frio, faça até duas perguntas antes de tentar marcar reunião.',
      model: 'gpt-4o-mini',
      temperature: 0.4,
      maxTokens: 450,
    },
  });

  await ensureJourney({
    tenantId: tenant.id,
    name: 'Reativação de Leads Quentes',
    isActive: true,
    nodes: [
      {
        id: 'trigger_whatsapp',
        position: { x: 120, y: 120 },
        data: { label: 'Trigger: nova mensagem WhatsApp' },
        type: 'default',
      },
      {
        id: 'agent_followup',
        position: { x: 420, y: 120 },
        data: { label: 'Ação: agente responde e qualifica' },
        type: 'default',
      },
      {
        id: 'move_stage',
        position: { x: 720, y: 120 },
        data: { label: 'Ação: mover para Qualificação' },
        type: 'default',
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger_whatsapp', target: 'agent_followup' },
      { id: 'e2', source: 'agent_followup', target: 'move_stage' },
    ],
  });

  const existingWhatsAppAccount = await prisma.whatsAppAccount.findFirst({
    where: { tenantId: tenant.id },
  });

  if (existingWhatsAppAccount) {
    await prisma.whatsAppAccount.update({
      where: { id: existingWhatsAppAccount.id },
      data: {
        phoneNumber: '5511999999999',
        status: WhatsAppStatus.CONNECTED,
        accessToken: 'demo-token',
      },
    });
  } else {
    await prisma.whatsAppAccount.create({
      data: {
        tenantId: tenant.id,
        phoneNumber: '5511999999999',
        status: WhatsAppStatus.CONNECTED,
        accessToken: 'demo-token',
      },
    });
  }

  console.log('Seed concluído com sucesso!');
  console.log(`Tenant: ${tenant.slug}`);
  console.log(`Admin email: ${admin.email}`);
}

async function ensureCompany(input: {
  tenantId: string;
  name: string;
  industry: string;
  website: string;
}) {
  const existing = await prisma.company.findFirst({
    where: {
      tenantId: input.tenantId,
      name: input.name,
    },
  });

  if (existing) {
    return prisma.company.update({
      where: { id: existing.id },
      data: {
        industry: input.industry,
        website: input.website,
      },
    });
  }

  return prisma.company.create({
    data: input,
  });
}

async function ensureContact(input: {
  tenantId: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  tags: string[];
}) {
  const existing = await prisma.contact.findFirst({
    where: {
      tenantId: input.tenantId,
      email: input.email,
    },
  });

  if (existing) {
    return prisma.contact.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        phone: input.phone,
        position: input.position,
        companyId: input.companyId,
        tags: input.tags,
      },
    });
  }

  return prisma.contact.create({
    data: input,
  });
}

async function ensureCard(input: {
  tenantId: string;
  stageId: string;
  title: string;
  position: number;
  contactId: string;
  assigneeId: string;
}) {
  const existing = await prisma.card.findFirst({
    where: {
      tenantId: input.tenantId,
      title: input.title,
    },
  });

  if (existing) {
    return prisma.card.update({
      where: { id: existing.id },
      data: {
        stageId: input.stageId,
        position: input.position,
        contactId: input.contactId,
        assigneeId: input.assigneeId,
      },
    });
  }

  return prisma.card.create({
    data: {
      ...input,
      customFields: {
        source: 'demo-seed',
      },
    },
  });
}

async function ensureAgent(input: {
  tenantId: string;
  stageId: string;
  name: string;
  systemPrompt: string;
  profile: Prisma.InputJsonValue;
}) {
  const existing = await prisma.agent.findFirst({
    where: {
      tenantId: input.tenantId,
      name: input.name,
    },
  });

  if (existing) {
    return prisma.agent.update({
      where: { id: existing.id },
      data: {
        stageId: input.stageId,
        systemPrompt: input.systemPrompt,
        profile: input.profile,
        isActive: true,
      },
    });
  }

  return prisma.agent.create({
    data: {
      ...input,
      isActive: true,
    },
  });
}

async function ensureJourney(input: {
  tenantId: string;
  name: string;
  isActive: boolean;
  nodes: Prisma.InputJsonValue;
  edges: Prisma.InputJsonValue;
}) {
  const existing = await prisma.journey.findFirst({
    where: {
      tenantId: input.tenantId,
      name: input.name,
    },
  });

  if (existing) {
    return prisma.journey.update({
      where: { id: existing.id },
      data: {
        isActive: input.isActive,
        nodes: input.nodes,
        edges: input.edges,
      },
    });
  }

  return prisma.journey.create({
    data: input,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
