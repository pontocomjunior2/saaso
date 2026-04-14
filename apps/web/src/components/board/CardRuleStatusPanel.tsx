'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import type { StageRuleRun } from './board-types';
import api from '@/lib/api';

interface Props {
  run: StageRuleRun | null;
  cardId: string;
  stageId: string;
  onUpdated: () => void;
}

export function CardRuleStatusPanel({ run, cardId, stageId, onUpdated }: Props) {
  const [optimisticStatus, setOptimisticStatus] = useState<StageRuleRun['status'] | null>(run?.status ?? null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticStatus(run?.status ?? null);
    setError(null);
  }, [run]);

  const effectiveStatus = optimisticStatus ?? run?.status ?? null;
  const isRunning = effectiveStatus === 'RUNNING';
  const isPaused = effectiveStatus === 'PAUSED';
  const hasRun = Boolean(run);

  const statusCopy = useMemo(() => {
    if (isRunning) {
      return { label: 'Régua em execução', dot: 'bg-[#22bd73]' };
    }
    if (isPaused) {
      return { label: 'Régua pausada', dot: 'bg-[#d9d9d9]' };
    }
    if (effectiveStatus === 'CANCELED') {
      return { label: 'Régua cancelada', dot: 'bg-[#fc736f]' };
    }
    if (effectiveStatus === 'COMPLETED') {
      return { label: 'Régua concluída', dot: 'bg-[#22bd73]' };
    }
    if (effectiveStatus === 'FAILED') {
      return { label: 'Régua com erro', dot: 'bg-[#fc736f]' };
    }
    return { label: 'Sem régua ativa', dot: 'bg-[#d9d9d9]' };
  }, [effectiveStatus, isPaused, isRunning]);

  const handleToggle = async () => {
    if (!hasRun || !run?.id) return;

    const previousStatus = effectiveStatus ?? run.status;
    const nextStatus: StageRuleRun['status'] = previousStatus === 'PAUSED' ? 'RUNNING' : 'PAUSED';

    setOptimisticStatus(nextStatus);
    setIsBusy(true);
    setError(null);

    try {
      if (previousStatus === 'PAUSED') {
        await api.post(`/stage-rule-runs/${run.id}/resume`);
      } else {
        await api.post(`/stage-rule-runs/${run.id}/pause`);
      }
      onUpdated();
    } catch {
      setOptimisticStatus(previousStatus);
      setError('Não foi possível alterar o status da régua. Tente novamente.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleStart = async () => {
    setIsBusy(true);
    setError(null);
    try {
      await api.post(`/cards/${cardId}/stage-rule/start`, { stageId });
      onUpdated();
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : null;
      setError(
        typeof message === 'string'
          ? message
          : 'Não foi possível iniciar a régua. Tente novamente.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#a0aec0]">Status da régua</p>
          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className={`h-2.5 w-2.5 rounded-full ${statusCopy.dot}`} />
            {statusCopy.label}
          </div>
          {run?.nextRunAt ? (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Próxima revisão em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(run.nextRunAt))}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Controle direto da execução da régua para este card.
            </p>
          )}
        </div>

        {hasRun ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleToggle()}
            aria-label={isRunning ? 'Pausar régua' : 'Retomar régua'}
            className={`inline-flex h-8 w-16 items-center rounded-full px-1 transition ${isRunning ? 'bg-[#22bd73]' : 'bg-[#d9d9d9]'}`}
          >
            <span className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition ${isRunning ? 'translate-x-8' : 'translate-x-0'}`}>
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#9e9e9e]" /> : null}
            </span>
          </button>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => void handleStart()}
            className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-semibold text-[#594ded] hover:border-[#594ded] hover:bg-[#f5f3ff] disabled:opacity-60"
          >
            Iniciar régua
          </button>
        )}
      </div>

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
