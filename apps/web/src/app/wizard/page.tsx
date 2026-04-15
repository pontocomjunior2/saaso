'use client';

import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useUIMode } from '@/components/layout/UIModeProvider';
import type { LeadFormField, LeadFormFieldMap, LeadFormFieldType } from '@/stores/useLeadFormStore';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  LayoutTemplate,
  LoaderCircle,
  Plus,
  Settings2,
  Wand2,
  Workflow,
  X,
  AlertCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type InputType = 'FORM' | 'WHATSAPP';
type Task = { timing?: string; canal?: string; tipo?: string; template?: string; [key: string]: unknown };
type Stage = { stageKey: string; stageName: string; description?: string; objective?: string; agentLabel?: string; tasks: Task[] };
type Agent = { stageKey: string; name: string; systemPrompt: string; profile?: Record<string, unknown>; selectedTemplateId?: string | null };
type Blueprint = { meta?: { produto?: string; descricao?: string }; pipeline?: Array<{ nome: string; descricao?: string; objetivo?: string; agente?: string; regua_nutricao?: Task[] }> };
type Result = { clientName: string; pipeline: { name: string; stageCount: number }; campaign: { name: string; stepCount: number }; agents: Array<{ id: string; name: string }>; form: { slug: string } | null; whatsapp: { phoneNumber: string | null } | null };
type ExistingAgent = {
  id: string;
  name: string;
  systemPrompt: string;
  compiledPrompt?: string;
  profile?: Record<string, unknown> | null;
  isActive: boolean;
  stage?: { id: string; name: string; pipeline: { id: string; name: string } } | null;
};
type WhatsAppAccountOption = {
  id: string;
  provider: string;
  phoneNumber: string | null;
  instanceName: string | null;
  status: string;
  assignedPipelineId: string | null;
  assignedPipelineName: string | null;
};
type WizardSetupResponse = {
  campaignId: string;
  campaignName: string;
  pipelineId: string | null;
  pipelineName: string;
  clientName: string;
  description: string;
  inputType: InputType;
  form: {
    id: string;
    name: string;
    headline: string;
    description: string;
    fields: LeadFormField[];
  } | null;
  whatsapp: {
    id: string;
    phoneNumber: string;
    phoneNumberId: string | null;
    wabaId: string | null;
    accessToken: string | null;
    provider: string | null;
    instanceName: string | null;
  } | null;
  pipelineWhatsAppAccountId: string | null;
  pipelineWhatsAppInboundStageId: string | null;
  agents: Array<{
    id: string | null;
    stageKey: string;
    name: string;
    systemPrompt: string;
    profile: Record<string, unknown> | null;
  }>;
  rule: Array<{
    stageId: string | null;
    stageKey: string;
    stageName: string;
    description?: string;
    objective?: string;
    agentLabel?: string;
    tasks: Task[];
  }>;
};

const STEPS = ['Cliente', 'Input', 'Canal', 'Agentes', 'Regua'] as const;
const FIELD_TYPES: Array<{ value: LeadFormFieldType; label: string }> = [
  { value: 'text', label: 'Texto curto' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'select', label: 'Selecao' },
];
const FIELD_MAPS: Array<{ value: LeadFormFieldMap; label: string }> = [
  { value: 'name', label: 'Nome do contato' },
  { value: 'email', label: 'Email do contato' },
  { value: 'phone', label: 'Telefone do contato' },
  { value: 'position', label: 'Cargo' },
  { value: 'companyName', label: 'Empresa' },
  { value: 'cardTitle', label: 'Titulo do card' },
  { value: 'custom', label: 'Campo customizado' },
];
const FIELD_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  field: LeadFormField;
}> = [
  {
    id: 'name',
    label: 'Nome',
    description: 'Identificacao principal do lead.',
    field: {
      id: 'name',
      key: 'name',
      label: 'Nome',
      type: 'text',
      required: true,
      mapTo: 'name',
      placeholder: 'Seu nome',
    },
  },
  {
    id: 'email',
    label: 'Email',
    description: 'Canal principal para follow-up.',
    field: {
      id: 'email',
      key: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      mapTo: 'email',
      placeholder: 'voce@empresa.com',
    },
  },
  {
    id: 'phone',
    label: 'WhatsApp',
    description: 'Pronto para contato automatico.',
    field: {
      id: 'phone',
      key: 'phone',
      label: 'WhatsApp',
      type: 'phone',
      required: false,
      mapTo: 'phone',
      placeholder: '(11) 99999-9999',
    },
  },
  {
    id: 'message',
    label: 'Mensagem',
    description: 'Campo aberto para contexto.',
    field: {
      id: 'message',
      key: 'message',
      label: 'Mensagem',
      type: 'textarea',
      required: false,
      mapTo: 'custom',
      placeholder: 'Conte seu contexto',
    },
  },
  {
    id: 'select',
    label: 'Selecao',
    description: 'Bom para triagem inicial.',
    field: {
      id: 'select',
      key: 'select',
      label: 'Selecione uma opcao',
      type: 'select',
      required: false,
      mapTo: 'custom',
      options: [
        { label: 'Opcao 1', value: 'opcao_1' },
        { label: 'Opcao 2', value: 'opcao_2' },
      ],
    },
  },
];

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function makeUniqueToken(baseValue: string, existingValues: string[]) {
  const normalized = slugify(baseValue).replace(/-/g, '_') || 'campo';
  if (!existingValues.includes(normalized)) {
    return normalized;
  }

  let counter = 2;
  let candidate = `${normalized}_${counter}`;
  while (existingValues.includes(candidate)) {
    counter += 1;
    candidate = `${normalized}_${counter}`;
  }

  return candidate;
}

function cloneField(field: LeadFormField): LeadFormField {
  return {
    ...field,
    placeholder: field.placeholder ?? '',
    helpText: field.helpText ?? '',
    options: [...(field.options ?? [])],
  };
}

function normalizeBlueprint(payload: Blueprint | null): Stage[] {
  return (payload?.pipeline ?? []).map((stage, index) => ({
    stageKey: `${index + 1}-${slugify(stage.nome)}`,
    stageName: stage.nome,
    description: stage.descricao,
    objective: stage.objetivo,
    agentLabel: stage.agente,
    tasks: (stage.regua_nutricao ?? []).map((task) => ({ ...task })),
  }));
}

