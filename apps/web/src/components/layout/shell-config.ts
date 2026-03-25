import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  Building2,
  KanbanSquare,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
  Wand2,
  Users,
  Workflow,
} from 'lucide-react';

export interface ShellNavChild {
  badge?: string;
  description: string;
  disabled?: boolean;
  href?: string;
  label: string;
}

export interface ShellNavItem {
  badge?: string;
  children?: ShellNavChild[];
  description: string;
  disabled?: boolean;
  href?: string;
  icon: LucideIcon;
  label: string;
}

export interface RouteMeta {
  eyebrow: string;
  title: string;
  description: string;
}

export const mainNavigation: ShellNavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Visao geral da operacao, sinais do pipeline e leitura rapida do workspace.',
  },
  {
    label: 'Inbox',
    href: '/inbox',
    icon: MessageSquare,
    description: 'Central de conversas e acompanhamento das interacoes do canal ativo.',
  },
  {
    label: 'Pipelines',
    href: '/pipelines',
    icon: KanbanSquare,
    description: 'Board operacional do funil, cards ativos e contexto da execucao comercial.',
  },
  {
    label: 'Clientes',
    icon: Users,
    description: 'Base comercial agrupando contatos, empresas e contexto relacional.',
    children: [
      {
        label: 'Contatos',
        href: '/contatos',
        description: 'Pessoas, decisores e historico comercial.',
      },
      {
        label: 'Empresas',
        href: '/empresas',
        description: 'Contas, segmentos e relacionamento por empresa.',
      },
      {
        label: 'Segmentos',
        href: '/segmentos',
        description: 'Leitura rápida de tags, cargos e indústrias que estruturam a base comercial.',
      },
    ],
  },
  {
    label: 'Agentes',
    icon: Bot,
    description: 'Agentes autonomos, templates e base de conhecimento do workspace.',
    children: [
      {
        label: 'Meus agentes',
        href: '/agentes',
        description: 'Criar, revisar e acompanhar agentes em operacao.',
      },
      {
        label: 'Templates e base',
        disabled: true,
        badge: 'No modulo',
        description: 'Templates basicos e bases de conhecimento sao geridos dentro de Meus agentes.',
      },
    ],
  },
  {
    label: 'Reguas',
    href: '/journeys',
    icon: Workflow,
    description: 'Reguas de nutricao, acionamentos e automacoes ligadas ao funil.',
  },
  {
    label: 'Campanhas',
    href: '/campanhas',
    icon: Megaphone,
    description: 'Audiencias dinamicas, campanhas e fundacao do outbound por workspace.',
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    disabled: true,
    badge: 'Planejado',
    description: 'Metricas de execucao, autonomia, funil e campanhas.',
  },
];

export const simpleNavigation: ShellNavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Visao rapida da operacao com cards, agentes e proximo passo.',
  },
  {
    label: 'Inbox',
    href: '/inbox',
    icon: MessageSquare,
    description: 'Conversas em andamento, takeover manual e retomada do piloto automatico.',
  },
  {
    label: 'Kanban',
    href: '/pipelines',
    icon: KanbanSquare,
    description: 'Board operacional com leitura objetiva do andamento por card.',
  },
  {
    label: 'Workers',
    href: '/workers',
    icon: Bot,
    description: 'Visao simples dos agentes por etapa, status e instrucao principal.',
  },
  {
    label: 'Campanhas',
    href: '/campanhas',
    icon: Megaphone,
    description: 'Lista de campanhas cadastradas para abrir, ajustar e excluir.',
  },
  {
    label: 'Wizard',
    href: '/wizard',
    icon: Wand2,
    description: 'Configura campanha, input, agentes e regua sem navegar pela estrutura avancada.',
  },
];

export const utilityNavigation: ShellNavChild[] = [
  {
    label: 'Formularios',
    href: '/formularios',
    description: 'Capte leads com embeds e links publicados.',
  },
  {
    label: 'Configuracoes',
    href: '/configuracoes',
    description: 'Canais, integracoes e parametros do workspace.',
  },
];

export const simpleUtilityNavigation: ShellNavChild[] = [];

