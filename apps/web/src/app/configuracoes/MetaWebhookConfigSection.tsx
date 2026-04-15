'use client';

import api from '@/lib/api';
import { useMetaMappingsStore } from '@/stores/useMetaMappingsStore';
import { ArrowRight, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface PipelineOption {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
  }>;
}

export function MetaWebhookConfigSection() {
  const { mappings, loading, fetch, create, remove } = useMetaMappingsStore();
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    metaFormId: '',
    pipelineId: '',
    stageId: '',
    verifyToken: '',
    pageAccessToken: '',
  });

  useEffect(() => {
    void fetch();
    void api.get<PipelineOption[]>('/pipelines').then((response) => setPipelines(response.data)).catch(() => undefined);
  }, [fetch]);

  const availableStages = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === form.pipelineId)?.stages ?? [],
    [form.pipelineId, pipelines],
  );

  const resetForm = () => {
    setForm({
      metaFormId: '',
      pipelineId: '',
      stageId: '',
      verifyToken: '',
      pageAccessToken: '',
    });
    setSavingError(null);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    setSavingError(null);
    try {
      await create({
        metaFormId: form.metaFormId.trim(),
        pipelineId: form.pipelineId,
        stageId: form.stageId,
        verifyToken: form.verifyToken.trim(),
        pageAccessToken: form.pageAccessToken.trim() || undefined,
      });
      resetForm();
      setIsAdding(false);
    } catch {
      setSavingError('Erro ao salvar mapeamento. Verifique o ID do formulário Meta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setRemovingId(id);
    try {
      await remove(id);
      setConfirmingDeleteId(null);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="rounded-[30px] border border-[#e8e8e8] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#393939]">Meta Lead Ads</h2>
          <p className="mt-2 text-sm leading-6 text-[#6b6b6b]">
            Vincule formulários do Meta a pipelines e etapas para captar leads automaticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAdding((current) => !current);
            setSavingError(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-2 text-sm font-bold text-[#393939] transition hover:border-[#d0d0d0] hover:bg-[#f2f2f2]"
        >
          <Plus className="h-4 w-4" />
          Adicionar mapeamento
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {isAdding ? (
          <div className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <input
                value={form.metaFormId}
                onChange={(event) => setForm((current) => ({ ...current, metaFormId: event.target.value }))}
                placeholder="ex: 123456789"
                className="rounded-xl border border-[#e8e8e8] bg-white px-3 py-2 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]"
              />
              <select
                value={form.pipelineId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pipelineId: event.target.value,
                    stageId: '',
                  }))
                }
                className="rounded-xl border border-[#e8e8e8] bg-white px-3 py-2 text-sm text-[#393939] outline-none focus:border-[#594ded]"
              >
                <option value="">Selecione o pipeline</option>
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
              <select
                value={form.stageId}
                onChange={(event) => setForm((current) => ({ ...current, stageId: event.target.value }))}
                className="rounded-xl border border-[#e8e8e8] bg-white px-3 py-2 text-sm text-[#393939] outline-none focus:border-[#594ded]"
              >
                <option value="">Selecione a etapa</option>
                {availableStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <input
                value={form.verifyToken}
                onChange={(event) => setForm((current) => ({ ...current, verifyToken: event.target.value }))}
                placeholder="Token de verificação"
                className="rounded-xl border border-[#e8e8e8] bg-white px-3 py-2 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] focus:border-[#594ded]"
              />
              <div className="lg:col-span-2">
                <p className="text-xs leading-6 text-[#6b6b6b]">
                  Token secreto que o Meta usará para verificar o webhook. Salve este valor com segurança — não será exibido novamente.
                </p>
              </div>
              <input
                type="password"
                value={form.pageAccessToken}
                onChange={(event) => setForm((current) => ({ ...current, pageAccessToken: event.target.value }))}
                placeholder="Page Access Token (opcional)"
                className="rounded-xl border border-[#e8e8e8] bg-white px-3 py-2 text-sm text-[#393939] outline-none placeholder:text-[#9e9e9e] lg:col-span-2 focus:border-[#594ded]"
              />
              <div className="lg:col-span-2">
                <p className="text-xs leading-6 text-[#6b6b6b]">
                  Opcional — necessário apenas para recuperar detalhes completos do lead.
                </p>
              </div>
            </div>

            {savingError ? <p className="mt-3 text-sm text-rose-600">{savingError}</p> : null}

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsAdding(false);
                }}
                className="rounded-xl px-4 py-2 text-sm font-medium text-[#6b6b6b] hover:text-[#393939]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#594ded] px-4 py-2 text-sm font-bold text-white hover:bg-[#4d42cc] disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Adicionar mapeamento
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] px-5 py-6 text-sm text-[#6b6b6b]">
            Carregando mapeamentos...
          </div>
        ) : mappings.length === 0 ? (
          <div className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] px-5 py-6 text-sm text-[#6b6b6b]">
            Nenhum formulário Meta mapeado. Adicione um mapeamento para captar leads automaticamente.
          </div>
        ) : (
          mappings.map((mapping) => (
            <div key={mapping.id} className="rounded-[24px] border border-[#e8e8e8] bg-[#fafafa] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#9e9e9e]">Formulário Meta</p>
                    <p className="font-mono text-sm text-[#393939]">{mapping.metaFormId}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm text-[#6b6b6b]">
                    <span>{mapping.pipeline?.name ?? mapping.pipelineName ?? mapping.pipelineId}</span>
                    <ArrowRight className="h-4 w-4" />
                    <span>{mapping.stage?.name ?? mapping.stageName ?? mapping.stageId}</span>
                  </div>
                </div>

                {confirmingDeleteId === mapping.id ? (
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => void handleDelete(mapping.id)}
                      className="font-semibold text-rose-600 hover:text-rose-500"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      className="font-medium text-[#6b6b6b] hover:text-[#393939]"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(mapping.id)}
                    disabled={removingId === mapping.id}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-[#9e9e9e] transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                    aria-label="Remover mapeamento"
                  >
                    {removingId === mapping.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
