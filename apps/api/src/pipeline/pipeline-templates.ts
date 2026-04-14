export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  stages: Array<{
    name: string;
    order: number;
    messageTemplates: Array<{
      name: string;
      channel: 'WHATSAPP' | 'EMAIL';
      subject?: string;
      body: string;
    }>;
  }>;
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'funil-simples',
    name: 'Funil Simples',
    description: 'Negocios diretos, prestadores de servico, pequenos times',
    stages: [
      {
        name: 'Novo Lead',
        order: 1,
        messageTemplates: [
          {
            name: 'Boas-vindas',
            channel: 'WHATSAPP',
            body: 'Ola {{nome}}! Recebemos seu contato e estamos prontos para ajudar. Como posso te atender hoje?',
          },
          {
            name: 'Follow-up D+1',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}, tudo bem? Queria saber se voce conseguiu avaliar nossa proposta. Estou a disposicao!',
          },
          {
            name: 'Follow-up D+3',
            channel: 'WHATSAPP',
            body: '{{nome}}, estou passando aqui para ver se posso ajudar com alguma duvida. Nossos clientes costumam ter resultados rapidos!',
          },
        ],
      },
      {
        name: 'Em Contato',
        order: 2,
        messageTemplates: [
          {
            name: 'Proposta enviada',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}! Acabei de enviar a proposta para o seu email {{email}}. Qualquer duvida estou aqui!',
          },
          {
            name: 'Proposta por email',
            channel: 'EMAIL',
            subject: 'Proposta comercial — {{nome}}',
            body: 'Ola {{nome}},\n\nConforme conversamos, segue a proposta comercial para sua avaliacao.\n\nFico a disposicao para esclarecer qualquer duvida.\n\nAte logo!',
          },
        ],
      },
      {
        name: 'Proposta Enviada',
        order: 3,
        messageTemplates: [
          {
            name: 'Acompanhamento de proposta',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}, tudo certo? Gostaria de saber se voce teve a oportunidade de avaliar a proposta que enviei. Posso esclarecer algo?',
          },
          {
            name: 'Follow-up proposta D+2',
            channel: 'EMAIL',
            subject: 'Duvidas sobre a proposta?',
            body: 'Ola {{nome}},\n\nPassando para ver se surgiu alguma duvida em relacao a proposta enviada.\n\nEstou a disposicao para conversar!\n\nAbracos.',
          },
        ],
      },
      {
        name: 'Fechado',
        order: 4,
        messageTemplates: [
          {
            name: 'Confirmacao de fechamento',
            channel: 'WHATSAPP',
            body: 'Parabens {{nome}}! Estamos muito felizes em ter voce como cliente. Em breve entraremos em contato com os proximos passos.',
          },
        ],
      },
    ],
  },
  {
    id: 'funil-comercial-medio',
    name: 'Funil Comercial Medio',
    description: 'Times comerciais B2B com ciclo de venda medio (15-60 dias)',
    stages: [
      {
        name: 'Prospeccao',
        order: 1,
        messageTemplates: [
          {
            name: 'Primeiro contato',
            channel: 'WHATSAPP',
            body: 'Ola {{nome}}! Sou da equipe comercial e gostaria de apresentar nossa solucao para {{empresa}}. Teria 15 minutos essa semana?',
          },
          {
            name: 'Email de prospeccao',
            channel: 'EMAIL',
            subject: 'Solucao para {{empresa}} — Vale 15 minutos?',
            body: 'Ola {{nome}},\n\nIdentifiquei que a {{empresa}} pode se beneficiar da nossa solucao.\n\nTeria 15 minutos esta semana para uma conversa rapida?\n\nAguardo seu retorno.',
          },
        ],
      },
      {
        name: 'Qualificacao',
        order: 2,
        messageTemplates: [
          {
            name: 'Agendamento de reuniao',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}! Para melhor entender as necessidades da {{empresa}}, podemos marcar uma reuniao de 30 minutos? Qual o melhor horario para voce?',
          },
          {
            name: 'Convite para reuniao',
            channel: 'EMAIL',
            subject: 'Reuniao de qualificacao — {{empresa}}',
            body: 'Ola {{nome}},\n\nGostaria de agendar uma reuniao para entender melhor as necessidades da {{empresa}} e apresentar como podemos ajudar.\n\nQuais horarios funcionam para voce esta semana?\n\nAguardo!',
          },
        ],
      },
      {
        name: 'Apresentacao',
        order: 3,
        messageTemplates: [
          {
            name: 'Confirmacao de reuniao',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}, confirmando nossa reuniao de apresentacao. Preparei um material especifico para a {{empresa}}. Ate logo!',
          },
          {
            name: 'Material pos-apresentacao',
            channel: 'EMAIL',
            subject: 'Material da apresentacao — {{empresa}}',
            body: 'Ola {{nome}},\n\nFoi um prazer apresentar nossa solucao para a {{empresa}}!\n\nSegue em anexo o material da apresentacao e o nosso deck comercial.\n\nFico a disposicao para proximos passos.',
          },
        ],
      },
      {
        name: 'Proposta',
        order: 4,
        messageTemplates: [
          {
            name: 'Envio de proposta',
            channel: 'WHATSAPP',
            body: 'Ola {{nome}}! Acabei de enviar a proposta comercial para {{empresa}} no seu email. Qualquer ajuste ou duvida, e so falar!',
          },
          {
            name: 'Proposta formal',
            channel: 'EMAIL',
            subject: 'Proposta Comercial — {{empresa}}',
            body: 'Ola {{nome}},\n\nSegue a proposta comercial elaborada especialmente para a {{empresa}}.\n\nTenho certeza que encontraremos o formato ideal para nossa parceria.\n\nAguardo seu feedback!',
          },
        ],
      },
      {
        name: 'Negociacao',
        order: 5,
        messageTemplates: [
          {
            name: 'Acompanhamento de negociacao',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}, como esta indo a avaliacao da proposta? Posso ajustar algo para facilitar a decisao da {{empresa}}?',
          },
          {
            name: 'Follow-up de negociacao',
            channel: 'EMAIL',
            subject: 'Atualizacao da proposta — {{empresa}}',
            body: 'Ola {{nome}},\n\nPassando para verificar se ha algum ponto da proposta que podemos ajustar ou complementar.\n\nEstamos abertos para negociar o melhor formato para a {{empresa}}.',
          },
        ],
      },
      {
        name: 'Fechado',
        order: 6,
        messageTemplates: [
          {
            name: 'Confirmacao de contrato',
            channel: 'WHATSAPP',
            body: 'Excelente noticia, {{nome}}! Contrato assinado, parceria firmada. Vamos agendar o onboarding da {{empresa}}?',
          },
          {
            name: 'Boas-vindas pos-venda',
            channel: 'EMAIL',
            subject: 'Bem-vindo(a) a bordo, {{nome}}!',
            body: 'Ola {{nome}},\n\nMuito obrigado pela confianca! A {{empresa}} agora faz parte da nossa familia de clientes.\n\nVou colocar voce em contato com nosso time de implantacao para iniciar o onboarding.\n\nSeja bem-vindo(a)!',
          },
        ],
      },
    ],
  },
  {
    id: 'funil-saas-completo',
    name: 'Funil SaaS Completo',
    description: 'Produto SaaS com trial, demos e onboarding estruturado',
    stages: [
      {
        name: 'Lead Captado',
        order: 1,
        messageTemplates: [
          {
            name: 'Boas-vindas trial',
            channel: 'EMAIL',
            subject: 'Seu trial esta pronto, {{nome}}!',
            body: 'Ola {{nome}},\n\nSeu periodo de teste ja esta ativo!\n\nAcesse agora e comece a explorar. Nosso time de sucesso esta disponivel para te ajudar a extrair o maximo da plataforma.\n\nBem-vindo(a)!',
          },
          {
            name: 'Boas-vindas whatsapp',
            channel: 'WHATSAPP',
            body: 'Ola {{nome}}! Seu trial esta ativo. Precisa de ajuda para dar os primeiros passos? Estou aqui!',
          },
        ],
      },
      {
        name: 'Trial Ativo',
        order: 2,
        messageTemplates: [
          {
            name: 'Engajamento D+2',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}, como esta indo o trial? Ja explorou as funcionalidades principais? Se quiser, posso te guiar por um tour rapido!',
          },
          {
            name: 'Dicas de uso',
            channel: 'EMAIL',
            subject: 'Dicas para aproveitar melhor seu trial',
            body: 'Ola {{nome}},\n\nVoce esta no caminho certo! Aqui vao algumas dicas para aproveitar ao maximo seu periodo de teste:\n\n1. Configure seu primeiro fluxo\n2. Importe seus contatos\n3. Ative as integracoes principais\n\nQualquer duvida, estamos aqui!',
          },
        ],
      },
      {
        name: 'Demo Agendada',
        order: 3,
        messageTemplates: [
          {
            name: 'Confirmacao de demo',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}, confirmando nossa demo para amanha! Prepare suas duvidas — vamos mostrar tudo que a plataforma pode fazer pela sua operacao.',
          },
          {
            name: 'Lembrete de demo',
            channel: 'EMAIL',
            subject: 'Lembrete: sua demo esta chegando, {{nome}}!',
            body: 'Ola {{nome}},\n\nSo um lembrete da nossa demo agendada para amanha.\n\nPreparei um roteiro baseado no perfil de uso da sua conta para mostrar o que mais importa para voce.\n\nAte logo!',
          },
        ],
      },
      {
        name: 'Proposta Enviada',
        order: 4,
        messageTemplates: [
          {
            name: 'Envio de proposta',
            channel: 'EMAIL',
            subject: 'Proposta personalizada para {{nome}}',
            body: 'Ola {{nome}},\n\nBaseado no que conversamos na demo, preparei uma proposta que faz sentido para o seu cenario.\n\nQualquer ajuste necessario, e so falar!\n\nAguardo seu retorno.',
          },
          {
            name: 'Follow-up proposta',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}, enviou a proposta por email. Teve a chance de avaliar? Alguma duvida que eu possa esclarecer?',
          },
        ],
      },
      {
        name: 'Convertido',
        order: 5,
        messageTemplates: [
          {
            name: 'Confirmacao de assinatura',
            channel: 'WHATSAPP',
            body: 'Incrivel, {{nome}}! Voce e agora um cliente oficial. Vou te conectar com nosso time de onboarding para comecar com o pe direito!',
          },
          {
            name: 'Email de boas-vindas cliente',
            channel: 'EMAIL',
            subject: 'Voce e nosso novo cliente, {{nome}}!',
            body: 'Ola {{nome}},\n\nParabens pela decisao! Voce agora tem acesso completo a plataforma.\n\nNosso Gerente de Sucesso do Cliente vai entrar em contato em breve para iniciar o onboarding.\n\nSeja bem-vindo(a) de verdade!',
          },
        ],
      },
    ],
  },
  {
    id: 'funil-ecommerce',
    name: 'Funil E-commerce',
    description: 'Recuperacao de carrinho abandonado e pos-venda para lojas online',
    stages: [
      {
        name: 'Carrinho Abandonado',
        order: 1,
        messageTemplates: [
          {
            name: 'Recuperacao 1h',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}! Notei que voce deixou alguns itens no carrinho. Posso te ajudar a finalizar o pedido? Ou tem alguma duvida sobre os produtos?',
          },
          {
            name: 'Recuperacao por email',
            channel: 'EMAIL',
            subject: 'Voce esqueceu algo, {{nome}}!',
            body: 'Ola {{nome}},\n\nVimos que voce deixou alguns produtos no carrinho.\n\nSeus itens ainda estao reservados por tempo limitado!\n\nClique aqui para finalizar sua compra.',
          },
        ],
      },
      {
        name: 'Pedido Realizado',
        order: 2,
        messageTemplates: [
          {
            name: 'Confirmacao de pedido',
            channel: 'WHATSAPP',
            body: 'Ola {{nome}}! Seu pedido foi confirmado com sucesso. Em breve voce recebera o codigo de rastreamento. Obrigado pela compra!',
          },
          {
            name: 'Confirmacao por email',
            channel: 'EMAIL',
            subject: 'Pedido confirmado — obrigado, {{nome}}!',
            body: 'Ola {{nome}},\n\nSeu pedido foi confirmado! Aqui estao os detalhes:\n\nEstado: Confirmado\nPrevisao: 5 a 7 dias uteis\n\nVoce recebera atualizacoes por email. Qualquer duvida estamos aqui!',
          },
        ],
      },
      {
        name: 'Em Transito',
        order: 3,
        messageTemplates: [
          {
            name: 'Atualizacao de entrega',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}, boa noticia! Seu pedido saiu para entrega. Fique de olho na sua caixa de email com o codigo de rastreamento!',
          },
        ],
      },
      {
        name: 'Entregue',
        order: 4,
        messageTemplates: [
          {
            name: 'Pos-venda e avaliacao',
            channel: 'WHATSAPP',
            body: 'Ola {{nome}}! Seu pedido chegou? Espero que esteja tudo perfeito. Voce pode avaliar sua experiencia? Sua opiniao e muito importante para nos!',
          },
          {
            name: 'Solicitacao de avaliacao',
            channel: 'EMAIL',
            subject: 'Como foi sua experiencia, {{nome}}?',
            body: 'Ola {{nome}},\n\nEsperamos que tenha adorado sua compra!\n\nGostariamos muito de saber como foi sua experiencia. Sua avaliacao nos ajuda a melhorar ainda mais.\n\nObrigado por escolher a gente!',
          },
        ],
      },
    ],
  },
  {
    id: 'pos-venda-cs',
    name: 'Pos-Venda e Customer Success',
    description: 'Onboarding, ativacao e retencao de clientes apos a venda',
    stages: [
      {
        name: 'Onboarding',
        order: 1,
        messageTemplates: [
          {
            name: 'Kick-off de onboarding',
            channel: 'EMAIL',
            subject: 'Vamos comecar, {{nome}}!',
            body: 'Ola {{nome}},\n\nSeja muito bem-vindo(a)! Sou seu Gerente de Sucesso do Cliente e vou acompanhar sua jornada de implantacao.\n\nJa agendei nossa primeira reuniao de kick-off. Ate la, envio o checklist de implantacao.\n\nGrande abraco!',
          },
          {
            name: 'Boas-vindas whatsapp',
            channel: 'WHATSAPP',
            body: 'Ola {{nome}}! Sou seu CS aqui. Enviou o material de onboarding por email. Qualquer duvida, pode chamar aqui mesmo!',
          },
        ],
      },
      {
        name: 'Implantacao',
        order: 2,
        messageTemplates: [
          {
            name: 'Checkin de implantacao',
            channel: 'WHATSAPP',
            body: 'Oi {{nome}}, como esta indo a implantacao? Ha algo que eu possa ajudar a destravar? Estou disponivel para uma chamada rapida!',
          },
          {
            name: 'Relatorio de progresso',
            channel: 'EMAIL',
            subject: 'Progresso de implantacao — semana 1',
            body: 'Ola {{nome}},\n\nPassando para atualizar o status da implantacao.\n\nEtapas concluidas nesta semana:\n- Configuracao inicial\n- Importacao de dados\n\nProximos passos:\n- Treinamento da equipe\n- Testes finais\n\nQualquer duvida estou disponivel!',
          },
        ],
      },
      {
        name: 'Ativo',
        order: 3,
        messageTemplates: [
          {
            name: 'Checkin mensal',
            channel: 'WHATSAPP',
            body: 'Ola {{nome}}, chegou a hora do nosso checkin mensal! Como esta sendo a experiencia? Ha alguma funcionalidade que nao esta explorando ainda?',
          },
          {
            name: 'Relatorio mensal',
            channel: 'EMAIL',
            subject: 'Relatorio mensal — {{nome}}',
            body: 'Ola {{nome}},\n\nSegue o relatorio de uso do mes. Ficamos felizes com os resultados!\n\nDestaques do mes:\n- Uso crescente das funcionalidades core\n- Engajamento da equipe\n\nProximos passos sugeridos para aproveitar ainda mais a plataforma.\n\nAte o proximo checkin!',
          },
        ],
      },
      {
        name: 'Em Risco',
        order: 4,
        messageTemplates: [
          {
            name: 'Alerta de engajamento',
            channel: 'WHATSAPP',
            body: 'Ola {{nome}}, notei que nao temos tido muita interacao ultimamente. Posso te ajudar com algo? Quero garantir que voce esta extraindo o maximo valor!',
          },
          {
            name: 'Email de retencao',
            channel: 'EMAIL',
            subject: 'Podemos ajudar, {{nome}}?',
            body: 'Ola {{nome}},\n\nNotei uma reducao no uso da plataforma e quero garantir que tudo esta correndo bem.\n\nPosso agendar uma sessao de suporte ou treinamento complementar sem custo adicional.\n\nSo me diga quando fica melhor para voce!',
          },
        ],
      },
      {
        name: 'Renovado',
        order: 5,
        messageTemplates: [
          {
            name: 'Confirmacao de renovacao',
            channel: 'WHATSAPP',
            body: 'Incrivel, {{nome}}! Sua renovacao foi confirmada. Obrigado pela confianca continua. Estou aqui para o que precisar!',
          },
          {
            name: 'Email de agradecimento',
            channel: 'EMAIL',
            subject: 'Obrigado pela renovacao, {{nome}}!',
            body: 'Ola {{nome}},\n\nMuito obrigado por renovar! Sua confianca e o que nos motiva a continuar melhorando.\n\nVou preparar um plano de sucesso para o proximo periodo com novos objetivos e metas.\n\nConte sempre comigo!',
          },
        ],
      },
    ],
  },
];
