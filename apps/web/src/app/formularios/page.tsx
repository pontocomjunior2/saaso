'use client';

import api from '@/lib/api';
import { useAppSession } from '@/components/layout/SessionProvider';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  FileText,
  GripVertical,
  LayoutTemplate,
  ListChecks,
  LoaderCircle,
  Mail,
  MessageSquare,
  PanelTopOpen,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Trash2,
} from 'lucide-react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import {
  LeadForm,
  LeadFormAnalytics,
  LeadFormDraft,
  LeadFormField,
  LeadFormFieldMap,
  LeadFormFieldOption,
  LeadFormFieldType,
  useLeadFormStore,
} from '../../stores/useLeadFormStore';

interface PipelineOption {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
  }>;
}

interface FieldPreset {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  field: LeadFormField;
}

type BuilderSelection =
  | { type: 'form' }
  | { type: 'field'; fieldId: string }
  | { type: 'button' };

const LIBRARY_DROPPABLE_ID = 'lead-form-library';
const CANVAS_DROPPABLE_ID = 'lead-form-canvas';

const FIELD_TYPES: Array<{ value: LeadFormFieldType; label: string }> = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'email', label: 'E-mail' },
  { value: 'phone', label: 'Telefone' },
  { value: 'select', label: 'Selecao' },
];

const FIELD_MAPS: Array<{ value: LeadFormFieldMap; label: string }> = [
  { value: 'name', label: 'Nome do contato' },
  { value: 'email', label: 'E-mail do contato' },
  { value: 'phone', label: 'Telefone do contato' },
  { value: 'position', label: 'Cargo do contato' },
  { value: 'companyName', label: 'Nome da empresa' },
  { value: 'cardTitle', label: 'Titulo do card' },
  { value: 'custom', label: 'Campo customizado' },
];

const FIELD_TYPE_LABELS: Record<LeadFormFieldType, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  email: 'E-mail',
  phone: 'Telefone',
  select: 'Selecao',
};

const FIELD_MAP_LABELS: Record<LeadFormFieldMap, string> = {
  name: 'Nome do contato',
  email: 'E-mail do contato',
  phone: 'Telefone do contato',
  position: 'Cargo do contato',
  companyName: 'Nome da empresa',
  cardTitle: 'Titulo do card',
  custom: 'Campo customizado',
};

const DEFAULT_OPTION: LeadFormFieldOption = {
  label: 'Opcao',
  value: 'opcao',
};

const DEFAULT_FIELD: LeadFormField = {
  id: 'nome',
  key: 'nome',
  label: 'Nome',
  type: 'text',
  required: true,
  mapTo: 'name',
  placeholder: 'Seu nome',
  helpText: '',
  options: [],
};

const DEFAULT_DRAFT: LeadFormDraft = {
  name: '',
  slug: '',
  headline: '',
  description: '',
  submitButtonLabel: 'Enviar',
  successTitle: 'Cadastro recebido',
  successMessage: 'Recebemos seus dados e seguiremos com o atendimento.',
  isActive: true,
  stageId: '',
  fields: [
    DEFAULT_FIELD,
    {
      id: 'email',
      key: 'email',
      label: 'E-mail',
      type: 'email',
      required: true,
      mapTo: 'email',
      placeholder: 'voce@empresa.com',
      helpText: '',
      options: [],
    },
  ],
};

const FIELD_PRESETS: FieldPreset[] = [
  {
    id: 'name',
    label: 'Nome',
    description: 'Identificacao principal do lead.',
    icon: FileText,
    field: DEFAULT_FIELD,
  },
  {
    id: 'email',
    label: 'E-mail',
    description: 'Canal principal para follow-up.',
    icon: Mail,
    field: {
      id: 'email',
      key: 'email',
      label: 'E-mail',
      type: 'email',
      required: true,
      mapTo: 'email',
      placeholder: 'voce@empresa.com',
      helpText: '',
      options: [],
    },
  },
  {
    id: 'phone',
    label: 'Telefone',
    description: 'Pronto para WhatsApp ou ligacao.',
    icon: Phone,
    field: {
      id: 'telefone',
      key: 'telefone',
      label: 'Telefone',
      type: 'phone',
      required: false,
      mapTo: 'phone',
      placeholder: '(11) 99999-9999',
      helpText: '',
      options: [],
    },
  },
  {
    id: 'company',
    label: 'Empresa',
    description: 'Qualifica melhor o lead B2B.',
    icon: LayoutTemplate,
    field: {
      id: 'empresa',
      key: 'empresa',
      label: 'Empresa',
      type: 'text',
      required: false,
      mapTo: 'companyName',
      placeholder: 'Nome da empresa',
      helpText: '',
      options: [],
    },
  },
  {
    id: 'position',
    label: 'Cargo',
    description: 'Entende o papel do contato.',
    icon: PanelTopOpen,
    field: {
      id: 'cargo',
      key: 'cargo',
      label: 'Cargo',
      type: 'text',
      required: false,
      mapTo: 'position',
      placeholder: 'Ex.: Diretor comercial',
      helpText: '',
      options: [],
    },
  },
  {
    id: 'message',
    label: 'Mensagem',
    description: 'Campo aberto para contexto.',
    icon: MessageSquare,
    field: {
      id: 'mensagem',
      key: 'mensagem',
      label: 'Mensagem',
      type: 'textarea',
      required: false,
      mapTo: 'custom',
      placeholder: 'Conte um pouco do que voce precisa',
      helpText: '',
      options: [],
    },
  },
  {
    id: 'select',
    label: 'Selecao',
    description: 'Bom para triagem inicial.',
    icon: ListChecks,
    field: {
      id: 'selecao',
      key: 'selecao',
      label: 'Selecione uma opcao',
      type: 'select',
      required: false,
      mapTo: 'custom',
      placeholder: '',
      helpText: '',
      options: [
        { label: 'Opcao 1', value: 'opcao_1' },
        { label: 'Opcao 2', value: 'opcao_2' },
      ],
    },
  },
];

