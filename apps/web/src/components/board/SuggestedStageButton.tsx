'use client';

import { useState } from 'react';
import api from '@/lib/api';

interface SuggestedStageButtonProps {
  cardId: string;
  suggestedStageId: string | null;
  stageName: string | null;
  onMoved?: () => void;
}

export function SuggestedStageButton({
  cardId,
  suggestedStageId,
  stageName,
  onMoved,
}: SuggestedStageButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInvalidStage = !suggestedStageId || !stageName;

  const handleClick = async () => {
    if (!suggestedStageId || busy) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await api.patch(`/cards/${cardId}/move`, {
        destinationStageId: suggestedStageId,
        destinationIndex: 0,
      });
      onMoved?.();
    } catch {
      setError('Não foi possível mover o card. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={busy || isInvalidStage}
        className="inline-flex items-center gap-2 rounded-md bg-[#594ded] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#4a3fd6] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isInvalidStage
          ? 'Estágio sugerido inválido — selecione manualmente'
          : busy
            ? 'Movendo...'
            : `Mover para ${stageName}`}
      </button>
      {error ? <p className="mt-1 text-xs text-[#fc736f]">{error}</p> : null}
    </div>
  );
}
