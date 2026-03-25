'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  type Audience,
  type AudienceDraft,
  type AudienceFilters,
  type Campaign,
  type CampaignDraft,
  type CampaignSegmentBucket,
  useCampaignStore,
} from '@/stores/useCampaignStore';
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  Filter,
  Layers3,
  LayoutTemplate,
  LoaderCircle,
  Mail,
  Megaphone,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const EMPTY_FILTERS: AudienceFilters = {
  search: '',
  tags: [],
  industries: [],
  positions: [],
  companyIds: [],
  onlyWithPhone: false,
  onlyWithEmail: false,
};

const EMPTY_AUDIENCE_DRAFT: AudienceDraft = {
  name: '',
  description: '',
  kind: 'DYNAMIC',
  filters: EMPTY_FILTERS,
  contactIds: [],
};

const EMPTY_CAMPAIGN_DRAFT: CampaignDraft = {
  name: '',
  description: '',
  channel: 'WHATSAPP',
  status: 'DRAFT',
  messageTemplate: '',
  audienceId: null,
  launchAt: '',
  steps: [
    {
      channel: 'WHATSAPP',
      delayAmount: 0,
      delayUnit: 'HOURS',
      messageTemplate: '',
    },
  ],
};

type PanelState =
  | { type: 'campaign'; campaignId?: string }
  | { type: 'audience'; audienceId?: string }
  | null;

function cloneAudienceFilters(filters?: AudienceFilters | null): AudienceFilters {
  return {
    search: filters?.search ?? '',
    tags: [...(filters?.tags ?? [])],
    industries: [...(filters?.industries ?? [])],
    positions: [...(filters?.positions ?? [])],
    companyIds: [...(filters?.companyIds ?? [])],
    onlyWithPhone: Boolean(filters?.onlyWithPhone),
    onlyWithEmail: Boolean(filters?.onlyWithEmail),
  };
}

function cloneAudienceDraft(draft?: Partial<AudienceDraft>): AudienceDraft {
  return {
    name: draft?.name ?? '',
    description: draft?.description ?? '',
    kind: draft?.kind ?? 'DYNAMIC',
    filters: cloneAudienceFilters(draft?.filters),
    contactIds: [...(draft?.contactIds ?? [])],
  };
}

function cloneCampaignDraft(draft?: Partial<CampaignDraft>): CampaignDraft {
  return {
    name: draft?.name ?? '',
    description: draft?.description ?? '',
    channel: draft?.channel ?? 'WHATSAPP',
    status: draft?.status ?? 'DRAFT',
    messageTemplate: draft?.messageTemplate ?? '',
    audienceId: draft?.audienceId ?? null,
    launchAt: draft?.launchAt ?? '',
    steps:
      draft?.steps?.map((step, index) => ({
        id: step.id,
        order: index + 1,
        channel: step.channel ?? draft?.channel ?? 'WHATSAPP',
        delayAmount: step.delayAmount ?? 0,
        delayUnit: step.delayUnit ?? 'HOURS',
        messageTemplate: step.messageTemplate ?? '',
      })) ?? EMPTY_CAMPAIGN_DRAFT.steps.map((step) => ({ ...step })),
  };
}

function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return 'Sem agenda definida';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatFilterSummary(audience: Audience) {
  if (audience.kind === 'MANUAL') {
    return audience.contactIds.length > 0
      ? `${audience.contactIds.length} contato(s) escolhidos manualmente para esta lista.`
      : 'Lista manual sem contatos selecionados.';
  }

  const parts: string[] = [];

  if (audience.filters.search) {
    parts.push(`Busca: ${audience.filters.search}`);
  }

  if (audience.filters.tags.length > 0) {
    parts.push(`${audience.filters.tags.length} tag(s)`);
  }

  if (audience.filters.industries.length > 0) {
    parts.push(`${audience.filters.industries.length} industria(s)`);
  }

  if (audience.filters.positions.length > 0) {
    parts.push(`${audience.filters.positions.length} cargo(s)`);
  }

  if (audience.filters.companyIds.length > 0) {
    parts.push(`${audience.filters.companyIds.length} empresa(s)`);
  }

  if (audience.filters.onlyWithPhone) {
    parts.push('Com telefone');
  }

  if (audience.filters.onlyWithEmail) {
    parts.push('Com email');
  }

  return parts.length > 0
    ? parts.join(' | ')
    : 'Sem filtros. A audiencia cobre toda a base comercial.';
}

function getCampaignStatusMeta(status: Campaign['status']) {
  switch (status) {
    case 'ACTIVE':
      return {
        label: 'Ativa',
        className: 'border-emerald-100 bg-emerald-50 text-emerald-700',
        icon: Send,
      };
    case 'PAUSED':
      return {
        label: 'Pausada',
        className: 'border-amber-100 bg-amber-50 text-amber-700',
        icon: CirclePause,
      };
    default:
      return {
        label: 'Rascunho',
        className: 'border-slate-100 bg-slate-50 text-slate-600',
        icon: Pencil,
      };
  }
}