function isRecent(dateStr: string, hours: number): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  return now.getTime() - date.getTime() < hours * 60 * 60 * 1000;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cloneField(field: LeadFormField): LeadFormField {
  return {
    ...field,
    placeholder: field.placeholder ?? '',
    helpText: field.helpText ?? '',
    options: [...(field.options ?? [])],
  };
}

function cloneDraft(draft?: Partial<LeadFormDraft>): LeadFormDraft {
  return {
    ...DEFAULT_DRAFT,
    ...draft,
    slug: draft?.slug ?? '',
    headline: draft?.headline ?? '',
    description: draft?.description ?? '',
    submitButtonLabel: draft?.submitButtonLabel ?? 'Enviar',
    successTitle: draft?.successTitle ?? 'Cadastro recebido',
    successMessage: draft?.successMessage ?? 'Recebemos seus dados e seguiremos com o atendimento.',
    isActive: draft?.isActive ?? true,
    stageId: draft?.stageId ?? '',
    fields: (draft?.fields ?? DEFAULT_DRAFT.fields).map(cloneField),
  };
}

function draftFromForm(form: LeadForm) {
  return cloneDraft({
    name: form.name,
    slug: form.slug,
    headline: form.headline ?? '',
    description: form.description ?? '',
    submitButtonLabel: form.submitButtonLabel ?? 'Enviar',
    successTitle: form.successTitle ?? 'Cadastro recebido',
    successMessage: form.successMessage ?? 'Recebemos seus dados e seguiremos com o atendimento.',
    isActive: form.isActive,
    stageId: form.stageId,
    fields: form.fields,
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Sem dados';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
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

function createFieldFromPreset(preset: FieldPreset, existingFields: LeadFormField[]) {
  return {
    ...cloneField(preset.field),
    id: makeUniqueToken(preset.field.id, existingFields.map((field) => field.id)),
    key: makeUniqueToken(preset.field.key, existingFields.map((field) => field.key)),
  };
}

function reorderFields(fields: LeadFormField[], startIndex: number, endIndex: number) {
  const next = fields.map(cloneField);
  const [removed] = next.splice(startIndex, 1);
  next.splice(endIndex, 0, removed);
  return next;
}

function getPresetByDraggableId(draggableId: string) {
  const presetId = draggableId.replace('preset-', '');
  return FIELD_PRESETS.find((preset) => preset.id === presetId);
}

function StepCard({
  index,
  title,
  description,
  done,
}: {
  index: number;
  title: string;
  description: string;
  done: boolean;
}) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,22,38,0.94),rgba(7,14,26,0.96))] p-5 shadow-[0_20px_56px_rgba(0,0,0,0.22)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Passo {index}</p>
          <h3 className="mt-3 text-base font-semibold text-white">{title}</h3>
        </div>
        <div
          className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${
            done ? 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-white/[0.05] text-slate-400'
          }`}
        >
          {done ? <CheckCircle2 className="h-4.5 w-4.5" /> : <ChevronRight className="h-4.5 w-4.5" />}
        </div>
      </div>
      <p className="mt-3 text-sm leading-7 text-slate-400">{description}</p>
    </div>
  );
}

function PreviewField({ field }: { field: LeadFormField }) {
  if (field.type === 'textarea') {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          {field.label}
          {field.required ? ' *' : ''}
        </label>
        <textarea
          rows={4}
          readOnly
          placeholder={field.placeholder}
          className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
        />
        {field.helpText ? <p className="text-xs text-slate-500">{field.helpText}</p> : null}
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          {field.label}
          {field.required ? ' *' : ''}
        </label>
        <select className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none">
          <option>Selecione</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {field.helpText ? <p className="text-xs text-slate-500">{field.helpText}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">
        {field.label}
        {field.required ? ' *' : ''}
      </label>
      <input
        readOnly
        placeholder={field.placeholder}
        className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
      />
      {field.helpText ? <p className="text-xs text-slate-500">{field.helpText}</p> : null}
    </div>
  );
}

export default function FormsPage() {
  const { tenantSlug } = useAppSession();
  const {
    forms,
    analyticsByFormId,
    isLoading,
    analyticsLoadingFormId,
    analyticsError,
    fetchForms,
    fetchFormAnalytics,
    createForm,
    updateForm,
    deleteForm,
  } = useLeadFormStore();

  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<BuilderSelection>({ type: 'form' });
  const [draft, setDraft] = useState<LeadFormDraft>(cloneDraft());
  const [origin, setOrigin] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    void fetchForms();
  }, [fetchForms]);

  useEffect(() => {
    let active = true;

    const loadPipelines = async () => {
      try {
        const response = await api.get<PipelineOption[]>('/pipelines');
        if (active) {
          setPipelines(response.data);
        }
      } catch {
        if (active) {
          setPipelines([]);
        }
      }
    };

    void loadPipelines();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (forms.length === 0) {
      setSelectedFormId(null);
      return;
    }

    if (selectedFormId && forms.some((form) => form.id === selectedFormId)) {
      return;
    }

    setSelectedFormId(forms[0].id);
    setDraft(draftFromForm(forms[0]));
    setSelectedBlock({ type: 'form' });
  }, [forms, selectedFormId]);

  useEffect(() => {
    if (selectedBlock.type === 'field' && !draft.fields.some((field) => field.id === selectedBlock.fieldId)) {
      setSelectedBlock({ type: 'form' });
    }
  }, [draft.fields, selectedBlock]);

  const selectedForm = useMemo(() => forms.find((form) => form.id === selectedFormId) ?? null, [forms, selectedFormId]);
  const selectedAnalytics = useMemo<LeadFormAnalytics | null>(
    () => (selectedFormId ? analyticsByFormId[selectedFormId] ?? null : null),
    [analyticsByFormId, selectedFormId],
  );
  const selectedField =
    selectedBlock.type === 'field' ? draft.fields.find((field) => field.id === selectedBlock.fieldId) ?? null : null;
  const selectedFieldIndex = selectedField ? draft.fields.findIndex((field) => field.id === selectedField.id) : -1;

  const selectedStageLabel = useMemo(() => {
    for (const pipeline of pipelines) {
      const stage = pipeline.stages.find((item) => item.id === draft.stageId);
      if (stage) {
        return `${pipeline.name} / ${stage.name}`;
      }
    }

    return 'Nenhuma etapa selecionada';
  }, [draft.stageId, pipelines]);

  const publicUrl = useMemo(() => {
    const slug = draft.slug?.trim() || slugify(draft.name);
    if (!slug || !tenantSlug || !origin) {
      return '';
    }

    return `${origin}/f/${tenantSlug}/${slug}`;
  }, [draft.name, draft.slug, origin, tenantSlug]);

  const embedSnippet = useMemo(() => {
    if (!publicUrl) {
      return '';
    }

    return [
      '<iframe',
      `  src="${publicUrl}"`,
      '  width="100%"',
      '  height="860"',
      '  frameborder="0"',
      '  sandbox="allow-scripts allow-same-origin allow-forms"',
      `  title="${draft.name || 'Formulario Saaso'}"`,
      '  style="border:0;border-radius:24px;overflow:hidden;"',
      '></iframe>',
    ].join('\n');
  }, [draft.name, publicUrl]);

  const postMessageProtocolDoc = useMemo(() => {
    return [
      'postMessage Protocol Documentation',
      '====================================',
      '',
      'Events emitted from the embedded form iframe to the parent window:',
      '',
      '1. saaso:form-resize',
      '   { type: "saaso:form-resize", height: number }',
      '   Sent when form content height changes (dynamic fields, validation errors).',
      '   Parent should update iframe height: iframe.style.height = data.height + "px"',
      '',
      '2. saaso:form-submitting',
      '   { type: "saaso:form-submitting" }',
      '   Sent when user clicks submit and form is being sent to the backend.',
      '   Parent can show a loading indicator.',
      '',
      '3. saaso:form-submitted',
      '   { type: "saaso:form-submitted", cardId?: string }',
      '   Sent when submission succeeds. cardId is included if a CRM card was created.',
      '   Parent can navigate away, show confirmation, or track conversion.',
      '',
      '4. saaso:form-error',
      '   { type: "saaso:form-error" }',
      '   Sent when submission fails (network error, rate limit, validation error).',
      '   Parent can show error UI or retry logic.',
      '',
      'Optional callback registration:',
      '  window.saasoFormCallbacks = {',
      '    onSubmitting: () => { console.log("Form submitting..."); },',
      '    onSubmit: (cardId) => { console.log("Submitted! Card:", cardId); },',
      '    onError: () => { console.log("Submission failed"); },',
      '  };',
    ].join('\n');
  }, []);

  const embedScriptSnippet = useMemo(() => {
    if (!publicUrl) {
      return '';
    }

    const slugValue = draft.slug?.trim() || slugify(draft.name) || 'lead-form';
    const containerId = `saaso-form-${slugValue}`;
    const embedUrl = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}embed=1`;
    const safeTitle = draft.name || 'Formulario Saaso';

    return [
      `<div id="${containerId}"></div>`,
      '<script>',
      '// Saaso Form Embed — postMessage protocol:',
      '// Events sent from iframe to parent:',
      '//   { type: "saaso:form-resize", height: number } — height changed',
      '//   { type: "saaso:form-submitting" } — form is submitting',
      '//   { type: "saaso:form-submitted", cardId?: string } — submission success',
      '//   { type: "saaso:form-error" } — submission failed',
      '// Optional callbacks: window.saasoFormCallbacks = { onSubmitting, onSubmit, onError }',
      '(function () {',
      `  var container = document.getElementById('${containerId}');`,
      '  if (!container) return;',
      `  var iframe = document.createElement('iframe');`,
      `  iframe.src = '${embedUrl}';`,
      `  iframe.title = '${safeTitle.replace(/'/g, "\\'")}';`,
      "  iframe.loading = 'lazy';",
      "  iframe.style.width = '100%';",
      "  iframe.style.minHeight = '720px';",
      "  iframe.style.border = '0';",
      "  iframe.style.borderRadius = '24px';",
      "  iframe.style.overflow = 'hidden';",
      "  iframe.style.background = 'transparent';",
      "  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');",
      "  iframe.referrerPolicy = 'strict-origin-when-cross-origin';",
      "  container.innerHTML = '';",
      '  container.appendChild(iframe);',
      '',
      '  function handleMessage(event) {',
      '    if (!event || !event.data) return;',
      '    if (event.source !== iframe.contentWindow) return;',
      '    var data = event.data;',
      '',
      '    // Height resize (all status events should trigger resize)',
      "    if (data.type === 'saaso:form-resize' && typeof data.height === 'number') {",
      "      iframe.style.height = Math.max(data.height, 520) + 'px';",
      '      return;',
      '    }',
      '',
      '    // Submission lifecycle events',
      '    var callbacks = window.saasoFormCallbacks || {};',
      '',
      "    if (data.type === 'saaso:form-submitting') {",
      '      iframe.style.height = Math.max(iframe.scrollHeight, 520) + \'px\';',
      '      if (typeof callbacks.onSubmitting === \'function\') callbacks.onSubmitting();',
      '      return;',
      '    }',
      '',
      "    if (data.type === 'saaso:form-submitted') {",
      '      setTimeout(function() {',
      "        iframe.style.height = Math.max(iframe.scrollHeight, 520) + 'px';",
      '      }, 100);',
      '      if (typeof callbacks.onSubmit === \'function\') callbacks.onSubmit(data.cardId);',
      '      return;',
      '    }',
      '',
      "    if (data.type === 'saaso:form-error') {",
      '      iframe.style.height = Math.max(iframe.scrollHeight, 520) + \'px\';',
      '      if (typeof callbacks.onError === \'function\') callbacks.onError();',
      '      return;',
      '    }',
      '  }',
      '',
      "  window.addEventListener('message', handleMessage);",
      '})();',
      '</script>',
    ].join('\n');
  }, [draft.name, draft.slug, publicUrl]);

  useEffect(() => {
    if (selectedFormId) {
      void fetchFormAnalytics(selectedFormId).catch(() => undefined);
    }
  }, [fetchFormAnalytics, selectedFormId]);

  const updateDraft = (patch: Partial<LeadFormDraft>) => {
    setDraft((current) => cloneDraft({ ...current, ...patch }));
  };

  const updateField = (fieldId: string, patch: Partial<LeadFormField>) => {
    setDraft((current) =>
      cloneDraft({
        ...current,
        fields: current.fields.map((field) =>
          field.id === fieldId
            ? { ...cloneField(field), ...patch, options: patch.options ?? field.options ?? [] }
            : cloneField(field),
        ),
      }),
    );
  };

  const insertFieldFromPreset = (presetId: string, destinationIndex?: number) => {
    const preset = FIELD_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    let createdFieldId = '';

    setDraft((current) => {
      const nextField = createFieldFromPreset(preset, current.fields);
      createdFieldId = nextField.id;
      const nextFields = current.fields.map(cloneField);
      const index = typeof destinationIndex === 'number' ? Math.min(Math.max(destinationIndex, 0), nextFields.length) : nextFields.length;
      nextFields.splice(index, 0, nextField);
      return cloneDraft({ ...current, fields: nextFields });
    });

    if (createdFieldId) {
      setSelectedBlock({ type: 'field', fieldId: createdFieldId });
    }
  };

  const duplicateField = (fieldId: string) => {
    let duplicatedId = '';

    setDraft((current) => {
      const index = current.fields.findIndex((field) => field.id === fieldId);
      if (index < 0) {
        return current;
      }

      const source = cloneField(current.fields[index]);
      const duplicated = {
        ...source,
        id: makeUniqueToken(source.id, current.fields.map((field) => field.id)),
        key: makeUniqueToken(source.key, current.fields.map((field) => field.key)),
        label: `${source.label} copia`,
      };
      duplicatedId = duplicated.id;
      const nextFields = current.fields.map(cloneField);
      nextFields.splice(index + 1, 0, duplicated);
      return cloneDraft({ ...current, fields: nextFields });
    });

    if (duplicatedId) {
      setSelectedBlock({ type: 'field', fieldId: duplicatedId });
    }
  };

  const removeField = (fieldId: string) => {
    setDraft((current) =>
      cloneDraft({
        ...current,
        fields: current.fields.filter((field) => field.id !== fieldId),
      }),
    );
  };

  const addOption = (fieldId: string) => {
    const field = draft.fields.find((item) => item.id === fieldId);
    updateField(fieldId, { options: [...(field?.options ?? []), DEFAULT_OPTION] });
  };

  const updateOption = (fieldId: string, optionIndex: number, patch: Partial<LeadFormFieldOption>) => {
    const field = draft.fields.find((item) => item.id === fieldId);
    const options = (field?.options ?? []).map((option, index) => (index === optionIndex ? { ...option, ...patch } : option));
    updateField(fieldId, { options });
  };

  const removeOption = (fieldId: string, optionIndex: number) => {
    const field = draft.fields.find((item) => item.id === fieldId);
    const options = (field?.options ?? []).filter((_, index) => index !== optionIndex);
    updateField(fieldId, { options });
  };

  const copyText = async (value: string) => {
    if (!value || typeof window === 'undefined' || !window.navigator.clipboard) {
      return;
    }

    await window.navigator.clipboard.writeText(value);
  };

  const refreshAnalytics = () => {
    if (selectedFormId) {
      void fetchFormAnalytics(selectedFormId).catch(() => undefined);
    }
  };

  const openNewForm = () => {
    const defaultStageId = pipelines[0]?.stages[0]?.id ?? '';
    setSelectedFormId(null);
    setSelectedBlock({ type: 'form' });
    setDraft(cloneDraft({ stageId: defaultStageId }));
    setFormError(null);
  };

  const openExistingForm = (form: LeadForm) => {
    setSelectedFormId(form.id);
    setSelectedBlock({ type: 'form' });
    setDraft(draftFromForm(form));
    setFormError(null);
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      setFormError('Defina um nome para o formulario.');
      return;
    }

    if (!draft.stageId) {
      setFormError('Escolha a etapa de entrada do lead.');
      return;
    }

    if (!draft.fields.length) {
      setFormError('Adicione pelo menos um campo.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (selectedFormId) {
        await updateForm(selectedFormId, draft);
      } else {
        const created = await createForm(draft);
        setSelectedFormId(created.id);
      }
    } catch (error: unknown) {
      setFormError(getErrorMessage(error, 'Nao foi possivel salvar o formulario.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeSelectedForm = async () => {
    if (!selectedForm) {
      return;
    }

    await deleteForm(selectedForm.id);
    openNewForm();
  };

  const onDragEnd = ({ source, destination, draggableId }: DropResult) => {
    if (!destination) {
      return;
    }

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    if (source.droppableId === LIBRARY_DROPPABLE_ID && destination.droppableId === CANVAS_DROPPABLE_ID) {
      const preset = getPresetByDraggableId(draggableId);
      if (preset) {
        insertFieldFromPreset(preset.id, destination.index);
      }
      return;
    }

    if (source.droppableId === CANVAS_DROPPABLE_ID && destination.droppableId === CANVAS_DROPPABLE_ID) {
      setDraft((current) => cloneDraft({ ...current, fields: reorderFields(current.fields, source.index, destination.index) }));
    }
  };

  const steps = [
    {
      title: 'Defina a entrada',
      description: 'Escolha a etapa do CRM em que o lead deve entrar.',
      done: Boolean(draft.stageId),
    },
    {
      title: 'Monte o canvas',
      description: 'Arraste os blocos da biblioteca e ordene o formulario.',
      done: draft.fields.length > 0,
    },
    {
      title: 'Configure cada bloco',
      description: 'Selecione um campo para editar label, obrigatoriedade e mapeamento.',
      done: draft.fields.some((field) => Boolean(field.mapTo)),
    },
    {
      title: 'Publique',
      description: 'Salve o formulario e copie URL ou embed.',
      done: Boolean(publicUrl && draft.name.trim()),
    },
  ];

  const formsMetrics = {
    total: forms.length,
    active: forms.filter((form) => form.isActive).length,
    fields: draft.fields.length,
    required: draft.fields.filter((field) => field.required).length,
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-6 lg:p-8">
      <section className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.88)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.22)] lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Formulários</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Builder, publicação e captação em uma mesma tela.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              O módulo precisa funcionar como linha de montagem: escolher etapa, montar campos, revisar preview,
              publicar URL e acompanhar captação sem virar uma experiência espalhada.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 xl:max-w-[44rem] xl:justify-end">
            <div className="grid min-w-[14rem] flex-1 gap-2 rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Formulários</span>
                <span className="text-lg font-semibold text-white">{formsMetrics.total}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span>Ativos {formsMetrics.active}</span>
                <span>Campos {formsMetrics.fields}</span>
                <span>Obrig. {formsMetrics.required}</span>
              </div>
            </div>
            <button
              onClick={openNewForm}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 font-medium text-slate-950 transition hover:translate-y-[-1px]"
            >
              <Plus className="h-4 w-4" />
              Novo formulário
            </button>
            <button
              onClick={() => void copyText(publicUrl)}
              disabled={!publicUrl}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-40"
            >
              <Copy className="h-4 w-4" />
              Copiar URL
            </button>
            <button
              onClick={() => void submit()}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 font-medium text-emerald-50 transition hover:bg-emerald-400/15 disabled:opacity-60"
            >
              {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSubmitting ? 'Salvando...' : selectedForm ? 'Salvar formulário' : 'Criar formulário'}
            </button>
            {selectedForm ? (
              <button
                onClick={() => void removeSelectedForm()}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 font-medium text-rose-100 transition hover:bg-rose-500/15"
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[26px] border border-white/10 bg-[rgba(8,18,34,0.78)] p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Etapa de entrada</p>
          <p className="mt-2 text-sm font-medium text-slate-200">{selectedStageLabel}</p>
        </div>
        <div className="rounded-[26px] border border-white/10 bg-[rgba(8,18,34,0.78)] p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">URL pública</p>
          <p className="mt-2 truncate text-sm font-medium text-slate-200">
            {publicUrl || 'Defina nome e slug para gerar a URL'}
          </p>
        </div>
        <div className="rounded-[26px] border border-white/10 bg-[rgba(8,18,34,0.78)] p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Status</p>
          <p className="mt-2 text-sm font-medium text-slate-200">
            {draft.isActive ? 'Publicado para captação' : 'Formulário pausado'}
          </p>
        </div>
        <div className="rounded-[26px] border border-white/10 bg-[rgba(8,18,34,0.78)] p-5">
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Distribuição</p>
          <p className="mt-2 text-sm font-medium text-slate-200">URL hospedada + iframe + script com resize</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <StepCard
            key={step.title}
            index={index + 1}
            title={step.title}
            description={step.description}
            done={step.done}
          />
        ))}
      </section>

      <DragDropContext onDragEnd={onDragEnd}>
        <section className="grid gap-6 xl:grid-cols-[310px_minmax(0,1fr)_360px]">
          <aside className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Biblioteca</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Formularios</h2>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-emerald-100">
                  {forms.length} itens
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {isLoading && forms.length === 0 ? (
                  <p className="text-sm text-slate-400">Buscando formularios...</p>
                ) : forms.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-white/10 bg-white/[0.03] px-6 py-10 text-center">
                    <PanelTopOpen className="mx-auto mb-4 h-12 w-12 text-slate-700" />
                    <p className="font-medium text-slate-300">Nenhum formulario criado.</p>
                    <p className="mt-2 text-sm text-slate-500">Crie o primeiro form e publique a URL do Saaso.</p>
                  </div>
                ) : (
                  forms.map((form) => (
                    <button
                      key={form.id}
                      onClick={() => openExistingForm(form)}
                      className={`w-full rounded-[26px] border p-4 text-left transition ${
                        selectedFormId === form.id
                          ? 'border-cyan-300/30 bg-cyan-300/10'
                          : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{form.name}</p>
                          <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">{form.slug}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] ${
                            form.isActive ? 'bg-emerald-400/10 text-emerald-100' : 'bg-slate-400/10 text-slate-300'
                          }`}
                        >
                          {form.isActive ? 'Ativo' : 'Pausado'}
                        </span>
                      </div>
                      <p className="mt-4 text-xs leading-6 text-slate-400">
                        {form.stage.pipeline.name} / {form.stage.name}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 font-medium">
                          <MessageSquare className="h-3 w-3" />
                          {form.submissionCount ?? 0} envios
                        </span>
                        {form.lastSubmissionAt && isRecent(form.lastSubmissionAt, 24) && (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Recentemente
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
              <div className="border-b border-white/10 pb-5">
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Blocos</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Arraste para o canvas</h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  Arraste um bloco para o canvas ou use o botao de adicionar. Depois clique no campo para ajustar os detalhes.
                </p>
              </div>

              <div className="mt-5">
                <Droppable droppableId={LIBRARY_DROPPABLE_ID} isDropDisabled>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                      {FIELD_PRESETS.map((preset, index) => {
                        const Icon = preset.icon;

                        return (
                          <Draggable key={preset.id} draggableId={`preset-${preset.id}`} index={index} isDragDisabled={!isMounted}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`rounded-[26px] border p-4 transition ${
                                  dragSnapshot.isDragging
                                    ? 'border-cyan-300/40 bg-slate-900 shadow-[0_18px_48px_rgba(89,211,255,0.24)]'
                                    : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.06]'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    {...dragProvided.dragHandleProps}
                                    className="mt-1 inline-flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100 active:cursor-grabbing"
                                  >
                                    <Icon className="h-4.5 w-4.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-white">{preset.label}</p>
                                        <p className="mt-2 text-xs leading-6 text-slate-400">{preset.description}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => insertFieldFromPreset(preset.id)}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08]"
                                      >
                                        <Plus className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              <div className="mt-5 rounded-[26px] border border-dashed border-cyan-300/20 bg-cyan-300/5 p-4">
                <p className="text-sm font-medium text-cyan-100">Dica de uso</p>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  Nome, e-mail e telefone costumam ser o ponto de partida mais rapido. Depois complemente com campos de qualificacao.
                </p>
              </div>
            </div>
          </aside>
          <div className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                    {selectedForm ? 'Editando formulario' : 'Novo formulario'}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {selectedForm ? selectedForm.name : 'Canvas de construcao'}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-400">
                    Os campos aparecem na ordem em que serao exibidos ao visitante. Arraste para reorganizar.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                  CTA atual: <span className="font-medium text-white">{draft.submitButtonLabel || 'Enviar'}</span>
                </div>
              </div>

              <div className="mt-5">
                <Droppable droppableId={CANVAS_DROPPABLE_ID}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`rounded-[30px] border border-dashed p-4 transition ${
                        snapshot.isDraggingOver ? 'border-cyan-300/40 bg-cyan-300/[0.08]' : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      {draft.fields.length === 0 ? (
                        <div className="rounded-[28px] border border-dashed border-white/10 bg-[rgba(7,16,29,0.72)] px-6 py-14 text-center">
                          <LayoutTemplate className="mx-auto h-12 w-12 text-slate-700" />
                          <p className="mt-4 text-base font-medium text-slate-200">Solte o primeiro campo aqui</p>
                          <p className="mt-2 text-sm leading-7 text-slate-500">
                            Os blocos da biblioteca podem ser arrastados para montar a estrutura do formulario.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {draft.fields.map((field, index) => (
                            <Draggable key={field.id} draggableId={field.id} index={index} isDragDisabled={!isMounted}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`rounded-[28px] border p-4 transition ${
                                    dragSnapshot.isDragging
                                      ? 'border-cyan-300/40 bg-slate-900 shadow-[0_18px_48px_rgba(89,211,255,0.24)]'
                                      : selectedBlock.type === 'field' && selectedBlock.fieldId === field.id
                                        ? 'border-cyan-300/30 bg-cyan-300/10'
                                        : 'border-white/10 bg-[rgba(7,16,29,0.82)] hover:border-white/20'
                                  }`}
                                >
                                  <div className="flex items-start gap-4">
                                    <button
                                      type="button"
                                      {...dragProvided.dragHandleProps}
                                      className="mt-1 inline-flex h-10 w-10 shrink-0 cursor-grab items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-slate-300 active:cursor-grabbing"
                                    >
                                      <GripVertical className="h-4.5 w-4.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedBlock({ type: 'field', fieldId: field.id })}
                                      className="min-w-0 flex-1 text-left"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-base font-semibold text-white">{field.label}</p>
                                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                          {FIELD_TYPE_LABELS[field.type]}
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
                                          {field.required ? 'Obrigatorio' : 'Opcional'}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-sm text-slate-400">
                                        {FIELD_MAP_LABELS[field.mapTo ?? 'custom']} · chave{' '}
                                        <span className="font-medium text-slate-300">{field.key}</span>
                                      </p>
                                      <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-500">
                                        {field.placeholder || 'Sem placeholder configurado'}
                                      </p>
                                    </button>
                                  </div>
                                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Arraste para reorganizar</p>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => duplicateField(field.id)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                        Duplicar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeField(field.id)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-500/15"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Remover
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                        </div>
                      )}
                      {provided.placeholder}

                      <button
                        type="button"
                        onClick={() => setSelectedBlock({ type: 'button' })}
                        className={`mt-5 flex w-full items-center justify-between gap-4 rounded-[28px] border p-5 text-left transition ${
                          selectedBlock.type === 'button'
                            ? 'border-cyan-300/30 bg-cyan-300/10'
                            : 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
                            <Send className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-base font-semibold text-white">Botao de envio</p>
                            <p className="mt-2 text-sm leading-7 text-slate-400">
                              O CTA fica sempre no final do formulario publicado. Use este bloco para ajustar rotulo e mensagem de sucesso.
                            </p>
                          </div>
                        </div>
                        <span className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white">
                          {draft.submitButtonLabel || 'Enviar'}
                        </span>
                      </button>
                    </div>
                  )}
                </Droppable>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
              <div className="flex items-center gap-2 text-white">
                <Eye className="h-4 w-4 text-cyan-200" />
                <p className="text-sm font-medium">Preview publico</p>
              </div>
              <div className="mt-5 rounded-[30px] border border-white/10 bg-white p-5 text-slate-900 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-700">Saaso lead form</p>
                <h3 className="mt-3 text-2xl font-semibold">{draft.headline || draft.name || 'Seu formulario'}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {draft.description || 'Descreva rapidamente a proposta do formulario e o que acontece depois do envio.'}
                </p>
                <div className="mt-6 space-y-4">
                  {draft.fields.map((field) => (
                    <PreviewField key={field.id} field={field} />
                  ))}
                </div>
                <button className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white">
                  <Settings2 className="h-4 w-4" />
                  {draft.submitButtonLabel || 'Enviar'}
                </button>
              </div>
            </div>
          </div>
          <aside className="space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
              <div className="border-b border-white/10 pb-5">
                <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">Inspetor</p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {selectedBlock.type === 'field'
                    ? selectedField?.label || 'Campo'
                    : selectedBlock.type === 'button'
                      ? 'Botao de envio'
                      : 'Configuracoes do formulario'}
                </h2>
                <p className="mt-2 text-sm leading-7 text-slate-400">
                  {selectedBlock.type === 'field'
                    ? 'Ajuste o comportamento do campo selecionado.'
                    : selectedBlock.type === 'button'
                      ? 'Defina o CTA e a confirmacao exibida apos o envio.'
                      : 'Preencha as informacoes principais e o destino do lead no CRM.'}
                </p>
              </div>

              <div className="mt-5 space-y-5">
                {selectedBlock.type === 'form' ? (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Nome interno</span>
                      <input
                        value={draft.name}
                        onChange={(event) => updateDraft({ name: event.target.value })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Slug publico</span>
                      <input
                        value={draft.slug ?? ''}
                        onChange={(event) => updateDraft({ slug: slugify(event.target.value) })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                        placeholder={slugify(draft.name)}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Etapa de entrada</span>
                      <select
                        value={draft.stageId}
                        onChange={(event) => updateDraft({ stageId: event.target.value })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      >
                        <option value="">Selecione uma etapa</option>
                        {pipelines.map((pipeline) =>
                          pipeline.stages.map((stage) => (
                            <option key={stage.id} value={stage.id}>
                              {pipeline.name} / {stage.name}
                            </option>
                          )),
                        )}
                      </select>
                    </label>
                    <label className="inline-flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={draft.isActive ?? true}
                        onChange={(event) => updateDraft({ isActive: event.target.checked })}
                        className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300"
                      />
                      Formulario ativo para captacao
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Headline publica</span>
                      <input
                        value={draft.headline ?? ''}
                        onChange={(event) => updateDraft({ headline: event.target.value })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Descricao</span>
                      <textarea
                        rows={4}
                        value={draft.description ?? ''}
                        onChange={(event) => updateDraft({ description: event.target.value })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                  </>
                ) : null}

                {selectedBlock.type === 'button' ? (
                  <>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Texto do botao</span>
                      <input
                        value={draft.submitButtonLabel ?? ''}
                        onChange={(event) => updateDraft({ submitButtonLabel: event.target.value })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Titulo de sucesso</span>
                      <input
                        value={draft.successTitle ?? ''}
                        onChange={(event) => updateDraft({ successTitle: event.target.value })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Mensagem apos envio</span>
                      <textarea
                        rows={4}
                        value={draft.successMessage ?? ''}
                        onChange={(event) => updateDraft({ successMessage: event.target.value })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                  </>
                ) : null}

                {selectedBlock.type === 'field' && selectedField ? (
                  <>
                    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Campo selecionado</p>
                      <p className="mt-2 text-sm font-medium text-slate-200">
                        Bloco {selectedFieldIndex + 1} de {draft.fields.length}
                      </p>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Label</span>
                      <input
                        value={selectedField.label}
                        onChange={(event) => updateField(selectedField.id, { label: event.target.value })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Tipo</span>
                      <select
                        value={selectedField.type}
                        onChange={(event) =>
                          updateField(selectedField.id, {
                            type: event.target.value as LeadFormFieldType,
                            options:
                              event.target.value === 'select'
                                ? selectedField.options?.length
                                  ? selectedField.options
                                  : [DEFAULT_OPTION]
                                : [],
                          })
                        }
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      >
                        {FIELD_TYPES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-300">ID</span>
                        <input
                          value={selectedField.id}
                          onChange={(event) =>
                            updateField(selectedField.id, { id: slugify(event.target.value).replace(/-/g, '_') })
                          }
                          className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-300">Chave</span>
                        <input
                          value={selectedField.key}
                          onChange={(event) =>
                            updateField(selectedField.id, { key: slugify(event.target.value).replace(/-/g, '_') })
                          }
                          className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Placeholder</span>
                      <input
                        value={selectedField.placeholder ?? ''}
                        onChange={(event) => updateField(selectedField.id, { placeholder: event.target.value })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Mapeamento</span>
                      <select
                        value={selectedField.mapTo ?? 'custom'}
                        onChange={(event) => updateField(selectedField.id, { mapTo: event.target.value as LeadFormFieldMap })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      >
                        {FIELD_MAPS.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Texto de ajuda</span>
                      <input
                        value={selectedField.helpText ?? ''}
                        onChange={(event) => updateField(selectedField.id, { helpText: event.target.value })}
                        className="w-full rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                      />
                    </label>
                    <label className="inline-flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={selectedField.required ?? false}
                        onChange={(event) => updateField(selectedField.id, { required: event.target.checked })}
                        className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300"
                      />
                      Campo obrigatorio
                    </label>
                    {selectedField.type === 'select' ? (
                      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white">Opcoes selecionaveis</p>
                          <button
                            type="button"
                            onClick={() => addOption(selectedField.id)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Adicionar
                          </button>
                        </div>
                        <div className="mt-4 space-y-3">
                          {(selectedField.options ?? []).map((option, optionIndex) => (
                            <div key={`${option.value}-${optionIndex}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                              <input
                                value={option.label}
                                onChange={(event) => updateOption(selectedField.id, optionIndex, { label: event.target.value })}
                                className="rounded-[20px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                                placeholder="Label"
                              />
                              <input
                                value={option.value}
                                onChange={(event) =>
                                  updateOption(selectedField.id, optionIndex, { value: slugify(event.target.value) })
                                }
                                className="rounded-[20px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40"
                                placeholder="valor"
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(selectedField.id, optionIndex)}
                                className="inline-flex items-center justify-center rounded-[20px] border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-rose-100 transition hover:bg-rose-500/15"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {formError ? (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {formError}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
              <div className="flex items-center gap-2 text-white">
                <Code2 className="h-4 w-4 text-cyan-200" />
                <p className="text-sm font-medium">Embed e distribuicao</p>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Script com altura automatica</p>
                  <button
                    onClick={() => void copyText(embedScriptSnippet)}
                    disabled={!embedScriptSnippet}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-40"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                </div>
                <pre className="mt-4 overflow-auto rounded-2xl border border-white/10 bg-[rgba(7,16,29,0.82)] p-4 text-xs leading-6 text-slate-300">
                  {embedScriptSnippet || '<script>...</script>'}
                </pre>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Fallback iframe</p>
                  <button
                    onClick={() => void copyText(embedSnippet)}
                    disabled={!embedSnippet}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-40"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                </div>
                <pre className="mt-4 overflow-auto rounded-2xl border border-white/10 bg-[rgba(7,16,29,0.82)] p-4 text-xs leading-6 text-slate-300">
                  {embedSnippet || '<iframe src="..." />'}
                </pre>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-500">Protocolo postMessage</p>
                  <button
                    onClick={() => void copyText(postMessageProtocolDoc)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                </div>
                <pre className="mt-4 overflow-auto rounded-2xl border border-white/10 bg-[rgba(7,16,29,0.82)] p-4 text-xs leading-6 text-slate-400">
                  {postMessageProtocolDoc}
                </pre>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-white">
                  <BarChart3 className="h-4 w-4 text-cyan-200" />
                  <p className="text-sm font-medium">Analytics do formulario</p>
                </div>
                <button
                  onClick={refreshAnalytics}
                  disabled={!selectedFormId || analyticsLoadingFormId === selectedFormId}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-40"
                >
                  {analyticsLoadingFormId === selectedFormId ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Atualizar
                </button>
              </div>

              {analyticsError && selectedFormId ? (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {analyticsError}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Total de capturas</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{selectedAnalytics?.totalSubmissions ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Ultima captura</p>
                  <p className="mt-2 text-sm font-medium text-slate-200">
                    {formatDateTime(selectedAnalytics?.latestSubmissionAt ?? null)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Ultimos 7 dias</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{selectedAnalytics?.submissionsLast7Days ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Ultimos 30 dias</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{selectedAnalytics?.submissionsLast30Days ?? 0}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-cyan-200" />
                  <p className="text-sm font-medium text-white">Capturas recentes</p>
                </div>
                {analyticsLoadingFormId === selectedFormId && !selectedAnalytics ? (
                  <div className="mt-4 flex items-center gap-3 text-sm text-slate-300">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Buscando capturas...
                  </div>
                ) : selectedAnalytics?.recentSubmissions.length ? (
                  <div className="mt-4 space-y-3">
                    {selectedAnalytics.recentSubmissions.map((submission) => (
                      <div key={submission.id} className="rounded-2xl border border-white/10 bg-[rgba(7,16,29,0.82)] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {submission.contact?.name || submission.card?.title || 'Lead sem identificacao'}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              {submission.contact?.email || submission.contact?.phone || 'Sem e-mail ou telefone'}
                            </p>
                          </div>
                          <span className="text-xs text-slate-500">{formatDateTime(submission.createdAt)}</span>
                        </div>
                        <p className="mt-3 text-xs uppercase tracking-[0.24em] text-slate-500">
                          Card: {submission.card?.title || 'Ainda sem card'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Nenhuma captura registrada ainda para este formulario.</p>
                )}
              </div>
            </div>
          </aside>
        </section>
      </DragDropContext>
    </div>
  );
}
