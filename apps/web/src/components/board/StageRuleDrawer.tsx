'use client';

import api from '@/lib/api';
import { useKanbanStore, type RuleStepInput, type Stage, type StageAgentOption } from '@/stores/useKanbanStore';
import { Loader2, Mail, MessageSquare, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { StageMessageTemplate, StageRule } from './board-types';
import { AgentStepConfig } from './AgentStepConfig';
import { RuleStepList } from './RuleStepList';

type TabId = 'templates' | 'rule' | 'agent';

interface Props {
  stage: Stage;
  isOpen: boolean;
  onClose: () => void;
}

type TemplateFormState = {
  name: string;
  channel: 'WHATSAPP' | 'EMAIL';
  subject: string;
  body: string;
};

const EMPTY_TEMPLATE_FORM: TemplateFormState = {
  name: '',
  channel: 'WHATSAPP',
  subject: '',
  body: '',
};

export function StageRuleDrawer({ stage, isOpen, onClose }: Props) {
  const { fetchStageRule, createStageRule, upsertRuleSteps, deleteRule, setStageAgent, fetchAgents } = useKanbanStore();
  const [activeTab, setActiveTab] = useState<TabId>('templates');
  const [templates, setTemplates] = useState<StageMessageTemplate[]>(stage.messageTemplates ?? []);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | 'new' | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(EMPTY_TEMPLATE_FORM);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [rule, setRule] = useState<StageRule | null>(stage.rule ?? null);
  const [isLoadingRule, setIsLoadingRule] = useState(false);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [agents, setAgents] = useState<StageAgentOption[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);

  const assignedAgent = useMemo(
    () => agents.find((agent) => agent.stage?.id === stage.id) ?? null,
    [agents, stage.id],
  );

  useEffect(() => {
    if (!isOpen) return;

    setActiveTab('templates');
    setEditingTemplateId(null);
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    setGeneralError(null);
    setAgentError(null);

    const loadTemplates = async () => {
      setIsLoadingTemplates(true);
      try {
        const response = await api.get<StageMessageTemplate[]>(`/stage-message-templates?stageId=${stage.id}`);
        setTemplates(response.data);
      } catch {
        setGeneralError('Erro ao carregar templates.');
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    const loadRule = async () => {
      setIsLoadingRule(true);
      try {
        const response = await fetchStageRule(stage.id);
        setRule(response);
      } catch {
        setRule(null);
      } finally {
        setIsLoadingRule(false);
      }
    };

    const loadAgents = async () => {
      setIsLoadingAgents(true);
      try {
        const response = await fetchAgents();
        setAgents(response);
      } catch {
        setAgentError('Erro ao carregar agentes.');
      } finally {
        setIsLoadingAgents(false);
      }
    };

    void loadTemplates();
    void loadRule();
    void loadAgents();
  }, [fetchAgents, fetchStageRule, isOpen, stage.id]);

  if (!isOpen) return null;

  const tabButton = (tabId: TabId, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tabId)}
      className={`border-b-2 px-1 pb-3 pt-1 text-sm transition ${activeTab === tabId ? 'border-[#594ded] text-[#594ded] font-bold' : 'border-transparent text-[#a0aec0]'}`}
    >
      {label}
    </button>
  );

  const startNewTemplate = () => {
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    setEditingTemplateId('new');
    setGeneralError(null);
  };

  const startEditTemplate = (template: StageMessageTemplate) => {
    setTemplateForm({
      name: template.name,
      channel: template.channel,
      subject: template.subject ?? '',
      body: template.body,
    });
    setEditingTemplateId(template.id);
    setGeneralError(null);
  };

  const saveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.body.trim()) {
      setGeneralError('Nome e corpo são obrigatórios.');
      return;
    }

    setIsSavingTemplate(true);
    setGeneralError(null);

    try {
      const payload = {
        stageId: stage.id,
        name: templateForm.name.trim(),
        channel: templateForm.channel,
        subject: templateForm.channel === 'EMAIL' && templateForm.subject.trim() ? templateForm.subject.trim() : undefined,
        body: templateForm.body.trim(),
      };

      if (editingTemplateId === 'new') {
        const response = await api.post<StageMessageTemplate>('/stage-message-templates', payload);
        setTemplates((prev) => [...prev, response.data]);
      } else {
        const { stageId: _stageId, ...patchPayload } = payload;
        const response = await api.patch<StageMessageTemplate>(`/stage-message-templates/${editingTemplateId}`, patchPayload);
        setTemplates((prev) => prev.map((template) => (template.id === editingTemplateId ? response.data : template)));
      }

      setEditingTemplateId(null);
      setTemplateForm(EMPTY_TEMPLATE_FORM);
    } catch {
      setGeneralError('Erro ao salvar template.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const removeTemplate = async (templateId: string) => {
    setDeletingTemplateId(templateId);
    try {
      await api.delete(`/stage-message-templates/${templateId}`);
      setTemplates((prev) => prev.filter((template) => template.id !== templateId));
    } catch {
      setGeneralError('Erro ao remover template.');
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const handleCreateRule = async () => {
    setIsCreatingRule(true);
    try {
      const createdRule = await createStageRule(stage.id);
      setRule(createdRule);
    } catch {
      setGeneralError('Erro ao criar régua para esta etapa.');
    } finally {
      setIsCreatingRule(false);
    }
  };

  const handleSaveRule = async (steps: RuleStepInput[]) => {
    const currentRule = rule ?? (await createStageRule(stage.id));
    const updatedRule = await upsertRuleSteps(currentRule.id, steps);
    setRule(updatedRule);
  };

  const handleDeleteRule = async () => {
    if (!rule) return;
    await deleteRule(rule.id);
    setRule(null);
  };

  const handleSaveAgent = async (agentId: string | null, classificationCriteria: string | null) => {
    await setStageAgent(stage.id, agentId, classificationCriteria);
    const refreshedAgents = await fetchAgents();
    setAgents(refreshedAgents);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-[720px] flex-col gap-6 rounded-[30px] bg-white p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-bold text-[#1a202c]">{stage.name}</h2>
            <p className="text-[13px] text-[#a0aec0]">Configuração de templates, régua e agente</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#a0aec0] hover:bg-[#f5f5f5] hover:text-[#1a202c]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {generalError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600">
            {generalError}
          </div>
        ) : null}

        <div className="flex items-center gap-5 border-b border-[#edf2f7]">
          {tabButton('templates', 'Templates')}
          {tabButton('rule', 'Régua')}
          {tabButton('agent', 'Agente')}
        </div>

        {activeTab === 'templates' ? (
          <div className="flex flex-col gap-3">
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-8 text-[#a0aec0]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
              </div>
            ) : (
              <>
                {templates.length === 0 && editingTemplateId !== 'new' ? (
                  <p className="py-4 text-center text-[13px] text-[#a0aec0]">
                    Nenhum template configurado. Clique em + para adicionar.
                  </p>
                ) : null}

                {templates.map((template) => (
                  editingTemplateId === template.id ? (
                    <TemplateEditor
                      key={template.id}
                      form={templateForm}
                      setForm={setTemplateForm}
                      isSaving={isSavingTemplate}
                      onSave={saveTemplate}
                      onCancel={() => setEditingTemplateId(null)}
                    />
                  ) : (
                    <div key={template.id} className="flex items-center gap-3 rounded-2xl border border-[#f0f0f0] px-4 py-3">
                      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white ${template.channel === 'WHATSAPP' ? 'bg-[#22bd73]' : 'bg-[#3b78f5]'}`}>
                        {template.channel === 'WHATSAPP' ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-[#1a202c]">{template.name}</p>
                        <p className="truncate text-[12px] text-[#a0aec0]">{template.body}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditTemplate(template)}
                          className="rounded-lg px-2 py-1 text-[12px] font-medium text-[#718096] hover:bg-[#f5f5f5] hover:text-[#1a202c]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeTemplate(template.id)}
                          disabled={deletingTemplateId === template.id}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a0aec0] hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                        >
                          {deletingTemplateId === template.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )
                ))}

                {editingTemplateId === 'new' ? (
                  <TemplateEditor
                    form={templateForm}
                    setForm={setTemplateForm}
                    isSaving={isSavingTemplate}
                    onSave={saveTemplate}
                    onCancel={() => setEditingTemplateId(null)}
                  />
                ) : null}

                {editingTemplateId === null ? (
                  <button
                    type="button"
                    onClick={startNewTemplate}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#e2e8f0] py-3 text-[13px] font-semibold text-[#594ded] hover:border-[#594ded] hover:bg-[#f5f3ff]"
                  >
                    <Plus className="h-4 w-4" />
                    Novo template
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'rule' ? (
          <div>
            {isLoadingRule ? (
              <div className="flex items-center justify-center py-8 text-[#a0aec0]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando régua...
              </div>
            ) : rule ? (
              <RuleStepList rule={rule} templates={templates} onSave={handleSaveRule} onDelete={handleDeleteRule} />
            ) : (
              <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-[#e2e8f0] px-5 py-6">
                <p className="text-sm leading-6 text-[#718096]">
                  Nenhuma etapa de régua configurada. Clique em + para adicionar o primeiro disparo.
                </p>
                <div>
                  <button
                    type="button"
                    onClick={() => void handleCreateRule()}
                    disabled={isCreatingRule}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#594ded] px-4 py-2 text-sm font-bold text-white hover:bg-[#4d42cc] disabled:opacity-60"
                  >
                    {isCreatingRule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Criar régua para esta etapa
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'agent' ? (
          <div>
            {isLoadingAgents ? (
              <div className="flex items-center justify-center py-8 text-[#a0aec0]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando agentes...
              </div>
            ) : (
              <>
                {agentError ? <p className="mb-3 text-sm text-rose-600">{agentError}</p> : null}
                <AgentStepConfig
                  stageId={stage.id}
                  currentAgentId={assignedAgent?.id ?? null}
                  currentCriteria={assignedAgent?.stage?.classificationCriteria ?? null}
                  agents={agents}
                  onSave={handleSaveAgent}
                />
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TemplateEditor({
  form,
  setForm,
  isSaving,
  onSave,
  onCancel,
}: {
  form: TemplateFormState;
  setForm: (value: TemplateFormState) => void;
  isSaving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#594ded]/30 bg-[#f5f3ff] p-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#718096]">Nome</label>
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Ex: Boas-vindas"
            className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#1a202c] outline-none focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#718096]">Canal</label>
          <select
            value={form.channel}
            onChange={(event) => setForm({ ...form, channel: event.target.value as 'WHATSAPP' | 'EMAIL' })}
            className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#1a202c] outline-none focus:border-[#594ded]"
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
          </select>
        </div>
      </div>

      {form.channel === 'EMAIL' ? (
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#718096]">Assunto</label>
          <input
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value })}
            placeholder="Assunto do email"
            className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#1a202c] outline-none focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#718096]">Mensagem</label>
        <textarea
          rows={4}
          value={form.body}
          onChange={(event) => setForm({ ...form, body: event.target.value })}
          placeholder="Olá {{nome}}, tudo bem?"
          className="w-full resize-none rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#1a202c] outline-none focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl px-4 py-2 text-[13px] font-medium text-[#718096] hover:bg-white"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-[#594ded] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4d42cc] disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar
        </button>
      </div>
    </div>
  );
}