function getChannelMeta(channel: Campaign['channel']) {
  return channel === 'EMAIL'
    ? {
        label: 'Email',
        icon: Mail,
      }
    : {
        label: 'WhatsApp',
        icon: MessageSquareText,
      };
}

function formatStepDelay(step: Campaign['steps'][number], index: number) {
  if (index === 0 && step.delayAmount === 0) {
    return 'disparo imediato';
  }

  if (step.delayAmount === 0) {
    return 'sem espera extra';
  }

  const units: Record<Campaign['steps'][number]['delayUnit'], string> = {
    MINUTES: 'min',
    HOURS: 'h',
    DAYS: 'd',
  };

  return `${step.delayAmount}${units[step.delayUnit]}`;
}

function getAudienceKindMeta(kind: Audience['kind']) {
  return kind === 'MANUAL'
    ? {
        label: 'Lista manual',
        className: 'border-amber-100 bg-amber-50 text-amber-700',
      }
    : {
        label: 'Dinamica',
        className: 'border-indigo-100 bg-indigo-50 text-[#594ded]',
      };
}

function formatContactChannel(contact: {
  email?: string | null;
  phone?: string | null;
}) {
  return contact.phone || contact.email || 'Sem canal prioritario';
}

function FilterChipGroup({
  label,
  buckets,
  selected,
  onToggle,
}: {
  label: string;
  buckets: CampaignSegmentBucket[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
          {selected.length} selecionado(s)
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {buckets.length === 0 ? (
          <span className="text-xs text-slate-500">
            Sem valores mapeados na base atual.
          </span>
        ) : (
          buckets.map((bucket) => {
            const isSelected = selected.includes(bucket.label);

            return (
              <button
                key={bucket.key}
                type="button"
                onClick={() => onToggle(bucket.label)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition',
                  isSelected
                    ? 'border-cyan-300/40 bg-cyan-300/15 text-cyan-100'
                    : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08]',
                )}
              >
                <span>{bucket.label}</span>
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] text-slate-400">
                  {bucket.count}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function CampaignsPage() {
  const {
    campaigns,
    audiences,
    segments,
    companies,
    contacts,
    isLoading,
    error,
    fetchCampaignHub,
    createAudience,
    updateAudience,
    deleteAudience,
    createCampaign,
    updateCampaign,
    deleteCampaign,
  } = useCampaignStore();
  const [panel, setPanel] = useState<PanelState>(null);
  const [audienceDraft, setAudienceDraft] =
    useState<AudienceDraft>(EMPTY_AUDIENCE_DRAFT);
  const [campaignDraft, setCampaignDraft] =
    useState<CampaignDraft>(EMPTY_CAMPAIGN_DRAFT);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualContactSearch, setManualContactSearch] = useState('');

  useEffect(() => {
    void fetchCampaignHub();
  }, [fetchCampaignHub]);

  const selectedAudience = useMemo(
    () =>
      panel?.type === 'audience' && panel.audienceId
        ? audiences.find((item) => item.id === panel.audienceId) ?? null
        : null,
    [audiences, panel],
  );

  const selectedCampaign = useMemo(
    () =>
      panel?.type === 'campaign' && panel.campaignId
        ? campaigns.find((item) => item.id === panel.campaignId) ?? null
        : null,
    [campaigns, panel],
  );

  const metrics = useMemo(() => {
    const activeCampaigns = campaigns.filter(
      (campaign) => campaign.status === 'ACTIVE',
    ).length;
    const scheduledCampaigns = campaigns.filter((campaign) =>
      Boolean(campaign.launchAt),
    ).length;
    const reachableContacts = audiences.reduce(
      (sum, audience) => sum + audience.contactCount,
      0,
    );

    return {
      campaigns: campaigns.length,
      activeCampaigns,
      audiences: audiences.length,
      scheduledCampaigns,
      reachableContacts,
    };
  }, [audiences, campaigns]);

  const openAudiencePanel = (audience?: Audience) => {
    setPanel({
      type: 'audience',
      audienceId: audience?.id,
    });
    setPanelError(null);
    setAudienceDraft(
      audience
        ? cloneAudienceDraft({
            name: audience.name,
            description: audience.description,
            kind: audience.kind,
            filters: audience.filters,
            contactIds: audience.contactIds,
          })
        : cloneAudienceDraft(),
    );
    setManualContactSearch('');
  };

  const openCampaignPanel = (campaign?: Campaign) => {
    setPanel({
      type: 'campaign',
      campaignId: campaign?.id,
    });
    setPanelError(null);
    setCampaignDraft(
      campaign
        ? cloneCampaignDraft({
            name: campaign.name,
            description: campaign.description,
            channel: campaign.channel,
            status: campaign.status,
            messageTemplate: campaign.messageTemplate,
            audienceId: campaign.audience?.id ?? null,
            launchAt: campaign.launchAt
              ? new Date(campaign.launchAt).toISOString().slice(0, 16)
              : '',
            steps: campaign.steps,
          })
        : cloneCampaignDraft(),
    );
    setManualContactSearch('');
  };

  const closePanel = () => {
    setPanel(null);
    setPanelError(null);
    setIsSubmitting(false);
    setManualContactSearch('');
  };

  const handleToggleFilterValue = (
    field: 'tags' | 'industries' | 'positions' | 'companyIds',
    value: string,
  ) => {
    setAudienceDraft((current) => {
      const values = current.filters[field] ?? [];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];

      return {
        ...current,
        filters: {
          ...current.filters,
          [field]: nextValues,
        },
      };
    });
  };

  const filteredManualContacts = useMemo(() => {
    const normalizedSearch = manualContactSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return contacts;
    }

    return contacts.filter((contact) => {
      const haystack = [
        contact.name,
        contact.email,
        contact.phone,
        contact.position,
        contact.company?.name,
        contact.company?.industry,
        ...(contact.tags ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [contacts, manualContactSearch]);

  const selectedManualContacts = useMemo(() => {
    const selectedIds = new Set(audienceDraft.contactIds);
    return contacts.filter((contact) => selectedIds.has(contact.id));
  }, [audienceDraft.contactIds, contacts]);

  const handleAudienceKindChange = (kind: AudienceDraft['kind']) => {
    setAudienceDraft((current) => ({
      ...current,
      kind,
    }));
    setManualContactSearch('');
  };

  const handleToggleManualContact = (contactId: string) => {
    setAudienceDraft((current) => {
      const isSelected = current.contactIds.includes(contactId);

      return {
        ...current,
        contactIds: isSelected
          ? current.contactIds.filter((item) => item !== contactId)
          : [...current.contactIds, contactId],
      };
    });
  };

  const addCampaignStep = () => {
    setCampaignDraft((current) => ({
      ...current,
      steps: [
        ...current.steps,
        {
          channel: current.channel,
          delayAmount: 24,
          delayUnit: 'HOURS' as const,
          messageTemplate: '',
        },
      ].map((step, index) => ({
        ...step,
        order: index + 1,
      })),
    }));
  };

  const updateCampaignStep = (
    index: number,
    patch: Partial<CampaignDraft['steps'][number]>,
  ) => {
    setCampaignDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index
          ? {
              ...step,
              ...patch,
              order: stepIndex + 1,
            }
          : {
              ...step,
              order: stepIndex + 1,
            },
      ),
    }));
  };

  const removeCampaignStep = (index: number) => {
    setCampaignDraft((current) => {
      const nextSteps = current.steps
        .filter((_, stepIndex) => stepIndex !== index)
        .map((step, stepIndex) => ({
          ...step,
          order: stepIndex + 1,
        }));

      return {
        ...current,
        steps: nextSteps,
      };
    });
  };

  const handleAudienceSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setIsSubmitting(true);
    setPanelError(null);

    try {
      if (selectedAudience) {
        await updateAudience(selectedAudience.id, audienceDraft);
      } else {
        await createAudience(audienceDraft);
      }
      closePanel();
    } catch (submitError) {
      setPanelError(
        submitError instanceof Error
          ? submitError.message
          : 'Erro ao salvar audiencia',
      );
      setIsSubmitting(false);
    }
  };

  const handleCampaignSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setIsSubmitting(true);
    setPanelError(null);

    try {
      if (selectedCampaign) {
        await updateCampaign(selectedCampaign.id, campaignDraft);
      } else {
        await createCampaign(campaignDraft);
      }
      closePanel();
    } catch (submitError) {
      setPanelError(
        submitError instanceof Error
          ? submitError.message
          : 'Erro ao salvar campanha',
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 p-6 lg:p-8">
      <section className="rounded-[32px] border border-[#f0f0f0] bg-white p-6 shadow-[0_8px_32px_rgba(0,0,0,0.03)] lg:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#594ded]">
              Campanhas e Audiencias
            </p>
            <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-[#1a202c] lg:text-4xl">
              Fundacao de outbound com audiencias dinamicas.
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#718096]">
              Este corte abre a camada de campanhas sem fingir engine completa:
              o workspace monta audiencias a partir da base real e prepara
              campanhas ligadas ao canal e ao template de mensagem.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 xl:justify-end">
            <div className="flex items-center gap-4 rounded-2xl border border-[#f0f0f0] bg-[#fafafb]/50 px-5 py-4">
              <div className="grid gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                  ATIVIDADE
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#1a202c]">
                    {metrics.campaigns}
                  </span>
                  <span className="text-xs font-semibold text-[#594ded]">Campanhas</span>
                </div>
              </div>
              <div className="h-10 w-px bg-[#f0f0f0]" />
              <div className="grid gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                  ALCANCE
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#1a202c]">
                    {metrics.reachableContacts}
                  </span>
                  <span className="text-xs font-semibold text-[#594ded]">Contatos</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => openAudiencePanel()}
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-[#e2e8f0] bg-white px-6 py-4 text-sm font-bold text-[#4a5568] shadow-sm transition hover:bg-[#f7fafc] active:translate-y-0.5"
            >
              <Users className="h-4.5 w-4.5 text-[#594ded]" />
              Nova audiencia
            </button>
            <button
              onClick={() => openCampaignPanel()}
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#594ded] px-6 py-4 text-sm font-bold text-white shadow-[0_8px_24px_rgba(89,77,237,0.25)] transition hover:translate-y-[-2px] hover:shadow-[0_12px_32px_rgba(89,77,237,0.3)] active:translate-y-0"
            >
              <Plus className="h-4.5 w-4.5" />
              Nova campanha
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-h-[42rem] flex-col rounded-[32px] border border-[#f0f0f0] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[#f0f0f0] bg-[#fafafb]/50 p-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                OPERACIONAL
              </p>
              <h3 className="mt-1 text-lg font-bold text-[#1a202c]">
                Estado operacional
              </h3>
            </div>
            <button
              onClick={() => openCampaignPanel()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-bold text-[#4a5568] transition hover:bg-[#f7fafc]"
            >
              <Plus className="h-4 w-4 text-[#594ded]" />
              Criar
            </button>
          </div>

          <div className="grid gap-4 p-4">
            {isLoading && campaigns.length === 0 ? (
              <div className="flex min-h-[18rem] items-center justify-center text-sm text-slate-400">
                Carregando campanhas...
              </div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-black/15 p-6 text-sm text-slate-400">
                Nenhuma campanha criada ainda. O primeiro corte da phase abre
                rascunhos, audiences e preparo de mensagem para o outbound.
              </div>
            ) : (
              campaigns.map((campaign) => {
                const statusMeta = getCampaignStatusMeta(campaign.status);
                const channelMeta = getChannelMeta(campaign.channel);
                const StatusIcon = statusMeta.icon;
                const ChannelIcon = channelMeta.icon;

                return (
                  <article
                    key={campaign.id}
                    className="group relative rounded-[24px] border border-[#f0f0f0] bg-white p-6 transition-all hover:translate-y-[-2px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-lg font-bold text-[#1a202c]">
                            {campaign.name}
                          </h4>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider',
                              statusMeta.className,
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[#718096] max-w-2xl">
                          {campaign.description ||
                            'Sem descricao operacional definida.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/wizard?campaignId=${campaign.id}`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#4a5568] transition hover:border-[#594ded] hover:bg-indigo-50 hover:text-[#594ded]"
                          aria-label={`Editar campanha ${campaign.name} no wizard`}
                        >
                          <LayoutTemplate className="h-4.5 w-4.5" />
                        </Link>
                        <button
                          onClick={() => openCampaignPanel(campaign)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#4a5568] transition hover:border-[#594ded] hover:bg-indigo-50 hover:text-[#594ded]"
                          aria-label={`Editar campanha ${campaign.name}`}
                        >
                          <Pencil className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Excluir a campanha "${campaign.name}"?`,
                              )
                            ) {
                              return;
                            }
                            try {
                              await deleteCampaign(campaign.id);
                            } catch (error) {
                              setPanelError('Erro ao remover campanha');
                            }
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#fee2e2] bg-white text-rose-500 transition hover:bg-rose-50"
                          aria-label={`Excluir campanha ${campaign.name}`}
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[18px] border border-[#f0f0f0] bg-[#fafafb]/50 p-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                          <ChannelIcon className="h-3.5 w-3.5" />
                          Canal
                        </div>
                        <p className="mt-1.5 text-sm font-bold text-[#1a202c]">
                          {channelMeta.label}
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-[#f0f0f0] bg-[#fafafb]/50 p-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                          <Users className="h-3.5 w-3.5" />
                          Audiencia
                        </div>
                        <p className="mt-1.5 text-sm font-bold text-[#1a202c] truncate">
                          {campaign.audience ? campaign.audience.name : 'Nao vinculada'}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-[#718096]">
                          {campaign.audience ? `${campaign.audience.contactCount} contatos` : 'Sem recorte'}
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-[#f0f0f0] bg-[#fafafb]/50 p-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Agenda
                        </div>
                        <p className="mt-1.5 text-sm font-bold text-[#1a202c]">
                          {formatDateTime(campaign.launchAt)}
                        </p>
                      </div>
                    </div>

                    {campaign.messageTemplate?.trim() && (
                      <div className="mt-3 rounded-[18px] border border-[#f0f0f0] bg-[#fafafb]/30 p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#a0aec0] mb-2">Mensagem do Step 1</p>
                        <p className="text-xs italic leading-relaxed text-[#718096] line-clamp-2">
                          "{campaign.messageTemplate.trim()}"
                        </p>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </div>

        <div className="flex min-h-[42rem] flex-col rounded-[32px] border border-[#f0f0f0] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[#f0f0f0] bg-[#fafafb]/50 p-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                AUDIENCIAS
              </p>
              <h3 className="mt-1 text-lg font-bold text-[#1a202c]">
                Recortes e listas da base
              </h3>
            </div>
            <button
              onClick={() => openAudiencePanel()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-bold text-[#4a5568] transition hover:bg-[#f7fafc]"
            >
              <Plus className="h-4 w-4 text-[#594ded]" />
              Criar
            </button>
          </div>

          <div className="grid gap-4 p-4">
            {isLoading && audiences.length === 0 ? (
              <div className="flex min-h-[18rem] items-center justify-center text-sm text-slate-400">
                Carregando audiencias...
              </div>
            ) : audiences.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#e2e8f0] bg-[#fafafb] p-6 text-sm text-[#718096]">
                Nenhuma audiencia criada ainda. O usuario pode comecar com
                filtros dinamicos da base ou montar listas manuais para
                campanhas mais taticas.
              </div>
            ) : (
              audiences.map((audience) => {
                const audienceKindMeta = getAudienceKindMeta(audience.kind);
                const audienceDescription =
                  audience.description ||
                  (audience.kind === 'MANUAL'
                    ? 'Lista curada manualmente para campanhas mais taticas.'
                    : 'Recorte dinamico baseado nos sinais atuais da base.');

                return (
                  <article
                    key={audience.id}
                    className="group relative rounded-[24px] border border-[#f0f0f0] bg-white p-6 transition-all hover:translate-y-[-2px] hover:shadow-[0_12px_24px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-lg font-bold text-[#1a202c]">
                            {audience.name}
                          </h4>
                          <span
                            className={cn(
                              'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider',
                              audienceKindMeta.className,
                            )}
                          >
                            <Layers3 className="h-3 w-3" />
                            {audienceKindMeta.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-[#718096] max-w-2xl">
                          {audienceDescription}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openAudiencePanel(audience)}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#4a5568] transition hover:border-[#594ded] hover:bg-indigo-50 hover:text-[#594ded]"
                          aria-label={`Editar audiencia ${audience.name}`}
                        >
                          <Pencil className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Excluir a audiencia "${audience.name}"?`,
                              )
                            ) {
                              return;
                            }
                            try {
                              await deleteAudience(audience.id);
                            } catch (error) {
                              setPanelError('Erro ao remover audiencia');
                            }
                          }}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#fee2e2] bg-white text-rose-500 transition hover:bg-rose-50"
                          aria-label={`Excluir audiencia ${audience.name}`}
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] border border-[#f0f0f0] bg-[#fafafb]/50 p-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                          <Users className="h-3.5 w-3.5" />
                          Alcance
                        </div>
                        <p className="mt-1.5 text-lg font-bold text-[#1a202c]">
                          {audience.contactCount}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-[#718096]">
                          contatos no recorte atual
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-[#f0f0f0] bg-[#fafafb]/50 p-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                          <Megaphone className="h-3.5 w-3.5" />
                          Campanhas
                        </div>
                        <p className="mt-1.5 text-lg font-bold text-[#1a202c]">
                          {audience.campaignCount}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-[#718096]">
                          campanha(s) vinculada(s)
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-[18px] border border-[#f0f0f0] bg-[#fafafb]/50 p-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Atualizacao
                      </div>
                      <p className="mt-1.5 text-sm font-bold text-[#1a202c]">
                        {formatDateTime(audience.updatedAt)}
                      </p>
                    </div>

                    <div className="mt-3 rounded-[18px] border border-[#f0f0f0] bg-[#fafafb]/50 p-4">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a0aec0]">
                        <Filter className="h-3.5 w-3.5" />
                        {audience.kind === 'MANUAL'
                          ? 'Selecao da lista'
                          : 'Filtros ativos'}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {formatFilterSummary(audience)}
                      </p>
                    </div>

                    <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                        <Users className="h-3.5 w-3.5" />
                        {audience.kind === 'MANUAL'
                          ? 'Contatos selecionados'
                          : 'Amostra da audiencia'}
                      </div>
                      {audience.sampleContacts.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-500">
                          Nenhum contato bate com este recorte neste momento.
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-2">
                          {audience.sampleContacts.map((contact) => (
                            <div
                              key={contact.id}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-medium text-white">
                                  {contact.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {contact.company?.name || 'Sem empresa'} |{' '}
                                  {formatContactChannel(contact)}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-slate-600" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </section>
        {/* Panels (Sheets) */}
        {panel ? (
          <div
            className={cn(
              'fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-[2px] transition-all duration-300',
              panel ? 'opacity-100 visible' : 'opacity-0 invisible'
            )}
            onClick={closePanel}
          >
            <aside
              className={cn(
                'h-full w-full max-w-[600px] border-l border-[#f0f0f0] bg-white shadow-2xl transition-transform duration-300 transform',
                panel ? 'translate-x-0' : 'translate-x-full'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-[#f0f0f0] p-6">
                  <div>
                    <h2 className="text-xl font-bold text-[#1a202c]">
                      {panel.type === 'campaign'
                        ? selectedCampaign
                          ? 'Editar Campanha'
                          : 'Nova Campanha'
                        : selectedAudience
                          ? 'Editar Audiencia'
                          : 'Nova Audiencia'}
                    </h2>
                    <p className="mt-1 text-sm text-[#718096]">
                      {panel.type === 'campaign'
                        ? 'Configure o canal e a cadencia de mensagens.'
                        : 'Defina os filtros dinamicos ou escolha os contatos.'}
                    </p>
                  </div>
                  <button
                    onClick={closePanel}
                    className="rounded-xl border border-[#f0f0f0] p-2 hover:bg-[#fafafb]"
                  >
                    <X className="h-5 w-5 text-[#a0aec0]" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {panelError ? (
                    <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-medium text-rose-600">
                      {panelError}
                    </div>
                  ) : null}

                  {panel.type === 'campaign' ? (
                    <form onSubmit={handleCampaignSubmit} className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-[#718096] ml-1">Nome da campanha</label>
                        <input
                          value={campaignDraft.name}
                          onChange={(event) => setCampaignDraft((current) => ({ ...current, name: event.target.value }))}
                          className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                          placeholder="Ex.: Reengajamento de leads"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-[#718096] ml-1">Descricao operacional</label>
                        <textarea
                          rows={3}
                          value={campaignDraft.description ?? ''}
                          onChange={(event) => setCampaignDraft((current) => ({ ...current, description: event.target.value }))}
                          className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                          placeholder="Objetivo comercial desta campanha..."
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#718096] ml-1">Canal</label>
                          <select
                            value={campaignDraft.channel}
                            onChange={(event) => setCampaignDraft((current) => ({ ...current, channel: event.target.value as CampaignDraft['channel'] }))}
                            className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                          >
                            <option value="WHATSAPP">WhatsApp</option>
                            <option value="EMAIL">Email</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#718096] ml-1">Status</label>
                          <select
                            value={campaignDraft.status}
                            onChange={(event) => setCampaignDraft((current) => ({ ...current, status: event.target.value as CampaignDraft['status'] }))}
                            className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                          >
                            <option value="DRAFT">Rascunho</option>
                            <option value="ACTIVE">Ativa</option>
                            <option value="PAUSED">Pausada</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#718096] ml-1">Audiencia</label>
                          <select
                            value={campaignDraft.audienceId ?? ''}
                            onChange={(event) => setCampaignDraft((current) => ({ ...current, audienceId: event.target.value || null }))}
                            className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                          >
                            <option value="">Sem audiencia vinculada</option>
                            {audiences.map((audience) => (
                              <option key={audience.id} value={audience.id}>
                                {audience.name} ({audience.contactCount})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#718096] ml-1">Agendar para</label>
                          <input
                            type="datetime-local"
                            value={campaignDraft.launchAt ?? ''}
                            onChange={(event) => setCampaignDraft((current) => ({ ...current, launchAt: event.target.value }))}
                            className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <div className="mb-4 flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-[#1a202c]">Cadencia de Mensagens</h4>
                            <p className="text-xs text-[#718096]">Defina a sequencia de toques automáticos.</p>
                          </div>
                          <button
                            type="button"
                            onClick={addCampaignStep}
                            className="flex items-center gap-1.5 rounded-xl border border-[#f0f0f0] bg-white px-3 py-2 text-xs font-bold text-[#594ded] transition hover:bg-[#594ded]/5"
                          >
                            <Plus className="h-4 w-4" />
                            Nova Etapa
                          </button>
                        </div>

                        {campaignDraft.steps.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[#f0f0f0] bg-[#fafafb] px-4 py-8 text-center text-sm text-[#a0aec0]">
                            Nenhuma etapa definida. Clique em "Nova Etapa" para começar.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {campaignDraft.steps.map((step, index) => (
                              <div key={step.id ?? index} className="rounded-2xl border border-[#f0f0f0] bg-white p-4 shadow-sm">
                                <div className="mb-4 flex items-center justify-between">
                                  <span className="text-xs font-bold uppercase tracking-wider text-[#a0aec0]">Etapa {index + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeCampaignStep(index)}
                                    className="rounded-lg p-1.5 text-[#a0aec0] transition hover:bg-rose-50 hover:text-rose-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase text-[#a0aec0] ml-1">Canal</label>
                                    <select
                                      value={step.channel}
                                      onChange={(event) => updateCampaignStep(index, { channel: event.target.value as CampaignDraft['channel'] })}
                                      className="w-full rounded-xl border border-[#f0f0f0] bg-[#fafafb]/50 px-3 py-2 text-xs text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                                    >
                                      <option value="WHATSAPP">WhatsApp</option>
                                      <option value="EMAIL">Email</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase text-[#a0aec0] ml-1">Espera</label>
                                    <input
                                      type="number"
                                      value={step.delayAmount}
                                      onChange={(event) => updateCampaignStep(index, { delayAmount: Number(event.target.value) || 0 })}
                                      className="w-full rounded-xl border border-[#f0f0f0] bg-[#fafafb]/50 px-3 py-2 text-xs text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[11px] font-bold uppercase text-[#a0aec0] ml-1">Unidade</label>
                                    <select
                                      value={step.delayUnit}
                                      onChange={(event) => updateCampaignStep(index, { delayUnit: event.target.value as any })}
                                      className="w-full rounded-xl border border-[#f0f0f0] bg-[#fafafb]/50 px-3 py-2 text-xs text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                                    >
                                      <option value="MINUTES">Minutos</option>
                                      <option value="HOURS">Horas</option>
                                      <option value="DAYS">Dias</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="mt-4 space-y-1">
                                  <label className="text-[11px] font-bold uppercase text-[#a0aec0] ml-1">Mensagem</label>
                                  <textarea
                                    rows={3}
                                    value={step.messageTemplate}
                                    onChange={(event) => updateCampaignStep(index, { messageTemplate: event.target.value })}
                                    className="w-full rounded-xl border border-[#f0f0f0] bg-[#fafafb]/50 px-3 py-2 text-xs text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                                    placeholder="Digite a mensagem..."
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-6">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#594ded] px-4 py-4 text-sm font-bold text-white transition hover:translate-y-[-1px] hover:shadow-lg hover:shadow-[#594ded]/20 disabled:opacity-50"
                        >
                          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          {selectedCampaign ? 'Salvar Campanha' : 'Criar Campanha'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleAudienceSubmit} className="space-y-6">
                      <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-[#718096] ml-1">Nome da audiencia</label>
                        <input
                          value={audienceDraft.name}
                          onChange={(event) => setAudienceDraft((current) => ({ ...current, name: event.target.value }))}
                          className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                          placeholder="Ex.: Leads Premium Inbound"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[13px] font-bold text-[#718096] ml-1">Descricao</label>
                        <textarea
                          rows={3}
                          value={audienceDraft.description ?? ''}
                          onChange={(event) => setAudienceDraft((current) => ({ ...current, description: event.target.value }))}
                          className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                          placeholder="Quais contatos este recorte isola?"
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[13px] font-bold text-[#718096] ml-1">Tipo de Segmentação</label>
                        <div className="grid gap-3 md:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => handleAudienceKindChange('DYNAMIC')}
                            className={cn(
                              'group flex flex-col items-start rounded-2xl border p-4 text-left transition',
                              audienceDraft.kind === 'DYNAMIC'
                                ? 'border-[#594ded]/30 bg-[#594ded]/5 ring-1 ring-[#594ded]/30'
                                : 'border-[#f0f0f0] bg-[#fafafb]/50 hover:bg-white hover:border-[#594ded]/20'
                            )}
                          >
                            <div className={cn(
                              'mb-3 rounded-xl p-2 transition',
                              audienceDraft.kind === 'DYNAMIC' ? 'bg-[#594ded] text-white' : 'bg-white text-[#a0aec0] group-hover:text-[#594ded]'
                            )}>
                              <Filter className="h-5 w-5" />
                            </div>
                            <span className={cn('text-sm font-bold', audienceDraft.kind === 'DYNAMIC' ? 'text-[#1a202c]' : 'text-[#718096]')}>Dinâmica</span>
                            <p className="mt-1 text-[11px] leading-relaxed text-[#a0aec0]">Atualiza automaticamente baseado em filtros.</p>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAudienceKindChange('MANUAL')}
                            className={cn(
                              'group flex flex-col items-start rounded-2xl border p-4 text-left transition',
                              audienceDraft.kind === 'MANUAL'
                                ? 'border-amber-500/30 bg-amber-50 ring-1 ring-amber-500/30'
                                : 'border-[#f0f0f0] bg-[#fafafb]/50 hover:bg-white hover:border-amber-500/20'
                            )}
                          >
                            <div className={cn(
                              'mb-3 rounded-xl p-2 transition',
                              audienceDraft.kind === 'MANUAL' ? 'bg-amber-500 text-white' : 'bg-white text-[#a0aec0] group-hover:text-amber-500'
                            )}>
                              <Users className="h-5 w-5" />
                            </div>
                            <span className={cn('text-sm font-bold', audienceDraft.kind === 'MANUAL' ? 'text-[#1a202c]' : 'text-[#718096]')}>Lista Manual</span>
                            <p className="mt-1 text-[11px] leading-relaxed text-[#a0aec0]">Seleção cirúrgica de contatos específicos.</p>
                          </button>
                        </div>
                      </div>

                      <div className="pt-2">
                        {audienceDraft.kind === 'DYNAMIC' ? (
                          <div className="space-y-5">
                            <div className="space-y-1.5">
                              <label className="text-[13px] font-bold text-[#718096] ml-1">Busca livre</label>
                              <input
                                value={audienceDraft.filters.search ?? ''}
                                onChange={(event) => setAudienceDraft((current) => ({ ...current, filters: { ...current.filters, search: event.target.value } }))}
                                className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                                placeholder="Nome, email ou empresa..."
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 transition hover:bg-white">
                                <span className="text-sm font-medium text-[#718096]">Somente com telefone</span>
                                <input
                                  type="checkbox"
                                  checked={Boolean(audienceDraft.filters.onlyWithPhone)}
                                  onChange={(event) => setAudienceDraft((current) => ({ ...current, filters: { ...current.filters, onlyWithPhone: event.target.checked } }))}
                                  className="h-5 w-5 rounded border-[#f0f0f0] text-[#594ded] transition focus:ring-0"
                                />
                              </label>
                              <label className="flex items-center justify-between gap-3 rounded-2xl border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 transition hover:bg-white">
                                <span className="text-sm font-medium text-[#718096]">Somente com email</span>
                                <input
                                  type="checkbox"
                                  checked={Boolean(audienceDraft.filters.onlyWithEmail)}
                                  onChange={(event) => setAudienceDraft((current) => ({ ...current, filters: { ...current.filters, onlyWithEmail: event.target.checked } }))}
                                  className="h-5 w-5 rounded border-[#f0f0f0] text-[#594ded] transition focus:ring-0"
                                />
                              </label>
                            </div>

                            <FilterChipGroup
                              label="Tags"
                              buckets={segments.tags}
                              selected={audienceDraft.filters.tags ?? []}
                              onToggle={(value) => handleToggleFilterValue('tags', value)}
                            />

                            <FilterChipGroup
                              label="Industrias"
                              buckets={segments.industries}
                              selected={audienceDraft.filters.industries ?? []}
                              onToggle={(value) =>
                                handleToggleFilterValue('industries', value)
                              }
                            />

                            <FilterChipGroup
                              label="Cargos"
                              buckets={segments.positions}
                              selected={audienceDraft.filters.positions ?? []}
                              onToggle={(value) =>
                                handleToggleFilterValue('positions', value)
                              }
                            />

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-[13px] font-bold text-[#718096] ml-1">Empresas</label>
                                <span className="text-[11px] font-bold text-[#a0aec0]">{(audienceDraft.filters.companyIds ?? []).length} selecionada(s)</span>
                              </div>
                              <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-[#f0f0f0] bg-[#fafafb]/30 p-2">
                                {companies.length === 0 ? (
                                  <p className="p-4 text-center text-xs text-[#a0aec0]">Nenhuma empresa cadastrada.</p>
                                ) : (
                                  companies.map((company) => {
                                    const isSelected = (audienceDraft.filters.companyIds ?? []).includes(company.id);
                                    return (
                                      <label key={company.id} className={cn(
                                        'flex items-center justify-between gap-3 rounded-xl border p-3 transition',
                                        isSelected ? 'border-[#594ded]/30 bg-[#594ded]/5' : 'border-[#f0f0f0] bg-white hover:border-[#594ded]/20'
                                      )}>
                                        <div className="min-w-0">
                                          <p className="truncate text-[13px] font-bold text-[#1a202c]">{company.name}</p>
                                          <p className="truncate text-[11px] text-[#718096]">{company.industry || 'Sem industria'}</p>
                                        </div>
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleToggleFilterValue('companyIds', company.id)}
                                          className="h-5 w-5 rounded border-[#f0f0f0] text-[#594ded] transition focus:ring-0"
                                        />
                                      </label>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a0aec0]" />
                              <input
                                value={manualContactSearch}
                                onChange={(event) => setManualContactSearch(event.target.value)}
                                className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 py-3 pl-11 pr-4 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white"
                                placeholder="Buscar contato..."
                              />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <label className="text-[13px] font-bold text-[#718096] ml-1">Selecionar Contatos</label>
                                <span className="text-[11px] font-bold text-[#a0aec0]">{filteredManualContacts.length} no resultado</span>
                              </div>
                              <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-2xl border border-[#f0f0f0] bg-[#fafafb]/30 p-2">
                                {contacts.length === 0 ? (
                                  <p className="p-4 text-center text-xs text-[#a0aec0]">Nenhum contato encontrado.</p>
                                ) : filteredManualContacts.map((contact) => {
                                    const isSelected = audienceDraft.contactIds.includes(contact.id);
                                    return (
                                      <label key={contact.id} className={cn(
                                        'flex items-center justify-between gap-3 rounded-xl border p-3 transition',
                                        isSelected ? 'border-amber-500/30 bg-amber-50' : 'border-[#f0f0f0] bg-white hover:border-amber-500/20'
                                      )}>
                                        <div className="min-w-0">
                                          <p className="truncate text-[13px] font-bold text-[#1a202c]">{contact.name}</p>
                                          <p className="truncate text-[11px] text-[#718096]">{contact.company?.name || 'Sem empresa'} | {contact.position || 'Sem cargo'}</p>
                                        </div>
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleToggleManualContact(contact.id)}
                                          className="h-5 w-5 rounded border-[#f0f0f0] text-amber-500 transition focus:ring-0"
                                        />
                                      </label>
                                    );
                                  })
                                }
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-6">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#594ded] px-4 py-4 text-sm font-bold text-white transition hover:translate-y-[-1px] hover:shadow-lg hover:shadow-[#594ded]/20 disabled:opacity-50"
                        >
                          {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          {selectedAudience ? 'Salvar Audiencia' : 'Criar Audiencia'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </aside>
          </div>
        ) : null}
      </div>
    );
  }
