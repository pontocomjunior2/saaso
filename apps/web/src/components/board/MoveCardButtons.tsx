'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DetailedCard } from './board-types';
import api from '@/lib/api';

interface StageRef {
  id: string;
  name: string;
  order: number;
}

export function MoveCardButtons({
  card,
  stages,
  onCardMoved,
}: {
  card: DetailedCard;
  stages: StageRef[];
  onCardMoved: () => void;
}) {
  const [isMoving, setIsMoving] = useState(false);

  const sorted = [...stages].sort((a, b) => a.order - b.order);
  const currentIndex = sorted.findIndex((s) => s.id === card.stageId);

  const prevStage = currentIndex > 0 ? sorted[currentIndex - 1] : null;
  const nextStage = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;

  const moveCard = async (targetStage: StageRef) => {
    if (isMoving) return;
    setIsMoving(true);
    try {
      await api.patch(`/cards/${card.id}/move`, {
        destinationStageId: targetStage.id,
        destinationIndex: 0,
      });
      onCardMoved();
    } catch (err) {
      console.error('Erro ao mover card', err);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => prevStage && moveCard(prevStage)}
        disabled={!prevStage || isMoving}
        title={prevStage ? `Mover para: ${prevStage.name}` : 'Ja esta na primeira etapa'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition',
          prevStage
            ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300',
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        Retroceder
      </button>

      <button
        type="button"
        onClick={() => nextStage && moveCard(nextStage)}
        disabled={!nextStage || isMoving}
        title={nextStage ? `Mover para: ${nextStage.name}` : 'Ja esta na ultima etapa'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition',
          nextStage
            ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            : 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300',
        )}
      >
        Avancar
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
