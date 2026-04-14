'use client';

import { useState } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import { useKanbanStore } from '@/stores/useKanbanStore';

interface AddStageButtonProps {
  pipelineId: string;
}

export function AddStageButton({ pipelineId }: AddStageButtonProps) {
  const { createStage } = useKanbanStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [stageName, setStageName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const handleExpand = () => {
    setIsExpanded(true);
    setStageName('');
    setInputError(null);
  };

  const handleConfirm = async () => {
    const trimmed = stageName.trim();
    if (!trimmed) {
      setInputError('Digite um nome.');
      return;
    }

    setIsSubmitting(true);
    setInputError(null);

    try {
      await createStage(pipelineId, trimmed);
      setIsExpanded(false);
      setStageName('');
    } catch {
      setInputError('Erro ao criar etapa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void handleConfirm();
    } else if (e.key === 'Escape') {
      setIsExpanded(false);
      setStageName('');
      setInputError(null);
    }
  };

  if (isExpanded) {
    return (
      <div className="flex min-h-[38rem] w-[21rem] min-w-[21rem] flex-col pt-3">
        <div className="flex flex-col gap-2">
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
            <p className="text-[12px] text-rose-500">{inputError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[38rem] w-16 min-w-[64px] flex-col items-center justify-start pt-1">
      <button
        type="button"
        onClick={handleExpand}
        className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-[#e2e8f0] bg-transparent text-[#a0aec0] transition hover:border-[#594ded] hover:bg-[#f5f3ff] hover:text-[#594ded]"
        aria-label="Adicionar nova etapa"
        style={{ minHeight: '8rem', maxHeight: '12rem' }}
      >
        <Plus className="h-5 w-5" />
        <span
          className="text-[11px] font-semibold tracking-wider"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          Nova Etapa
        </span>
      </button>
    </div>
  );
}
