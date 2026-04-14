'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Loader2, LayoutGrid } from 'lucide-react';
import api from '@/lib/api';

interface TemplateStage {
  name: string;
  order: number;
}

interface PipelineTemplate {
  id: string;
  name: string;
  description?: string;
  stages: TemplateStage[];
}

interface PipelineTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPipelineId?: string;
  /** When true, shows "Criar pipeline vazio" option at the top */
  showCreateEmpty?: boolean;
}

export function PipelineTemplateModal({
  isOpen,
  onClose,
  currentPipelineId,
  showCreateEmpty = false,
}: PipelineTemplateModalProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingEmpty, setIsCreatingEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedId(null);
    setError(null);
    setIsLoadingTemplates(true);

    api
      .get<PipelineTemplate[]>('/pipelines/templates')
      .then((res) => setTemplates(res.data))
      .catch(() => setError('Erro ao carregar templates.'))
      .finally(() => setIsLoadingTemplates(false));
  }, [isOpen]);

  const handleSelectTemplate = async (template: PipelineTemplate) => {
    if (isCreating) return;

    setSelectedId(template.id);
    setIsCreating(true);
    setError(null);

    try {
      const response = await api.post<{ id: string }>('/pipelines/from-template', {
        templateId: template.id,
      });
      onClose();
      router.push(`/pipelines/${response.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao criar pipeline a partir do template.');
      setIsCreating(false);
      setSelectedId(null);
    }
  };

  const handleCreateEmpty = async () => {
    if (isCreatingEmpty) return;

    setIsCreatingEmpty(true);
    setError(null);

    try {
      const response = await api.post<{ id: string }>('/pipelines', { name: 'Novo Pipeline' });
      onClose();
      router.push(`/pipelines/${response.data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao criar pipeline vazio.');
      setIsCreatingEmpty(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex w-full max-w-2xl flex-col gap-6 rounded-[28px] bg-white p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[20px] font-bold text-[#1a202c]">Selecione um template</h2>
            <p className="text-[14px] text-[#a0aec0]">
              Escolha um template pronto ou crie um pipeline do zero.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#a0aec0] transition hover:bg-[#f5f5f5] hover:text-[#1a202c]"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Criar vazio */}
        {showCreateEmpty && (
          <button
            type="button"
            onClick={() => void handleCreateEmpty()}
            disabled={isCreatingEmpty || isCreating}
            className="flex items-center gap-3 rounded-2xl border border-dashed border-[#e2e8f0] px-5 py-4 text-left transition hover:border-[#594ded] hover:bg-[#f5f3ff] disabled:opacity-60"
          >
            {isCreatingEmpty ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#594ded]" />
            ) : (
              <LayoutGrid className="h-5 w-5 text-[#594ded]" />
            )}
            <div>
              <p className="text-[14px] font-semibold text-[#1a202c]">Criar pipeline vazio</p>
              <p className="text-[12px] text-[#a0aec0]">Comece do zero e adicione etapas manualmente</p>
            </div>
          </button>
        )}

        {/* Template list */}
        {isLoadingTemplates ? (
          <div className="flex items-center justify-center py-10 text-[#a0aec0]">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando templates...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-600">
            {error}
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: '60vh' }}>
            {templates.map((template) => {
              const isBusy = selectedId === template.id && isCreating;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => void handleSelectTemplate(template)}
                  disabled={isCreating || isCreatingEmpty}
                  className={`flex flex-col gap-3 rounded-2xl border px-5 py-4 text-left transition disabled:opacity-60 ${
                    selectedId === template.id
                      ? 'border-[#594ded] bg-[#f5f3ff]'
                      : 'border-[#f0f0f0] hover:border-[#594ded] hover:bg-[#f5f3ff]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[15px] font-bold text-[#1a202c]">{template.name}</span>
                      {template.description && (
                        <span className="text-[13px] text-[#a0aec0]">{template.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-[6px] bg-[#f5f3ff] px-2 py-0.5 text-[11px] font-bold tracking-wider text-[#594ded]">
                        {template.stages.length} etapas
                      </span>
                      {isBusy && <Loader2 className="h-4 w-4 animate-spin text-[#594ded]" />}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {template.stages.map((stage) => (
                      <span
                        key={stage.order}
                        className="rounded-[8px] border border-[#f0f0f0] bg-[#fafafa] px-3 py-1 text-[12px] font-medium text-[#545a66]"
                      >
                        {stage.name}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
