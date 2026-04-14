'use client';

import { useState } from 'react';
import { LayoutGrid, Check, Loader2 } from 'lucide-react';
import { useKanbanStore } from '@/stores/useKanbanStore';

interface EmptyBoardStateProps {
  pipelineId: string;
  onLoadTemplate: () => void;
}

export function EmptyBoardState({ pipelineId, onLoadTemplate }: EmptyBoardStateProps) {
  const { createStage } = useKanbanStore();
  const [isCreating, setIsCreating] = useState(false);
  const [stageName, setStageName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const handleOpenInput = () => {
    setIsCreating(true);
    setStageName('');
    setInputError(null);
  };

  const handleConfirm = async () => {
    const trimmed = stageName.trim();
    if (!trimmed) {
      setInputError('Digite um nome para a etapa.');
      return;
    }

    setIsSubmitting(true);
    setInputError(null);

    try {
      await createStage(pipelineId, trimmed);
      setIsCreating(false);
      setStageName('');
    } catch {
      setInputError('Erro ao criar etapa. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void handleConfirm();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setStageName('');
      setInputError(null);
    }
  };

  return (
    <div className="flex min-h-[42rem] flex-col items-center justify-center rounded-[28px] border border-[#f0f0f0] bg-white p-10">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#f5f3ff]">
          <LayoutGrid className="h-8 w-8 text-[#594ded]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-[20px] font-bold text-[#1a202c]">Seu pipeline esta vazio</h2>
          <p className="max-w-sm text-[14px] leading-relaxed text-[#a0aec0]">
            Comece criando suas etapas manualmente ou carregue um template pronto.
          </p>
        </div>

        {isCreating ? (
          <div className="flex w-full max-w-xs flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nome da etapa..."
                className="flex-1 rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-sm text-[#1a202c] placeholder-[#a0aec0] outline-none transition focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={isSubmitting}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#594ded] text-white shadow-sm transition hover:bg-[#4d42cc] disabled:opacity-60"
                aria-label="Confirmar etapa"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </button>
            </div>
            {inputError && (
              <p className="text-left text-[12px] text-rose-500">{inputError}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleOpenInput}
              className="rounded-xl border border-[#e2e8f0] px-5 py-2.5 text-sm font-semibold text-[#1a202c] transition hover:border-[#594ded] hover:text-[#594ded]"
            >
              Criar primeira etapa
            </button>
            <button
              type="button"
              onClick={onLoadTemplate}
              className="rounded-xl bg-[#594ded] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#594ded]/20 transition hover:bg-[#4d42cc]"
            >
              Carregar template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
