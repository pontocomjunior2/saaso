'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { StageAgentOption } from '@/stores/useKanbanStore';

interface Props {
  stageId: string;
  currentAgentId: string | null;
  currentCriteria: string | null;
  agents: StageAgentOption[];
  onSave: (agentId: string | null, classificationCriteria: string | null) => Promise<void>;
}

export function AgentStepConfig({
  stageId,
  currentAgentId,
  currentCriteria,
  agents,
  onSave,
}: Props) {
  const [agentId, setAgentId] = useState<string>(currentAgentId ?? '');
  const [criteria, setCriteria] = useState(currentCriteria ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAgentId(currentAgentId ?? '');
    setCriteria(currentCriteria ?? '');
    setError(null);
  }, [currentAgentId, currentCriteria, stageId]);

  const availableAgents = agents;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(agentId || null, criteria.trim() || null);
    } catch {
      setError('Erro ao salvar configuração do agente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (agents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#e2e8f0] px-4 py-6 text-sm leading-6 text-[#718096]">
        <p>Nenhum agente atribuído a esta etapa.</p>
        <a href="/agentes" className="mt-2 inline-flex text-sm font-semibold text-[#594ded] hover:text-[#4d42cc]">
          Ir para /agentes
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#718096]">
          Agente da etapa
        </label>
        <select
          value={agentId}
          onChange={(event) => setAgentId(event.target.value)}
          className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1a202c] outline-none focus:border-[#594ded]"
        >
          <option value="">Nenhum agente</option>
          {availableAgents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#718096]">
          Critérios de classificação
        </label>
        <textarea
          rows={4}
          value={criteria}
          onChange={(event) => setCriteria(event.target.value)}
          className="w-full resize-none rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1a202c] outline-none focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
          placeholder="Ex: cliente confirmou interesse"
        />
        <p className="mt-2 text-[11px] text-[#a0aec0]">
          Critérios que o agente usa para classificar o lead como positivo e mover o card.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#594ded] px-4 py-2 text-sm font-bold text-white hover:bg-[#4d42cc] disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Salvar agente
        </button>
      </div>
    </div>
  );
}
