'use client';

import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { StageMessageTemplate, StageRule } from './board-types';
import type { RuleStepInput } from '@/stores/useKanbanStore';

interface Props {
  rule: StageRule | null;
  templates: StageMessageTemplate[];
  onSave: (steps: RuleStepInput[]) => Promise<void>;
  onDelete: () => Promise<void>;
}

interface EditableStep extends RuleStepInput {
  id: string;
}

function buildDraftStep(index: number, templates: StageMessageTemplate[]): EditableStep {
  const preferredTemplate = templates[index] ?? templates[0] ?? null;
  return {
    id: `draft-${index}-${Date.now()}`,
    order: index,
    dayOffset: index,
    channel: preferredTemplate?.channel ?? 'WHATSAPP',
    messageTemplateId: preferredTemplate?.id ?? '',
  };
}

export function RuleStepList({ rule, templates, onSave, onDelete }: Props) {
  const [steps, setSteps] = useState<EditableStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingRule, setIsDeletingRule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingStepId, setConfirmingStepId] = useState<string | null>(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState(false);

  useEffect(() => {
    const nextSteps = (rule?.steps ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((step) => ({ ...step }));
    setSteps(nextSteps);
    setError(null);
    setConfirmingStepId(null);
    setConfirmDeleteRule(false);
  }, [rule]);

  const templatesByChannel = useMemo(() => ({
    WHATSAPP: templates.filter((template) => template.channel === 'WHATSAPP'),
    EMAIL: templates.filter((template) => template.channel === 'EMAIL'),
  }), [templates]);

  const updateStep = (stepId: string, patch: Partial<EditableStep>) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
    );
  };

  const addStep = () => {
    setSteps((prev) => [...prev, buildDraftStep(prev.length, templates)]);
  };

  const removeStep = (stepId: string) => {
    setSteps((prev) =>
      prev
        .filter((step) => step.id !== stepId)
        .map((step, index) => ({ ...step, order: index })),
    );
    setConfirmingStepId(null);
  };

  const handleSave = async () => {
    const normalized = steps.map((step, index) => ({
      order: index,
      dayOffset: step.dayOffset,
      channel: step.channel,
      messageTemplateId: step.messageTemplateId,
    }));

    if (normalized.some((step) => !step.messageTemplateId)) {
      setError('Erro ao salvar régua. Verifique os campos e tente novamente.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(normalized);
    } catch {
      setError('Erro ao salvar régua. Verifique os campos e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async () => {
    setIsDeletingRule(true);
    setError(null);
    try {
      await onDelete();
      setConfirmDeleteRule(false);
    } catch {
      setError('Erro ao salvar régua. Verifique os campos e tente novamente.');
    } finally {
      setIsDeletingRule(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      {steps.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e2e8f0] px-4 py-6 text-sm leading-6 text-[#a0aec0]">
          Nenhuma etapa de régua configurada. Clique em + para adicionar o primeiro disparo.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {steps.map((step) => {
            const channelTemplates = templatesByChannel[step.channel];
            return (
              <div key={step.id} className="rounded-2xl border border-[#f0f0f0] bg-[#fbfbfb] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <span className="w-fit rounded-[6px] bg-[#f5f5f5] px-2 py-1 text-[11px] font-bold uppercase text-[#9e9e9e]">
                    D{step.dayOffset === 0 ? '0' : `+${step.dayOffset}`}
                  </span>

                  <div className="grid flex-1 gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
                    <input
                      type="number"
                      min={0}
                      value={step.dayOffset}
                      onChange={(event) =>
                        updateStep(step.id, { dayOffset: Number(event.target.value) || 0 })
                      }
                      className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1a202c] outline-none focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
                    />

                    <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)]">
                      <select
                        value={step.channel}
                        onChange={(event) => {
                          const nextChannel = event.target.value as 'WHATSAPP' | 'EMAIL';
                          const nextTemplate = templatesByChannel[nextChannel][0] ?? null;
                          updateStep(step.id, {
                            channel: nextChannel,
                            messageTemplateId: nextTemplate?.id ?? '',
                          });
                        }}
                        className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1a202c] outline-none focus:border-[#594ded]"
                      >
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="EMAIL">Email</option>
                      </select>

                      <select
                        value={step.messageTemplateId}
                        onChange={(event) =>
                          updateStep(step.id, { messageTemplateId: event.target.value })
                        }
                        className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1a202c] outline-none focus:border-[#594ded]"
                      >
                        <option value="">Selecione um template</option>
                        {channelTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {confirmingStepId === step.id ? (
                    <div className="flex items-center gap-2 text-sm">
                      <button
                        type="button"
                        onClick={() => removeStep(step.id)}
                        className="font-semibold text-rose-600 hover:text-rose-700"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingStepId(null)}
                        className="font-medium text-[#718096] hover:text-[#1a202c]"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingStepId(step.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a0aec0] hover:bg-rose-50 hover:text-rose-500"
                      aria-label="Remover etapa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={addStep}
        className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#e2e8f0] py-3 text-sm font-semibold text-[#594ded] hover:border-[#594ded] hover:bg-[#f5f3ff]"
      >
        <Plus className="h-4 w-4" />
        Adicionar etapa
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {rule ? (
          confirmDeleteRule ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#718096]">Remover etapa</span>
              <button
                type="button"
                onClick={() => void handleDeleteRule()}
                className="font-semibold text-rose-600 hover:text-rose-700"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteRule(false)}
                className="font-medium text-[#718096] hover:text-[#1a202c]"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDeleteRule(true)}
              className="text-sm font-medium text-rose-600 hover:text-rose-700"
            >
              Excluir régua
            </button>
          )
        ) : (
          <span />
        )}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving || isDeletingRule}
          className="inline-flex items-center gap-2 rounded-xl bg-[#594ded] px-4 py-2 text-sm font-bold text-white hover:bg-[#4d42cc] disabled:opacity-60"
        >
          {isSaving || isDeletingRule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Salvar régua
        </button>
      </div>
    </div>
  );
}