function Step({ label, index, active, done }: { label: string; index: number; active: boolean; done: boolean }) {
  return (
    <div className={cn('rounded-[20px] border px-4 py-3', active ? 'border-cyan-300/20 bg-cyan-300/[0.08]' : 'border-slate-200 bg-white')}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Etapa {index + 1}</p>
      <p className={cn('mt-2 text-sm font-medium', done || active ? 'text-slate-950' : 'text-slate-400')}>{label}</p>
    </div>
  );
}

function TextField({ label, value, onChange, mode }: { label: string; value: string; onChange: (value: string) => void; mode: 'simple' | 'advanced' }) {
  return (
    <label className="block">
      <span className={cn('mb-2 block text-sm font-medium', mode === 'simple' ? 'text-slate-700' : 'text-slate-200')}>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={cn('h-12 w-full rounded-[18px] border px-4 text-sm outline-none focus:border-cyan-300/35', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-950' : 'border-white/[0.08] bg-white/[0.04] text-white')} />
    </label>
  );
}

export default function WizardPage() {
  const { mode } = useUIMode();
  const searchParams = useSearchParams();
  const editingCampaignId = searchParams.get('campaignId');
  const [activeStep, setActiveStep] = useState(0);
  const [inputType, setInputType] = useState<InputType>('FORM');
  const [rule, setRule] = useState<Stage[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [clientName, setClientName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [pipelineName, setPipelineName] = useState('');
  const [description, setDescription] = useState('');
  const [existingPipelineId, setExistingPipelineId] = useState<string | null>(null);
  const [formName, setFormName] = useState('Formulario principal');
  const [formHeadline, setFormHeadline] = useState('Receba seus leads');
  const [formDescription, setFormDescription] = useState('Capture o lead e inicie a automacao.');
  const [formFields, setFormFields] = useState<LeadFormField[]>([
    { id: 'name', key: 'name', label: 'Nome', type: 'text', required: true, mapTo: 'name', placeholder: 'Seu nome' },
    { id: 'email', key: 'email', label: 'Email', type: 'email', required: true, mapTo: 'email', placeholder: 'voce@empresa.com' },
    { id: 'phone', key: 'phone', label: 'WhatsApp', type: 'phone', mapTo: 'phone', placeholder: '(11) 99999-9999' },
  ]);
  const [whatsPhone, setWhatsPhone] = useState('');
  const [whatsPhoneId, setWhatsPhoneId] = useState('');
  const [whatsWabaId, setWhatsWabaId] = useState('');
  const [whatsAccessToken, setWhatsAccessToken] = useState('');
  const [whatsProvider, setWhatsProvider] = useState<'meta_cloud' | 'evolution'>('evolution');
  const [whatsInstanceName, setWhatsInstanceName] = useState('');
  const [selectedWhatsAppAccountId, setSelectedWhatsAppAccountId] = useState('');
  const [whatsAppAccounts, setWhatsAppAccounts] = useState<WhatsAppAccountOption[]>([]);
  const [selectedStageKey, setSelectedStageKey] = useState<string | null>(null);
  const [agentLibrary, setAgentLibrary] = useState<ExistingAgent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const [response, agentsResponse, accountsResponse, setupResponse] = await Promise.all([
          api.get<Blueprint>('/tenant/wizard-blueprint'),
          api.get<ExistingAgent[]>('/agents'),
          api.get<WhatsAppAccountOption[]>('/whatsapp/accounts'),
          editingCampaignId
            ? api.get<WizardSetupResponse>(`/tenant/wizard-campaigns/${editingCampaignId}`)
            : Promise.resolve(null),
        ]);
        if (!mounted) return;
        const nextRule = setupResponse?.data?.rule?.length
          ? setupResponse.data.rule
          : normalizeBlueprint(response.data);
        const productName = response.data.meta?.produto ?? 'Nova operacao';
        setRule(nextRule);
        setAgentLibrary(agentsResponse.data);
        setWhatsAppAccounts(accountsResponse.data);
        setAgents(
          setupResponse?.data?.agents?.length
            ? setupResponse.data.agents.map((agent) => ({
                stageKey: agent.stageKey,
                name: agent.name,
                systemPrompt: agent.systemPrompt,
                profile: agent.profile ?? undefined,
                selectedTemplateId: agent.id,
              }))
            : nextRule.map((stage) => ({ stageKey: stage.stageKey, name: stage.agentLabel || `Agente ${stage.stageName}`, systemPrompt: `Voce conduz a etapa ${stage.stageName}. Objetivo: ${stage.objective ?? 'movimentar o lead com clareza'}. Registre o andamento no card e siga a regua da etapa.`, profile: { objective: stage.objective ?? '', stageName: stage.stageName, businessContext: productName }, selectedTemplateId: null })),
        );
        setClientName(setupResponse?.data?.clientName ?? productName);
        setCampaignName(setupResponse?.data?.campaignName ?? `${productName} · Campanha Principal`);
        setPipelineName(setupResponse?.data?.pipelineName ?? `${productName} · Pipeline`);
        setExistingPipelineId(setupResponse?.data?.pipelineId ?? null);
        setDescription(setupResponse?.data?.description ?? response.data.meta?.descricao ?? '');
        setSelectedStageKey(nextRule[0]?.stageKey ?? null);
        setInputType(setupResponse?.data?.inputType ?? 'FORM');
        setFormName(setupResponse?.data?.form?.name ?? `${productName} · Captacao`);
        setFormHeadline(setupResponse?.data?.form?.headline ?? `Conheca ${productName}`);
        setFormDescription(setupResponse?.data?.form?.description ?? 'Capture o lead e inicie a automacao.');
        setFormFields(setupResponse?.data?.form?.fields?.length ? setupResponse.data.form.fields : [
          { id: 'name', key: 'name', label: 'Nome', type: 'text', required: true, mapTo: 'name', placeholder: 'Seu nome' },
          { id: 'email', key: 'email', label: 'Email', type: 'email', required: true, mapTo: 'email', placeholder: 'voce@empresa.com' },
          { id: 'phone', key: 'phone', label: 'WhatsApp', type: 'phone', mapTo: 'phone', placeholder: '(11) 99999-9999' },
        ]);
        setWhatsPhone(setupResponse?.data?.whatsapp?.phoneNumber ?? '');
        setWhatsPhoneId(setupResponse?.data?.whatsapp?.phoneNumberId ?? '');
        setWhatsWabaId(setupResponse?.data?.whatsapp?.wabaId ?? '');
        setWhatsAccessToken(setupResponse?.data?.whatsapp?.accessToken ?? '');
        setWhatsProvider((setupResponse?.data?.whatsapp?.provider as 'meta_cloud' | 'evolution' | null) ?? 'evolution');
        setWhatsInstanceName(setupResponse?.data?.whatsapp?.instanceName ?? '');
        setSelectedWhatsAppAccountId(
          setupResponse?.data?.pipelineWhatsAppAccountId ??
            setupResponse?.data?.whatsapp?.id ??
            '',
        );
      } catch (err: any) {
        if (mounted) {
          setInitError(
            err?.response?.data?.message ??
            'Nao foi possivel carregar as informacoes desta automacao.',
          );
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [editingCampaignId]);

  useEffect(() => {
    if (!selectedWhatsAppAccountId) {
      return;
    }

    const account = whatsAppAccounts.find((item) => item.id === selectedWhatsAppAccountId);
    if (!account) {
      return;
    }

    setWhatsPhone(account.phoneNumber ?? '');
    setWhatsProvider((account.provider as 'meta_cloud' | 'evolution') ?? 'evolution');
    setWhatsInstanceName(account.instanceName ?? '');
  }, [selectedWhatsAppAccountId, whatsAppAccounts]);

  const selectedStage = useMemo(() => rule.find((stage) => stage.stageKey === selectedStageKey) ?? null, [rule, selectedStageKey]);
  const selectedWhatsAppAccount = useMemo(
    () => whatsAppAccounts.find((item) => item.id === selectedWhatsAppAccountId) ?? null,
    [selectedWhatsAppAccountId, whatsAppAccounts],
  );
  const availableWhatsAppAccounts = useMemo(
    () =>
      whatsAppAccounts.filter(
        (account) => !account.assignedPipelineId || account.assignedPipelineId === existingPipelineId || account.id === selectedWhatsAppAccountId,
      ),
    [existingPipelineId, selectedWhatsAppAccountId, whatsAppAccounts],
  );
  const suggestedAgentsByStage = useMemo(() => {
    return rule.reduce<Record<string, ExistingAgent[]>>((accumulator, stage) => {
      const stageName = stage.stageName.toLowerCase();
      const objective = (stage.objective ?? '').toLowerCase();
      accumulator[stage.stageKey] = agentLibrary.filter((agent) => {
        const agentStageName = agent.stage?.name?.toLowerCase() ?? '';
        const prompt = `${agent.name} ${agent.systemPrompt} ${agent.compiledPrompt ?? ''}`.toLowerCase();
        return agentStageName.includes(stageName) || prompt.includes(stageName) || (objective && prompt.includes(objective));
      });
      return accumulator;
    }, {});
  }, [agentLibrary, rule]);
  const canGoNext = activeStep === 0 ? Boolean(clientName.trim() && campaignName.trim() && pipelineName.trim()) : activeStep === 2 ? inputType === 'FORM' ? Boolean(formName.trim()) : Boolean(selectedWhatsAppAccountId || whatsPhone.trim()) : activeStep === 3 ? agents.every((agent) => agent.name.trim()) : true;

  const updateFormField = (fieldId: string, patch: Partial<LeadFormField>) => {
    setFormFields((current) =>
      current.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              ...patch,
              options:
                patch.type && patch.type !== 'select'
                  ? []
                  : patch.options
                    ? [...patch.options]
                    : [...(field.options ?? [])],
            }
          : field,
      ),
    );
  };

  const addFieldFromPreset = (presetId: string) => {
    const preset = FIELD_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setFormFields((current) => [
      ...current,
      {
        ...cloneField(preset.field),
        id: makeUniqueToken(preset.field.id, current.map((field) => field.id)),
        key: makeUniqueToken(preset.field.key, current.map((field) => field.key)),
      },
    ]);
  };

  const duplicateField = (fieldId: string) => {
    setFormFields((current) => {
      const index = current.findIndex((field) => field.id === fieldId);
      if (index === -1) {
        return current;
      }

      const source = cloneField(current[index]);
      const nextField = {
        ...source,
        id: makeUniqueToken(source.id, current.map((field) => field.id)),
        key: makeUniqueToken(source.key, current.map((field) => field.key)),
        label: `${source.label} copia`,
      };
      const next = [...current];
      next.splice(index + 1, 0, nextField);
      return next;
    });
  };

  const moveField = (fieldId: string, direction: -1 | 1) => {
    setFormFields((current) => {
      const index = current.findIndex((field) => field.id === fieldId);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const addSelectOption = (fieldId: string) => {
    const field = formFields.find((item) => item.id === fieldId);
    const nextIndex = (field?.options?.length ?? 0) + 1;
    updateFormField(fieldId, {
      options: [
        ...(field?.options ?? []),
        { label: `Opcao ${nextIndex}`, value: `opcao_${nextIndex}` },
      ],
    });
  };

  const updateSelectOption = (
    fieldId: string,
    optionIndex: number,
    patch: { label?: string; value?: string },
  ) => {
    const field = formFields.find((item) => item.id === fieldId);
    if (!field) {
      return;
    }

    updateFormField(fieldId, {
      options: (field.options ?? []).map((option, index) =>
        index === optionIndex ? { ...option, ...patch } : option,
      ),
    });
  };

  const removeSelectOption = (fieldId: string, optionIndex: number) => {
    const field = formFields.find((item) => item.id === fieldId);
    if (!field) {
      return;
    }

    updateFormField(fieldId, {
      options: (field.options ?? []).filter((_, index) => index !== optionIndex),
    });
  };

  const applyAgentTemplate = (stageKey: string, template: ExistingAgent | null) => {
    setAgents((current) =>
      current.map((agent) =>
        agent.stageKey === stageKey
          ? {
              ...agent,
              name: template?.name ?? agent.name,
              systemPrompt: template?.systemPrompt ?? agent.systemPrompt,
              profile: template?.profile ?? agent.profile,
              selectedTemplateId: template?.id ?? null,
            }
          : agent,
      ),
    );
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    setResult(null);
    try {
      const payload = { clientName, campaignName, pipelineName, description, inputType, form: inputType === 'FORM' ? { name: formName, slug: slugify(formName), headline: formHeadline, description: formDescription, fields: formFields } : undefined, whatsapp: inputType === 'WHATSAPP' ? { accountId: selectedWhatsAppAccountId || undefined, provider: whatsProvider, instanceName: whatsInstanceName || undefined, phoneNumber: whatsPhone || undefined, phoneNumberId: whatsPhoneId || undefined, wabaId: whatsWabaId || undefined, accessToken: whatsAccessToken || undefined } : undefined, agents: agents.map(({ selectedTemplateId, stageKey, name, systemPrompt, profile }) => ({ id: selectedTemplateId || undefined, stageKey, name, systemPrompt, profile })), rule };
      const response = editingCampaignId
        ? await api.patch<Result>(`/tenant/wizard-campaigns/${editingCampaignId}`, payload)
        : await api.post<Result>('/tenant/wizard-campaign', payload);
      setResult(response.data);
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message ?? `Nao foi possivel ${editingCampaignId ? 'atualizar' : 'salvar'} a campanha pelo wizard.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6 p-6 lg:p-8">
        <section className={cn('rounded-[30px] border p-6', mode === 'simple' ? 'border-slate-200 bg-[rgba(255,255,255,0.84)] shadow-[0_18px_44px_rgba(15,23,42,0.08)]' : 'border-white/[0.08] bg-[rgba(13,22,34,0.88)] shadow-[0_20px_72px_rgba(0,0,0,0.22)]')}>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-4xl">
              <p className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.3em]', mode === 'simple' ? 'border-slate-200 bg-[#eef6ff] text-cyan-700' : 'border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-100')}>Wizard operacional</p>
              <h2 className={cn('mt-5 text-3xl font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>{editingCampaignId ? 'Edite a campanha inteira pelo wizard.' : 'Configure a campanha inteira sem cair no modo advanced.'}</h2>
              <p className={cn('mt-3 text-sm leading-7', mode === 'simple' ? 'text-slate-600' : 'text-slate-400')}>{editingCampaignId ? 'O wizard reconstrui campanha, pipeline, agentes e regua para voce revisar e atualizar em um fluxo unico.' : 'O wizard monta pipeline, input, agentes, campanha e visualizacao da regua a partir do blueprint real.'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:w-[34rem]">{STEPS.map((step, index) => <Step key={step} label={step} index={index} active={activeStep === index} done={activeStep > index} />)}</div>
          </div>
        </section>

        {error ? <div className={cn('rounded-3xl border px-5 py-4 text-sm', mode === 'simple' ? 'border-rose-200 bg-rose-50 text-[#B91C1C]' : 'border-rose-400/20 bg-rose-500/10 text-rose-100')}>{error}</div> : null}
        {result ? <section className={cn('rounded-[30px] border p-6', mode === 'simple' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-50')}><p className={cn('text-[11px] uppercase tracking-[0.28em]', mode === 'simple' ? 'text-emerald-700/80' : 'text-emerald-200/80')}>{editingCampaignId ? 'Campanha atualizada' : 'Configuracao concluida'}</p><h3 className="mt-2 text-2xl font-semibold">{result.clientName}</h3><p className={cn('mt-2 text-sm', mode === 'simple' ? 'text-emerald-800/90' : 'text-emerald-100/90')}>Pipeline {result.pipeline.name} com {result.pipeline.stageCount} etapas, campanha {result.campaign.name} com {result.campaign.stepCount} passos e {result.agents.length} agentes.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/pipelines" className={cn('inline-flex items-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-medium', mode === 'simple' ? 'border-emerald-200 bg-white text-emerald-700' : 'border-emerald-200/20 bg-emerald-100/10 text-white')}>Abrir Kanban <ArrowRight className="h-4 w-4" /></Link><Link href="/workers" className={cn('inline-flex items-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-medium', mode === 'simple' ? 'border-emerald-200 bg-white text-emerald-700' : 'border-emerald-200/20 bg-emerald-100/10 text-white')}>Abrir Workers <ArrowRight className="h-4 w-4" /></Link><Link href="/campanhas" className={cn('inline-flex items-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-medium', mode === 'simple' ? 'border-emerald-200 bg-white text-emerald-700' : 'border-emerald-200/20 bg-emerald-100/10 text-white')}>Abrir Campanhas <ArrowRight className="h-4 w-4" /></Link></div></section> : null}

        <section className={cn('rounded-[30px] border p-6', mode === 'simple' ? 'border-slate-200 bg-[rgba(255,255,255,0.84)] shadow-[0_18px_44px_rgba(15,23,42,0.08)]' : 'border-white/[0.08] bg-[rgba(13,22,34,0.88)] shadow-[0_20px_72px_rgba(0,0,0,0.2)]')}>
          {isLoading ? (
            <div className="flex min-h-[28rem] items-center justify-center text-slate-400">
              <LoaderCircle className="mr-3 h-5 w-5 animate-spin" /> Carregando blueprint...
            </div>
          ) : initError ? (
            <div className="flex min-h-[28rem] flex-col items-center justify-center text-center">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className={cn('mb-2 text-xl font-bold', mode === 'simple' ? 'text-slate-900' : 'text-white')}>
                {initError}
              </h3>
              <p className={cn('max-w-md text-sm', mode === 'simple' ? 'text-slate-600' : 'text-slate-400')}>
                Essa campanha nao pode ser editada via Wizard. O Wizard e exclusivo para automacoes criadas diretamente por ele.
              </p>
              <Link
                href="/campanhas"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Voltar para Campanhas
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
            {activeStep === 0 ? <div className="grid gap-5 lg:grid-cols-2"><TextField label="Cliente / operacao" value={clientName} onChange={setClientName} mode={mode} /><TextField label="Nome da campanha" value={campaignName} onChange={setCampaignName} mode={mode} /><TextField label="Nome do pipeline" value={pipelineName} onChange={setPipelineName} mode={mode} /><label className="block lg:col-span-2"><span className={cn('mb-2 block text-sm font-medium', mode === 'simple' ? 'text-slate-700' : 'text-slate-200')}>Descricao</span><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={cn('w-full rounded-[18px] border px-4 py-3 text-sm outline-none focus:border-cyan-300/35', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-950' : 'border-white/[0.08] bg-white/[0.04] text-white')} /></label></div> : null}
            {activeStep === 1 ? <div className="grid gap-4 lg:grid-cols-2">{(['FORM', 'WHATSAPP'] as const).map((type) => <button key={type} type="button" onClick={() => setInputType(type)} className={cn('rounded-[26px] border p-6 text-left transition', inputType === type ? 'border-cyan-300/20 bg-cyan-300/[0.08]' : mode === 'simple' ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.03]')}><h3 className={cn('text-xl font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>{type === 'FORM' ? 'Formulario' : 'WhatsApp'}</h3><p className={cn('mt-2 text-sm leading-6', mode === 'simple' ? 'text-slate-600' : 'text-slate-400')}>{type === 'FORM' ? 'Capta leads via pagina publica.' : 'Recebe leads direto do canal e liga o piloto automatico.'}</p></button>)}</div> : null}
            {activeStep === 2 && inputType === 'FORM' ? (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  <TextField label="Nome do formulario" value={formName} onChange={setFormName} mode={mode} />
                  <TextField label="Headline" value={formHeadline} onChange={setFormHeadline} mode={mode} />
                </div>

                <label className="block">
                  <span className={cn('mb-2 block text-sm font-medium', mode === 'simple' ? 'text-slate-700' : 'text-slate-200')}>Descricao do formulario</span>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className={cn('w-full rounded-[18px] border px-4 py-3 text-sm outline-none focus:border-cyan-300/35', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-950' : 'border-white/[0.08] bg-white/[0.04] text-white')}
                  />
                </label>

                <div className={cn('rounded-[24px] border p-5', mode === 'simple' ? 'border-slate-200 bg-[#f8fbff]' : 'border-white/[0.08] bg-white/[0.03]')}>
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-2xl">
                      <p className={cn('text-sm font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>Builder rapido no wizard</p>
                      <p className={cn('mt-1 text-sm leading-6', mode === 'simple' ? 'text-slate-600' : 'text-slate-400')}>
                        Aqui voce monta o formulario essencial: adicionar, duplicar, remover e ordenar campos. Para visualizador completo e formularios mais complexos, use o modo advanced.
                      </p>
                    </div>
                    <Link
                      href="/formularios"
                      className={cn(
                        'inline-flex items-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-medium',
                        mode === 'simple' ? 'border-slate-200 bg-white text-slate-700' : 'border-white/[0.08] bg-white/[0.04] text-slate-100',
                      )}
                    >
                      <LayoutTemplate className="h-4 w-4" />
                      Abrir builder advanced
                    </Link>
                  </div>

                  <div className="mt-5 grid gap-3 xl:grid-cols-5">
                    {FIELD_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => addFieldFromPreset(preset.id)}
                        className={cn(
                          'rounded-[20px] border px-4 py-4 text-left transition',
                          mode === 'simple' ? 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-cyan-50/50' : 'border-white/[0.08] bg-white/[0.04]',
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={cn('text-sm font-semibold', mode === 'simple' ? 'text-slate-900' : 'text-white')}>{preset.label}</span>
                          <Plus className={cn('h-4 w-4', mode === 'simple' ? 'text-cyan-600' : 'text-cyan-100')} />
                        </div>
                        <p className={cn('mt-2 text-xs leading-5', mode === 'simple' ? 'text-slate-500' : 'text-slate-400')}>{preset.description}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_22rem]">
                  <div className="space-y-3">
                    {formFields.map((field, index) => (
                      <div key={field.id} className={cn('rounded-[22px] border p-4', mode === 'simple' ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-black/10')}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className={cn('text-sm font-semibold', mode === 'simple' ? 'text-slate-900' : 'text-white')}>{field.label || `Campo ${index + 1}`}</p>
                            <p className={cn('mt-1 text-xs uppercase tracking-[0.24em]', mode === 'simple' ? 'text-slate-500' : 'text-slate-400')}>
                              {FIELD_TYPES.find((item) => item.value === field.type)?.label ?? field.type}
                              {field.required ? ' · obrigatorio' : ' · opcional'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => moveField(field.id, -1)} disabled={index === 0} className={cn('rounded-[14px] border p-2 disabled:opacity-40', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/[0.08] bg-white/[0.04] text-slate-200')}><ArrowUp className="h-4 w-4" /></button>
                            <button type="button" onClick={() => moveField(field.id, 1)} disabled={index === formFields.length - 1} className={cn('rounded-[14px] border p-2 disabled:opacity-40', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/[0.08] bg-white/[0.04] text-slate-200')}><ArrowDown className="h-4 w-4" /></button>
                            <button type="button" onClick={() => duplicateField(field.id)} className={cn('rounded-[14px] border p-2', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/[0.08] bg-white/[0.04] text-slate-200')}><Copy className="h-4 w-4" /></button>
                            <button type="button" onClick={() => setFormFields((current) => current.filter((item) => item.id !== field.id))} className={cn('rounded-[14px] border px-3 py-2 text-sm font-medium', mode === 'simple' ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-rose-400/20 bg-rose-500/10 text-rose-100')}>Remover</button>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <TextField label="Label" value={field.label} onChange={(value) => updateFormField(field.id, { label: value, key: makeUniqueToken(value, formFields.filter((item) => item.id !== field.id).map((item) => item.key)) })} mode={mode} />
                          <label className="block">
                            <span className={cn('mb-2 block text-sm font-medium', mode === 'simple' ? 'text-slate-700' : 'text-slate-200')}>Tipo</span>
                            <select
                              value={field.type}
                              onChange={(e) => updateFormField(field.id, { type: e.target.value as LeadFormFieldType })}
                              className={cn('h-12 w-full rounded-[18px] border px-4 text-sm outline-none', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-950' : 'border-white/[0.08] bg-white/[0.04] text-white')}
                            >
                              {FIELD_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                  {type.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <TextField label="Placeholder" value={field.placeholder ?? ''} onChange={(value) => updateFormField(field.id, { placeholder: value })} mode={mode} />
                          <label className="block">
                            <span className={cn('mb-2 block text-sm font-medium', mode === 'simple' ? 'text-slate-700' : 'text-slate-200')}>Mapeamento</span>
                            <select
                              value={field.mapTo ?? 'custom'}
                              onChange={(e) => updateFormField(field.id, { mapTo: e.target.value as LeadFormFieldMap })}
                              className={cn('h-12 w-full rounded-[18px] border px-4 text-sm outline-none', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-950' : 'border-white/[0.08] bg-white/[0.04] text-white')}
                            >
                              {FIELD_MAPS.map((map) => (
                                <option key={map.value} value={map.value}>
                                  {map.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className="mt-3 flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(field.required)}
                            onChange={(e) => updateFormField(field.id, { required: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span className={mode === 'simple' ? 'text-slate-700' : 'text-slate-200'}>Campo obrigatorio</span>
                        </label>

                        {field.type === 'select' ? (
                          <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-slate-800">Opcoes da selecao</p>
                              <button type="button" onClick={() => addSelectOption(field.id)} className="inline-flex items-center gap-2 rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                                <Plus className="h-4 w-4" />
                                Adicionar opcao
                              </button>
                            </div>
                            <div className="mt-3 space-y-3">
                              {(field.options ?? []).map((option, optionIndex) => (
                                <div key={`${field.id}-option-${optionIndex}`} className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                                  <TextField label="Label da opcao" value={option.label} onChange={(value) => updateSelectOption(field.id, optionIndex, { label: value })} mode="simple" />
                                  <TextField label="Valor" value={option.value} onChange={(value) => updateSelectOption(field.id, optionIndex, { value })} mode="simple" />
                                  <button type="button" onClick={() => removeSelectOption(field.id, optionIndex)} className="self-end rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-medium text-rose-600">
                                    Remover
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className={cn('h-fit rounded-[24px] border p-5', mode === 'simple' ? 'border-slate-200 bg-[#fbfdff]' : 'border-white/[0.08] bg-white/[0.03]')}>
                    <div className="flex items-center gap-2">
                      <Eye className={cn('h-4 w-4', mode === 'simple' ? 'text-cyan-600' : 'text-cyan-100')} />
                      <p className={cn('text-sm font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>Preview rapido</p>
                    </div>
                    <div className="mt-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-700">Lead form</p>
                      <h3 className="mt-3 text-xl font-semibold text-slate-950">{formHeadline || formName || 'Seu formulario'}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{formDescription || 'Descreva o valor desta captacao.'}</p>
                      <div className="mt-5 space-y-4">
                        {formFields.map((field) => (
                          <div key={`preview-${field.id}`} className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {field.label}
                              {field.required ? ' *' : ''}
                            </label>
                            {field.type === 'textarea' ? (
                              <textarea readOnly rows={4} placeholder={field.placeholder} className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none" />
                            ) : field.type === 'select' ? (
                              <select disabled className="h-12 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 text-sm text-slate-500 outline-none">
                                <option>Selecione</option>
                                {(field.options ?? []).map((option) => (
                                  <option key={`${field.id}-${option.value}`} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input readOnly type="text" placeholder={field.placeholder} className="h-12 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 text-sm text-slate-500 outline-none" />
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button" className="mt-5 inline-flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#5bd0ff,#83f4c3)] px-4 py-3 text-sm font-semibold text-slate-950">
                        Enviar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {activeStep === 2 && inputType === 'WHATSAPP' ? (
              <div className="space-y-5">
                <div className={cn('rounded-[24px] border p-5', mode === 'simple' ? 'border-slate-200 bg-[#f8fbff]' : 'border-white/[0.08] bg-white/[0.03]')}>
                  <p className={cn('text-sm font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>Canal de entrada do funil</p>
                  <p className={cn('mt-1 text-sm leading-6', mode === 'simple' ? 'text-slate-600' : 'text-slate-400')}>
                    Este canal fica vinculado ao pipeline criado pelo wizard. Novos inbounds entram pela etapa inicial deste funil.
                  </p>
                </div>

                <label className="block">
                  <span className={cn('mb-2 block text-sm font-medium', mode === 'simple' ? 'text-slate-700' : 'text-slate-200')}>Conta WhatsApp</span>
                  <select
                    value={selectedWhatsAppAccountId}
                    onChange={(e) => setSelectedWhatsAppAccountId(e.target.value)}
                    className={cn('h-12 w-full rounded-[18px] border px-4 text-sm outline-none', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-950' : 'border-white/[0.08] bg-white/[0.04] text-white')}
                  >
                    <option value="">Criar nova conta para este funil</option>
                    {availableWhatsAppAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.phoneNumber || account.instanceName || account.id} · {account.provider}
                        {account.assignedPipelineName ? ` · vinculada a ${account.assignedPipelineName}` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedWhatsAppAccount?.assignedPipelineName && selectedWhatsAppAccount.assignedPipelineId !== existingPipelineId ? (
                  <div className={cn('rounded-[20px] border p-4 text-sm leading-6', mode === 'simple' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-amber-300/15 bg-amber-300/10 text-amber-100')}>
                    Essa conta ja esta vinculada ao pipeline {selectedWhatsAppAccount.assignedPipelineName}. Ao salvar, o vinculo sera movido para este funil.
                  </div>
                ) : null}

                <div className="grid gap-5 lg:grid-cols-2">
                  <label className="block">
                    <span className={cn('mb-2 block text-sm font-medium', mode === 'simple' ? 'text-slate-700' : 'text-slate-200')}>Provider</span>
                    <select
                      value={whatsProvider}
                      onChange={(e) => setWhatsProvider(e.target.value as 'meta_cloud' | 'evolution')}
                      className={cn('h-12 w-full rounded-[18px] border px-4 text-sm outline-none', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-950' : 'border-white/[0.08] bg-white/[0.04] text-white')}
                    >
                      <option value="evolution">Evolution API</option>
                      <option value="meta_cloud">Meta Cloud API</option>
                    </select>
                  </label>
                  <TextField label="Numero principal" value={whatsPhone} onChange={setWhatsPhone} mode={mode} />
                  {whatsProvider === 'evolution' ? <TextField label="Nome da instance" value={whatsInstanceName} onChange={setWhatsInstanceName} mode={mode} /> : null}
                  {whatsProvider === 'meta_cloud' ? (
                    <>
                      <TextField label="Phone Number ID" value={whatsPhoneId} onChange={setWhatsPhoneId} mode={mode} />
                      <TextField label="WABA ID" value={whatsWabaId} onChange={setWhatsWabaId} mode={mode} />
                      <TextField label="Access token" value={whatsAccessToken} onChange={setWhatsAccessToken} mode={mode} />
                    </>
                  ) : null}
                </div>

                <div className={cn('rounded-[20px] border p-4 text-sm leading-6', mode === 'simple' ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-cyan-300/15 bg-cyan-300/10 text-cyan-100')}>
                  O wizard vincula uma conta por pipeline. Isso permite operar funis diferentes com canais e empresas diferentes dentro do mesmo tenant.
                </div>
              </div>
            ) : null}
            {activeStep === 3 ? (
              <div className="space-y-5">
                <div className={cn('rounded-[24px] border p-5', mode === 'simple' ? 'border-slate-200 bg-[#f8fbff]' : 'border-white/[0.08] bg-white/[0.03]')}>
                  <p className={cn('text-sm font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>Selecione o agente por etapa</p>
                  <p className={cn('mt-1 text-sm leading-6', mode === 'simple' ? 'text-slate-600' : 'text-slate-400')}>
                    Cada etapa pode usar um agente existente como base. O wizard copia nome e instrucoes do agente escolhido para essa campanha, e voce ainda pode personalizar o comportamento antes de salvar.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {agents.map((agent, index) => {
                    const suggestions = suggestedAgentsByStage[agent.stageKey] ?? [];
                    return (
                      <div key={agent.stageKey} className={cn('rounded-[26px] border p-5', mode === 'simple' ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.03]')}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{rule[index]?.stageName}</p>
                            <p className={cn('mt-2 text-sm', mode === 'simple' ? 'text-slate-600' : 'text-slate-400')}>{rule[index]?.objective ?? 'Sem objetivo definido.'}</p>
                          </div>
                          {agent.selectedTemplateId ? (
                            <span className={cn('rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.22em]', mode === 'simple' ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100')}>
                              Agente selecionado
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-4 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => applyAgentTemplate(agent.stageKey, null)}
                              className={cn(
                                'rounded-[16px] border px-3 py-2 text-sm font-medium',
                                !agent.selectedTemplateId
                                  ? mode === 'simple'
                                    ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                    : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
                                  : mode === 'simple'
                                    ? 'border-slate-200 bg-slate-50 text-slate-600'
                                    : 'border-white/[0.08] bg-white/[0.04] text-slate-200',
                              )}
                            >
                              Usar configuracao custom
                            </button>
                            {suggestions.slice(0, 4).map((template) => (
                              <button
                                key={template.id}
                                type="button"
                                onClick={() => applyAgentTemplate(agent.stageKey, template)}
                                className={cn(
                                  'rounded-[16px] border px-3 py-2 text-sm font-medium',
                                  agent.selectedTemplateId === template.id
                                    ? mode === 'simple'
                                      ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                      : 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
                                    : mode === 'simple'
                                      ? 'border-slate-200 bg-slate-50 text-slate-700'
                                      : 'border-white/[0.08] bg-white/[0.04] text-slate-200',
                                )}
                              >
                                {template.name}
                              </button>
                            ))}
                          </div>

                          {suggestions.length > 0 ? (
                            <div className="grid gap-3">
                              {suggestions.slice(0, 3).map((template) => (
                                <button
                                  key={`${agent.stageKey}-${template.id}-card`}
                                  type="button"
                                  onClick={() => applyAgentTemplate(agent.stageKey, template)}
                                  className={cn(
                                    'rounded-[20px] border p-4 text-left transition',
                                    agent.selectedTemplateId === template.id
                                      ? mode === 'simple'
                                        ? 'border-cyan-200 bg-cyan-50/70'
                                        : 'border-cyan-300/20 bg-cyan-300/10'
                                      : mode === 'simple'
                                        ? 'border-slate-200 bg-slate-50/70 hover:bg-slate-50'
                                        : 'border-white/[0.08] bg-white/[0.04]',
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <p className={cn('text-sm font-semibold', mode === 'simple' ? 'text-slate-900' : 'text-white')}>{template.name}</p>
                                    <span className={cn('rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]', mode === 'simple' ? 'border-slate-200 bg-white text-slate-500' : 'border-white/[0.08] bg-white/[0.05] text-slate-400')}>
                                      {template.stage?.name ?? 'Template geral'}
                                    </span>
                                  </div>
                                  <p className={cn('mt-2 text-sm leading-6', mode === 'simple' ? 'text-slate-600' : 'text-slate-400')}>
                                    {(template.profile && typeof template.profile === 'object' && 'objective' in template.profile && typeof template.profile.objective === 'string'
                                      ? template.profile.objective
                                      : template.systemPrompt
                                    ).slice(0, 180)}
                                  </p>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className={cn('rounded-[18px] border p-4 text-sm leading-6', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-white/[0.08] bg-white/[0.04] text-slate-300')}>
                              Nenhum agente parecido foi encontrado para esta etapa. Voce pode configurar um agente custom abaixo.
                            </div>
                          )}
                        </div>

                        <TextField label="Nome do agente" value={agent.name} onChange={(value) => setAgents((current) => current.map((item) => item.stageKey === agent.stageKey ? { ...item, name: value } : item))} mode={mode} />
                        <label className="mt-4 block">
                          <span className={cn('mb-2 block text-sm font-medium', mode === 'simple' ? 'text-slate-700' : 'text-slate-200')}>O que ele faz</span>
                          <textarea rows={6} value={agent.systemPrompt} onChange={(e) => setAgents((current) => current.map((item) => item.stageKey === agent.stageKey ? { ...item, systemPrompt: e.target.value } : item))} className={cn('w-full rounded-[18px] border px-4 py-3 text-sm outline-none focus:border-cyan-300/35', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-950' : 'border-white/[0.08] bg-white/[0.04] text-white')} />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {activeStep === 4 ? <div className="space-y-5"><div className={cn('rounded-[26px] border p-5', mode === 'simple' ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.03]')}><p className={cn('text-sm font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>Regua por etapas</p><p className={cn('mt-1 text-sm', mode === 'simple' ? 'text-slate-600' : 'text-slate-400')}>Cada caixa representa uma etapa. O botao de configuracao abre o painel lateral para revisar timing e template.</p></div><div className="overflow-x-auto"><div className="flex min-w-max items-start gap-4 pb-2">{rule.map((stage, index) => <div key={stage.stageKey} className="flex items-center gap-4"><button type="button" onClick={() => setSelectedStageKey(stage.stageKey)} className={cn('w-[19rem] rounded-[28px] border p-5 text-left transition', selectedStageKey === stage.stageKey ? 'border-cyan-300/25 bg-cyan-300/[0.08]' : mode === 'simple' ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.03]')}><div className="flex items-center justify-between gap-3"><div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border text-cyan-100', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-cyan-600' : 'border-white/[0.08] bg-white/[0.04]')}><Workflow className="h-5 w-5" /></div><span className={cn('rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em]', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-white/[0.08] bg-white/[0.04] text-slate-300')}>{stage.tasks.length} acoes</span></div><h3 className={cn('mt-4 text-xl font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>{stage.stageName}</h3><p className={cn('mt-2 text-sm leading-6', mode === 'simple' ? 'text-slate-600' : 'text-slate-400')}>{stage.objective ?? stage.description ?? 'Sem objetivo definido.'}</p><div className="mt-4 flex items-center justify-between text-sm"><span className={cn(mode === 'simple' ? 'text-slate-700' : 'text-slate-300')}>Configurar etapa</span><Settings2 className={cn('h-4 w-4', mode === 'simple' ? 'text-cyan-600' : 'text-cyan-100')} /></div></button>{index < rule.length - 1 ? <ChevronRight className="h-5 w-5 text-slate-500" /> : null}</div>)}</div></div></div> : null}
            <div className={cn('flex items-center justify-between border-t pt-6', mode === 'simple' ? 'border-slate-200' : 'border-white/[0.08]')}><button type="button" disabled={activeStep === 0} onClick={() => setActiveStep((current) => Math.max(current - 1, 0))} className={cn('inline-flex items-center gap-2 rounded-[18px] border px-4 py-3 text-sm font-medium disabled:opacity-50', mode === 'simple' ? 'border-slate-200 bg-white text-slate-700' : 'border-white/[0.08] bg-white/[0.04] text-slate-100')}><ChevronLeft className="h-4 w-4" /> Voltar</button>{activeStep < STEPS.length - 1 ? <button type="button" disabled={!canGoNext} onClick={() => setActiveStep((current) => Math.min(current + 1, STEPS.length - 1))} className="inline-flex items-center gap-2 rounded-[18px] bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">Proximo <ChevronRight className="h-4 w-4" /></button> : <button type="button" disabled={!canGoNext || isSaving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#5bd0ff,#83f4c3)] px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">{isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} {editingCampaignId ? 'Atualizar campanha' : 'Salvar campanha'}</button>}</div>
          </div>
          )}
        </section>
      </div>

      <div className={cn('pointer-events-none fixed inset-0 z-40 transition', selectedStage ? 'opacity-100' : 'opacity-0')}>
        <div className={cn('absolute inset-0 bg-slate-950/30 transition', selectedStage ? 'pointer-events-auto' : '')} onClick={() => setSelectedStageKey(null)} />
        <aside className={cn('pointer-events-auto absolute right-0 top-0 h-full w-full max-w-[34rem] border-l border-white/10 bg-[rgba(245,248,252,0.98)] shadow-[-24px_0_64px_rgba(15,23,42,0.18)] transition duration-300', selectedStage ? 'translate-x-0' : 'translate-x-full')}>
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5"><div><p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Config da etapa</p><h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedStage?.stageName ?? ''}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{selectedStage?.objective ?? selectedStage?.description ?? ''}</p></div><button type="button" onClick={() => setSelectedStageKey(null)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500"><X className="h-4 w-4" /></button></div>
            <div className="flex-1 overflow-y-auto px-6 py-6">{selectedStage ? <div className="space-y-4">{selectedStage.tasks.map((task, taskIndex) => <div key={`${selectedStage.stageKey}-${taskIndex}`} className="rounded-[24px] border border-slate-200 bg-white p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{task.tipo ?? `Acao ${taskIndex + 1}`}</p><span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">{task.canal ?? 'Canal livre'}</span></div><label className="mt-4 block"><span className="mb-2 block text-sm font-medium text-slate-700">Timing</span><input value={(task.timing as string | undefined) ?? ''} onChange={(e) => setRule((current) => current.map((stage) => stage.stageKey === selectedStage.stageKey ? { ...stage, tasks: stage.tasks.map((stageTask, stageTaskIndex) => stageTaskIndex === taskIndex ? { ...stageTask, timing: e.target.value } : stageTask) } : stage))} className="h-11 w-full rounded-[16px] border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none" /></label><label className="mt-4 block"><span className="mb-2 block text-sm font-medium text-slate-700">Template</span><textarea rows={5} value={(task.template as string | undefined) ?? ''} onChange={(e) => setRule((current) => current.map((stage) => stage.stageKey === selectedStage.stageKey ? { ...stage, tasks: stage.tasks.map((stageTask, stageTaskIndex) => stageTaskIndex === taskIndex ? { ...stageTask, template: e.target.value } : stageTask) } : stage))} className="w-full rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none" /></label></div>)}</div> : null}</div>
          </div>
        </aside>
      </div>
    </>
  );
}
