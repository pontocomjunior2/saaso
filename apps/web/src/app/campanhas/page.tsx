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
        className: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
        icon: Send,
      };
    case 'PAUSED':
      return {
        label: 'Pausada',
        className: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
        icon: CirclePause,
      };
    default:
      return {
        label: 'Rascunho',
        className: 'border-white/10 bg-white/5 text-slate-200',
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
        className: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
      }
    : {
        label: 'Dinamica',
        className: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
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
      <section className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.88)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.22)] lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">
              Campanhas
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white lg:text-[2rem]">
              Fundacao de outbound com audiencias dinamicas e campanhas
              operacionais.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Este corte abre a camada de campanhas sem fingir engine completa:
              o workspace monta audiencias a partir da base real e prepara
              campanhas ligadas ao canal e ao template de mensagem.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 xl:max-w-[44rem] xl:justify-end">
            <div className="grid min-w-[12rem] gap-2 rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Campanhas
                </span>
                <span className="text-lg font-semibold text-white">
                  {metrics.campaigns}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span>{metrics.activeCampaigns} ativas</span>
                <span>{metrics.scheduledCampaigns} agendadas</span>
              </div>
            </div>
            <div className="grid min-w-[12rem] gap-2 rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
                  Audiencias
                </span>
                <span className="text-lg font-semibold text-white">
                  {metrics.audiences}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span>{metrics.reachableContacts} contatos no recorte</span>
              </div>
            </div>
            <button
              onClick={() => openAudiencePanel()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              <Users className="h-4 w-4" />
              Nova audiencia
            </button>
            <button
              onClick={() => openCampaignPanel()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px]"
            >
              <Plus className="h-4 w-4" />
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

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-h-[42rem] flex-col rounded-[28px] border border-white/10 bg-[rgba(7,16,29,0.86)] shadow-[0_20px_72px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">
                Campanhas
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Estado operacional
              </h3>
            </div>
            <button
              onClick={() => openCampaignPanel()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              <Plus className="h-4 w-4" />
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
                    className="rounded-[24px] border border-white/10 bg-black/15 p-5 transition hover:border-white/20 hover:bg-black/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-white">
                            {campaign.name}
                          </h4>
                          <span
                            className={cn(
                              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                              statusMeta.className,
                            )}
                          >
                            <StatusIcon className="h-3.5 w-3.5" />
                            {statusMeta.label}
                          </span>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                          {campaign.description ||
                            'Campanha sem descricao operacional definida.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/wizard?campaignId=${campaign.id}`}
                          className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-2.5 text-cyan-100 transition hover:border-cyan-300/35 hover:bg-cyan-300/15"
                          aria-label={`Editar campanha ${campaign.name} no wizard`}
                        >
                          <LayoutTemplate className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => openCampaignPanel(campaign)}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                          aria-label={`Editar campanha ${campaign.name}`}
                        >
                          <Pencil className="h-4 w-4" />
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
                            } catch (deleteError) {
                              setPanelError(
                                deleteError instanceof Error
                                  ? deleteError.message
                                  : 'Erro ao remover campanha',
                              );
                            }
                          }}
                          className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-2.5 text-rose-100 transition hover:bg-rose-500/20"
                          aria-label={`Excluir campanha ${campaign.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                          <ChannelIcon className="h-3.5 w-3.5" />
                          Canal
                        </div>
                        <p className="mt-2 text-sm font-medium text-white">
                          {channelMeta.label}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                          <Users className="h-3.5 w-3.5" />
                          Audiencia
                        </div>
                        <p className="mt-2 text-sm font-medium text-white">
                          {campaign.audience
                            ? campaign.audience.name
                            : 'Nao vinculada'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {campaign.audience
                            ? `${campaign.audience.contactCount} contatos no recorte`
                            : 'Sem recorte dinamico ligado'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Agenda
                        </div>
                        <p className="mt-2 text-sm font-medium text-white">
                          {formatDateTime(campaign.launchAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                        <Megaphone className="h-3.5 w-3.5" />
                        Template base
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {campaign.steps.length > 0
                          ? `${campaign.steps.length} etapa(s) | 1o touch ${formatStepDelay(campaign.steps[0], 0)}`
                          : 'Sem cadencia definida ainda'}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {campaign.messageTemplate?.trim()
                          ? campaign.messageTemplate
                          : 'Sem mensagem definida ainda. Este rascunho prepara o canal e a audiencia para a phase seguinte.'}
                      </p>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        <div className="flex min-h-[42rem] flex-col rounded-[28px] border border-white/10 bg-[rgba(7,16,29,0.86)] shadow-[0_20px_72px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">
                Audiencias
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Recortes e listas da base
              </h3>
            </div>
            <button
              onClick={() => openAudiencePanel()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              <Plus className="h-4 w-4" />
              Criar
            </button>
          </div>

          <div className="grid gap-4 p-4">
            {isLoading && audiences.length === 0 ? (
              <div className="flex min-h-[18rem] items-center justify-center text-sm text-slate-400">
                Carregando audiencias...
              </div>
            ) : audiences.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-white/10 bg-black/15 p-6 text-sm text-slate-400">
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
                    className="rounded-[24px] border border-white/10 bg-black/15 p-5 transition hover:border-white/20 hover:bg-black/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-lg font-semibold text-white">
                            {audience.name}
                          </h4>
                          <span
                            className={cn(
                              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                              audienceKindMeta.className,
                            )}
                          >
                            <Layers3 className="h-3.5 w-3.5" />
                            {audienceKindMeta.label}
                          </span>
                        </div>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                          {audienceDescription}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openAudiencePanel(audience)}
                          className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                          aria-label={`Editar audiencia ${audience.name}`}
                        >
                          <Pencil className="h-4 w-4" />
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
                            } catch (deleteError) {
                              setPanelError(
                                deleteError instanceof Error
                                  ? deleteError.message
                                  : 'Erro ao remover audiencia',
                              );
                            }
                          }}
                          className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-2.5 text-rose-100 transition hover:bg-rose-500/20"
                          aria-label={`Excluir audiencia ${audience.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                          <Users className="h-3.5 w-3.5" />
                          Alcance
                        </div>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {audience.contactCount}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          contatos no recorte atual
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                          <Megaphone className="h-3.5 w-3.5" />
                          Campanhas
                        </div>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {audience.campaignCount}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          campanha(s) vinculada(s)
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Atualizacao
                        </div>
                        <p className="mt-2 text-sm font-medium text-white">
                          {formatDateTime(audience.updatedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-500">
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

      {panel ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <button
            type="button"
            className="flex-1"
            onClick={closePanel}
            aria-label="Fechar painel"
          />

          <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[rgba(4,10,20,0.98)] p-6 shadow-[-30px_0_80px_rgba(0,0,0,0.45)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">
                  {panel.type === 'campaign' ? 'Campanha' : 'Audiencia'}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  {panel.type === 'campaign'
                    ? selectedCampaign
                      ? 'Editar campanha'
                      : 'Nova campanha'
                    : selectedAudience
                      ? 'Editar audiencia'
                      : 'Nova audiencia'}
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-7 text-slate-400">
                  {panel.type === 'campaign'
                    ? 'Prepare nome, canal, status e mensagem base. A execucao em escala entra na proxima evolucao do modulo.'
                    : 'Escolha entre filtros dinamicos da base ou uma lista manual de contatos para campanhas mais taticas.'}
                </p>
              </div>

              <button
                onClick={closePanel}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {panelError ? (
              <div className="mt-6 rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
                {panelError}
              </div>
            ) : null}

            {panel.type === 'campaign' ? (
              <form onSubmit={handleCampaignSubmit} className="mt-8 grid gap-5">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Nome da campanha
                  </span>
                  <input
                    value={campaignDraft.name}
                    onChange={(event) =>
                      setCampaignDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    placeholder="Ex.: Reengajamento de leads mornos"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Descricao operacional
                  </span>
                  <textarea
                    rows={3}
                    value={campaignDraft.description ?? ''}
                    onChange={(event) =>
                      setCampaignDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    placeholder="O que esta campanha tenta mover e em qual momento do funil."
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      Canal
                    </span>
                    <select
                      value={campaignDraft.channel}
                      onChange={(event) =>
                        setCampaignDraft((current) => ({
                          ...current,
                          channel: event.target.value as CampaignDraft['channel'],
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    >
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="EMAIL">Email</option>
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      Status
                    </span>
                    <select
                      value={campaignDraft.status}
                      onChange={(event) =>
                        setCampaignDraft((current) => ({
                          ...current,
                          status: event.target.value as CampaignDraft['status'],
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    >
                      <option value="DRAFT">Rascunho</option>
                      <option value="ACTIVE">Ativa</option>
                      <option value="PAUSED">Pausada</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      Audiencia
                    </span>
                    <select
                      value={campaignDraft.audienceId ?? ''}
                      onChange={(event) =>
                        setCampaignDraft((current) => ({
                          ...current,
                          audienceId: event.target.value || null,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    >
                      <option value="">Sem audiencia vinculada</option>
                      {audiences.map((audience) => (
                        <option key={audience.id} value={audience.id}>
                          {audience.name} ({audience.contactCount})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      Agendar para
                    </span>
                    <input
                      type="datetime-local"
                      value={campaignDraft.launchAt ?? ''}
                      onChange={(event) =>
                        setCampaignDraft((current) => ({
                          ...current,
                          launchAt: event.target.value,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Mensagem base
                  </span>
                  <textarea
                    rows={7}
                    value={campaignDraft.messageTemplate ?? ''}
                    onChange={(event) =>
                      setCampaignDraft((current) => ({
                        ...current,
                        messageTemplate: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    placeholder="Mensagem inicial ou template que esta campanha vai usar quando o runtime de sequencia estiver ativo."
                  />
                </label>

                <div className="grid gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        Cadencia inicial
                      </p>
                      <p className="text-xs text-slate-500">
                        Fundacao do `SequenceRun`: cada etapa define atraso,
                        canal e mensagem antes do runtime outbound.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addCampaignStep}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-100 transition hover:border-white/20 hover:bg-white/[0.08]"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar etapa
                    </button>
                  </div>

                  {campaignDraft.steps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-5 text-sm text-slate-500">
                      Nenhuma etapa definida ainda. O runtime de cadencia vai
                      usar esta estrutura no próximo corte.
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {campaignDraft.steps.map((step, index) => (
                        <div
                          key={step.id ?? `${step.order ?? index + 1}-${index}`}
                          className="grid gap-4 rounded-[22px] border border-white/10 bg-black/15 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">
                                Etapa {index + 1}
                              </p>
                              <p className="text-xs text-slate-500">
                                {index === 0
                                  ? 'Primeiro toque da cadencia.'
                                  : 'Follow-up adicional da campanha.'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCampaignStep(index)}
                              disabled={campaignDraft.steps.length === 1}
                              className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Remover
                            </button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-[0.9fr_0.7fr_0.7fr]">
                            <label className="grid gap-2">
                              <span className="text-sm font-medium text-slate-200">
                                Canal da etapa
                              </span>
                              <select
                                value={step.channel}
                                onChange={(event) =>
                                  updateCampaignStep(index, {
                                    channel: event.target
                                      .value as CampaignDraft['channel'],
                                  })
                                }
                                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                              >
                                <option value="WHATSAPP">WhatsApp</option>
                                <option value="EMAIL">Email</option>
                              </select>
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-medium text-slate-200">
                                Espera
                              </span>
                              <input
                                type="number"
                                min={0}
                                max={720}
                                value={step.delayAmount}
                                onChange={(event) =>
                                  updateCampaignStep(index, {
                                    delayAmount: Number(event.target.value) || 0,
                                  })
                                }
                                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-medium text-slate-200">
                                Unidade
                              </span>
                              <select
                                value={step.delayUnit}
                                onChange={(event) =>
                                  updateCampaignStep(index, {
                                    delayUnit: event.target
                                      .value as CampaignDraft['steps'][number]['delayUnit'],
                                  })
                                }
                                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]"
                              >
                                <option value="MINUTES">Minutos</option>
                                <option value="HOURS">Horas</option>
                                <option value="DAYS">Dias</option>
                              </select>
                            </label>
                          </div>

                          <label className="grid gap-2">
                            <span className="text-sm font-medium text-slate-200">
                              Mensagem da etapa
                            </span>
                            <textarea
                              rows={4}
                              value={step.messageTemplate}
                              onChange={(event) =>
                                updateCampaignStep(index, {
                                  messageTemplate: event.target.value,
                                })
                              }
                              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
                              placeholder={
                                index === 0
                                  ? 'Primeira mensagem da campanha.'
                                  : 'Follow-up desta etapa.'
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                  <p className="text-sm text-slate-500">
                    Este corte salva campanha, audiencia, mensagem base e os
                    steps iniciais da cadencia. O runtime de `SequenceRun`
                    entra na evolucao seguinte.
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {selectedCampaign ? 'Salvar campanha' : 'Criar campanha'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAudienceSubmit} className="mt-8 grid gap-5">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Nome da audiencia
                  </span>
                  <input
                    value={audienceDraft.name}
                    onChange={(event) =>
                      setAudienceDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    placeholder="Ex.: Clinicas privadas com urgencia alta"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Descricao
                  </span>
                  <textarea
                    rows={3}
                    value={audienceDraft.description ?? ''}
                    onChange={(event) =>
                      setAudienceDraft((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
                    placeholder="Que recorte esta sendo isolado e para qual uso comercial."
                  />
                </label>

                <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-100">
                        Tipo de audiencia
                      </p>
                      <p className="text-xs text-slate-500">
                        Filtro dinamico da base ou lista manual curada.
                      </p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {getAudienceKindMeta(audienceDraft.kind).label}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleAudienceKindChange('DYNAMIC')}
                      className={cn(
                        'rounded-[22px] border px-4 py-4 text-left transition',
                        audienceDraft.kind === 'DYNAMIC'
                          ? 'border-cyan-300/40 bg-cyan-300/10'
                          : 'border-white/10 bg-black/15 hover:border-white/20 hover:bg-black/20',
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Filter className="h-4 w-4" />
                        Dinamica
                      </div>
                      <p className="mt-2 text-xs leading-6 text-slate-500">
                        Recalcula o alcance conforme tags, cargos, empresas e
                        prontidao de canal mudam no workspace.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAudienceKindChange('MANUAL')}
                      className={cn(
                        'rounded-[22px] border px-4 py-4 text-left transition',
                        audienceDraft.kind === 'MANUAL'
                          ? 'border-amber-300/40 bg-amber-300/10'
                          : 'border-white/10 bg-black/15 hover:border-white/20 hover:bg-black/20',
                      )}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <Users className="h-4 w-4" />
                        Lista manual
                      </div>
                      <p className="mt-2 text-xs leading-6 text-slate-500">
                        Selecione contatos um a um para campanhas mais
                        cirurgicas, sem depender de segmentacao automatica.
                      </p>
                    </button>
                  </div>
                </div>

                {audienceDraft.kind === 'DYNAMIC' ? (
                  <>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium text-slate-200">
                        Busca livre
                      </span>
                      <input
                        value={audienceDraft.filters.search ?? ''}
                        onChange={(event) =>
                          setAudienceDraft((current) => ({
                            ...current,
                            filters: {
                              ...current.filters,
                              search: event.target.value,
                            },
                          }))
                        }
                        className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
                        placeholder="Busca por nome, email, telefone ou empresa"
                      />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="flex items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            Somente com telefone
                          </p>
                          <p className="text-xs text-slate-500">
                            Filtra contatos prontos para WhatsApp.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(audienceDraft.filters.onlyWithPhone)}
                          onChange={(event) =>
                            setAudienceDraft((current) => ({
                              ...current,
                              filters: {
                                ...current.filters,
                                onlyWithPhone: event.target.checked,
                              },
                            }))
                          }
                          className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            Somente com email
                          </p>
                          <p className="text-xs text-slate-500">
                            Filtra contatos prontos para campanhas de email.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(audienceDraft.filters.onlyWithEmail)}
                          onChange={(event) =>
                            setAudienceDraft((current) => ({
                              ...current,
                              filters: {
                                ...current.filters,
                                onlyWithEmail: event.target.checked,
                              },
                            }))
                          }
                          className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300"
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

                    <div className="grid gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-slate-200">
                          Empresas
                        </p>
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          {(audienceDraft.filters.companyIds ?? []).length}{' '}
                          selecionada(s)
                        </span>
                      </div>
                      <div className="max-h-56 overflow-y-auto rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
                        <div className="grid gap-2">
                          {companies.length === 0 ? (
                            <span className="text-xs text-slate-500">
                              Nenhuma empresa cadastrada ainda.
                            </span>
                          ) : (
                            companies.map((company) => {
                              const isSelected = (
                                audienceDraft.filters.companyIds ?? []
                              ).includes(company.id);

                              return (
                                <label
                                  key={company.id}
                                  className={cn(
                                    'flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 transition',
                                    isSelected
                                      ? 'border-cyan-300/40 bg-cyan-300/10'
                                      : 'border-white/10 bg-black/15 hover:border-white/20 hover:bg-black/20',
                                  )}
                                >
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {company.name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {company.industry || 'Sem industria'}
                                    </p>
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      handleToggleFilterValue(
                                        'companyIds',
                                        company.id,
                                      )
                                    }
                                    className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300"
                                  />
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-4">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        value={manualContactSearch}
                        onChange={(event) =>
                          setManualContactSearch(event.target.value)
                        }
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-amber-300/40 focus:bg-white/[0.08]"
                        placeholder="Buscar contato por nome, cargo, empresa, email ou telefone"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                      <span>
                        {audienceDraft.contactIds.length} contato(s)
                        selecionado(s)
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        {filteredManualContacts.length} no resultado
                      </span>
                    </div>

                    <div className="max-h-[28rem] overflow-y-auto rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
                      <div className="grid gap-2">
                        {contacts.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-5 text-sm text-slate-500">
                            Nenhum contato cadastrado ainda para montar uma
                            lista manual.
                          </div>
                        ) : filteredManualContacts.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-5 text-sm text-slate-500">
                            Nenhum contato encontrado com esta busca.
                          </div>
                        ) : (
                          filteredManualContacts.map((contact) => {
                            const isSelected = audienceDraft.contactIds.includes(
                              contact.id,
                            );

                            return (
                              <label
                                key={contact.id}
                                className={cn(
                                  'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition',
                                  isSelected
                                    ? 'border-amber-300/40 bg-amber-300/10'
                                    : 'border-white/10 bg-black/15 hover:border-white/20 hover:bg-black/20',
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-white">
                                    {contact.name}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {contact.company?.name || 'Sem empresa'} |{' '}
                                    {contact.position || 'Sem cargo'}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {formatContactChannel(contact)}
                                  </p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    handleToggleManualContact(contact.id)
                                  }
                                  className="h-4 w-4 rounded border-white/20 bg-transparent text-amber-300"
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {selectedManualContacts.length > 0 ? (
                      <div className="grid gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-slate-200">
                            Selecionados agora
                          </p>
                          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            {selectedManualContacts.length} contato(s)
                          </span>
                        </div>
                        <div className="grid gap-2">
                          {selectedManualContacts.slice(0, 6).map((contact) => (
                            <div
                              key={contact.id}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">
                                  {contact.name}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {contact.company?.name || 'Sem empresa'} |{' '}
                                  {formatContactChannel(contact)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleManualContact(contact.id)
                                }
                                className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08]"
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                  <p className="text-sm text-slate-500">
                    {audienceDraft.kind === 'MANUAL'
                      ? 'Listas manuais congelam a selecao atual dos contatos. Use este modo para campanhas mais taticas.'
                      : 'Audiencias dinamicas sao recalculadas a partir da base atual. Ao mudar contatos, empresas ou tags, o alcance muda junto.'}
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {selectedAudience ? 'Salvar audiencia' : 'Criar audiencia'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
