'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { useKanbanStore } from '@/stores/useKanbanStore';
import { cn } from '@/lib/utils';

interface CardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  pipelineId: string;
  cardId?: string; // If provided, we are in edit mode
  initialTitle?: string;
  initialStageId?: string;
}

export function CardFormModal({
  isOpen,
  onClose,
  pipelineId,
  cardId,
  initialTitle = '',
  initialStageId = '',
}: CardFormModalProps) {
  const { pipeline, createCard, updateCard, deleteCard, isLoading } = useKanbanStore();
  const [title, setTitle] = useState(initialTitle);
  const [stageId, setStageId] = useState(initialStageId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setStageId(initialStageId || (pipeline?.stages[0]?.id ?? ''));
      setError(null);
    }
  }, [isOpen, initialTitle, initialStageId, pipeline]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !stageId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (cardId) {
        await updateCard(cardId, { title, stageId });
      } else {
        await createCard(stageId, title);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar o card');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!cardId || !window.confirm('Tem certeza que deseja excluir este card?')) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await deleteCard(cardId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir o card');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg overflow-hidden rounded-[24px] border border-[#f0f0f0] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#f0f0f0] px-6 py-5">
          <h2 className="text-xl font-bold text-[#1a202c]">
            {cardId ? 'Editar Card' : 'Novo Card'}
          </h2>
          <button 
            onClick={onClose}
            className="rounded-lg p-1 text-[#a0aec0] transition hover:bg-[#f7f7f7] hover:text-[#718096]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-[#545a66]">
                Título do Card
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Landing Page Design"
                className="mt-2 h-12 w-full rounded-xl border border-[#f0f0f0] bg-white px-4 text-[15px] outline-none transition placeholder:text-[#a0aec0] focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
                required
              />
            </div>

            <div>
              <label htmlFor="stage" className="block text-sm font-semibold text-[#545a66]">
                Etapa do Funil
              </label>
              <select
                id="stage"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-[#f0f0f0] bg-white px-4 text-[15px] outline-none transition focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
                required
              >
                {pipeline?.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            {cardId ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </button>
            ) : <div />}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-11 rounded-xl px-5 text-sm font-semibold text-[#718096] transition hover:bg-[#f7f7f7]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="flex h-11 items-center justify-center rounded-xl bg-[#594ded] px-6 text-sm font-semibold text-white shadow-md shadow-[#594ded]/20 transition hover:bg-[#4d42cc] disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  cardId ? 'Salvar Alterações' : 'Criar Card'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