export function isNavHrefActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isNavItemActive(pathname: string, item: ShellNavItem) {
  if (item.href && isNavHrefActive(pathname, item.href)) {
    return true;
  }

  return item.children?.some((child) => child.href && isNavHrefActive(pathname, child.href)) ?? false;
}

export function getRouteMeta(pathname: string): RouteMeta {
  if (pathname === '/') {
    return {
      eyebrow: 'DASHBOARD',
      title: 'Centro de operacao',
      description: 'Sinais do funil, backlog vivo e atalhos para os modulos principais.',
    };
  }

  if (pathname.startsWith('/contatos')) {
    return {
      eyebrow: 'CLIENTES',
      title: 'Contatos',
      description: 'Decisores, tags e historico comercial da base.',
    };
  }

  if (pathname.startsWith('/empresas')) {
    return {
      eyebrow: 'CLIENTES',
      title: 'Empresas',
      description: 'Contas, segmentos e oportunidades por empresa.',
    };
  }

  if (pathname.startsWith('/segmentos')) {
    return {
      eyebrow: 'CLIENTES',
      title: 'Segmentos',
      description: 'Tags, cargos e industrias que estruturam a base.',
    };
  }

  if (pathname.startsWith('/agentes')) {
    return {
      eyebrow: 'AGENTES',
      title: 'Agentes',
      description: 'Agentes, templates e base do workspace.',
    };
  }

  if (pathname.startsWith('/formularios')) {
    return {
      eyebrow: 'CAPTACAO',
      title: 'Formularios',
      description: 'Captação inbound por links, embeds e formulários publicados.',
    };
  }

  if (pathname.startsWith('/inbox')) {
    return {
      eyebrow: 'INBOX',
      title: 'Inbox',
      description: 'Conversas, takeover manual e operação viva do atendimento.',
    };
  }

  if (pathname.startsWith('/workers')) {
    return {
      eyebrow: 'WORKERS',
      title: 'Workers IA',
      description: 'Agentes ativos, etapas do funil e leitura simples do que cada worker executa.',
    };
  }

  if (pathname.startsWith('/campanhas')) {
    return {
      eyebrow: 'CAMPANHAS',
      title: 'Campanhas',
      description: 'Lista de campanhas do workspace, com acesso para revisar, editar e excluir.',
    };
  }

  if (pathname.startsWith('/wizard')) {
    return {
      eyebrow: 'WIZARD',
      title: 'Setup Guiado',
      description: 'Fluxo simplificado para montar campanha, input, agentes e regua do zero.',
    };
  }

  if (pathname.startsWith('/pipelines')) {
    return {
      eyebrow: 'PIPELINES',
      title: 'Pipelines',
      description: 'Board, cards e detalhe operacional das oportunidades.',
    };
  }

  if (pathname.startsWith('/whatsapp')) {
    return {
      eyebrow: 'CANAIS',
      title: 'WhatsApp',
      description: 'Conexão, webhook e infraestrutura do canal.',
    };
  }

  if (pathname.startsWith('/journeys/')) {
    return {
      eyebrow: 'REGUAS',
      title: 'Builder da regua',
      description: 'Canvas de gatilhos, delays, condições e ações.',
    };
  }

  if (pathname.startsWith('/journeys')) {
    return {
      eyebrow: 'REGUAS',
      title: 'Reguas',
      description: 'Automacoes, runtime e leitura operacional do funil.',
    };
  }

  if (pathname.startsWith('/campanhas')) {
    return {
      eyebrow: 'CAMPANHAS',
      title: 'Campanhas',
      description: 'Audiencias dinamicas, templates e fundacao do outbound por workspace.',
    };
  }

  if (pathname.startsWith('/configuracoes')) {
    return {
      eyebrow: 'SISTEMA',
      title: 'Configuracoes',
      description: 'Canais, integrações e parâmetros do workspace.',
    };
  }

  return {
    eyebrow: 'WORKSPACE',
    title: 'Saaso Revenue OS',
    description: 'Operação comercial com agentes, réguas e canais no mesmo shell.',
  };
}

export function getUtilityIcon(label: string): LucideIcon {
  if (label === 'Formularios') {
    return Megaphone;
  }

  if (label === 'Configuracoes') {
    return Settings;
  }

  return Building2;
}
