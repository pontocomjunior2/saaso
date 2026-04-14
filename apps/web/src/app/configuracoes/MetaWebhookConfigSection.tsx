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
    <section className="rounded-[30px] border border-white/10 bg-[rgba(8,18,34,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Meta Lead Ads</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Vincule formulários do Meta a pipelines e etapas para captar leads automaticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setIsAdding((current) => !current);
            setSavingError(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-bold text-white transition hover:border-white/20 hover:bg-white/[0.1]"
        >
          <Plus className="h-4 w-4" />
          Adicionar mapeamento
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {isAdding ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="grid gap-3 lg:grid-cols-2">
              <input
                value={form.metaFormId}
                onChange={(event) => setForm((current) => ({ ...current, metaFormId: event.target.value }))}
                placeholder="ex: 123456789"
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
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
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
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
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none"
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
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
              />
              <div className="lg:col-span-2">
                <p className="text-xs leading-6 text-slate-400">
                  Token secreto que o Meta usará para verificar o webhook. Salve este valor com segurança — não será exibido novamente.
                </p>
              </div>
              <input
                type="password"
                value={form.pageAccessToken}
                onChange={(event) => setForm((current) => ({ ...current, pageAccessToken: event.target.value }))}
                placeholder="Page Access Token (opcional)"
                className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 lg:col-span-2"
              />
              <div className="lg:col-span-2">
                <p className="text-xs leading-6 text-slate-400">
                  Opcional — necessário apenas para recuperar detalhes completos do lead.
                </p>
              </div>
            </div>

            {savingError ? <p className="mt-3 text-sm text-rose-300">{savingError}</p> : null}

            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsAdding(false);
                }}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 hover:text-white"
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
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-6 text-sm text-slate-400">
            Carregando mapeamentos...
          </div>
        ) : mappings.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-6 text-sm text-slate-400">
            Nenhum formulário Meta mapeado. Adicione um mapeamento para captar leads automaticamente.
          </div>
        ) : (
          mappings.map((mapping) => (
            <div key={mapping.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Formulário Meta</p>
                    <p className="font-mono text-sm text-white">{mapping.metaFormId}</p>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm text-slate-300">
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
                      className="font-semibold text-rose-300 hover:text-rose-200"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      className="font-medium text-slate-300 hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(mapping.id)}
                    disabled={removingId === mapping.id}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-60"
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
