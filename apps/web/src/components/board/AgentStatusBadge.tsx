'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface ConversationState {
  id: string;
  status: 'OPEN' | 'HANDOFF_REQUIRED' | 'CLOSED';
}

interface Props {
  agentName: string | null;
  conversation: ConversationState | null;
  onUpdated: () => void;
}

export function AgentStatusBadge({ agentName, conversation, onUpdated }: Props) {
  const [optimisticStatus, setOptimisticStatus] = useState<ConversationState['status'] | null>(conversation?.status ?? null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOptimisticStatus(conversation?.status ?? null);
    setError(null);
  }, [conversation]);

  const effectiveStatus = optimisticStatus ?? conversation?.status ?? null;
  const isOpen = effectiveStatus === 'OPEN';
  const isTakeover = effectiveStatus === 'HANDOFF_REQUIRED';

  const badgeClasses = isOpen
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : isTakeover
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-100 text-slate-600';

  const badgeLabel = isOpen
    ? 'Piloto automático'
    : isTakeover
      ? 'Takeover humano'
      : 'Sem conversa ativa';

  const buttonLabel = isOpen ? 'Assumir conversa' : 'Devolver ao agente';
  const buttonClasses = isOpen
    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';

  const handleToggle = async () => {
    if (!conversation) return;

    const previousStatus = effectiveStatus ?? conversation.status;
    const nextStatus = previousStatus === 'OPEN' ? 'HANDOFF_REQUIRED' : 'OPEN';

    setOptimisticStatus(nextStatus);
    setIsBusy(true);
    setError(null);

    try {
      await api.post(`/agent-conversations/${conversation.id}/toggle-takeover`);
      onUpdated();
    } catch {
      setOptimisticStatus(previousStatus);
      setError('Não foi possível alterar o status do agente. Tente novamente.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${badgeClasses}`}>
          {badgeLabel}
        </span>
        {agentName ? <span className="text-sm font-medium text-slate-500">{agentName}</span> : null}
      </div>

      {conversation ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleToggle()}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition disabled:opacity-60 ${buttonClasses}`}
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {buttonLabel}
        </button>
      ) : null}

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
