'use client';

import React, { useEffect, useState } from 'react';
import { Activity, CircleDot, Clock3, Edit, Play, Plus, Trash2 } from 'lucide-react';
import { useJourneyStore } from '../../stores/useJourneyStore';
import { useRouter } from 'next/navigation';

const executionStatusMeta: Record<string, { label: string; className: string }> = {
  COMPLETED: {
    label: 'Concluida',
    className: 'border-emerald-300 bg-emerald-100 text-emerald-700',
  },
  RUNNING: {
    label: 'Executando',
    className: 'border-cyan-300 bg-cyan-100 text-cyan-700',
  },
  FAILED: {
    label: 'Falhou',
    className: 'border-rose-300 bg-rose-100 text-rose-700',
  },
  SKIPPED: {
    label: 'Ignorada',
    className: 'border-amber-300 bg-amber-100 text-amber-700',
  },
  PENDING: {
    label: 'Pendente',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
  },
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export default function JourneysPage() {
  const router = useRouter();
  const {
    journeys,
    runtimeStatus,
    isLoading,
    fetchJourneys,
    fetchRuntimeStatus,
    deleteJourney,
    createJourney,
    triggerJourney,
  } = useJourneyStore();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyJourneyId, setBusyJourneyId] = useState<string | null>(null);

  useEffect(() => {
    fetchJourneys();
    fetchRuntimeStatus();
  }, [fetchJourneys, fetchRuntimeStatus]);

  const journeyMetrics = journeys.reduce(
    (summary, journey) => {
      if (journey.isActive) {
        summary.active += 1;
      }

      summary.executions += journey.executionCount;
      return summary;
    },
    { active: 0, executions: 0 },
  );

  const handleCreateNew = async () => {
    const name = prompt('Nome da nova jornada:');
    if (!name) return;

    try {
      const newJourney = await createJourney({
        name,
        nodes: [],
        edges: [],
        isActive: false,
      });
      router.push(`/journeys/${newJourney.id}`);
    } catch (error: unknown) {
      setFeedback(getErrorMessage(error, 'Erro ao criar jornada.'));
    }
  };

  const handleTrigger = async (journeyId: string) => {
    setBusyJourneyId(journeyId);
    setFeedback(null);

    try {
      const execution = await triggerJourney(journeyId, {
        origin: 'manual_ui',
        requestedAt: new Date().toISOString(),
      });
      const statusLabel = executionStatusMeta[execution.status]?.label ?? execution.status;
      setFeedback(`Execucao registrada com status ${statusLabel.toLowerCase()}.`);
    } catch (error: unknown) {
      setFeedback(getErrorMessage(error, 'Erro ao disparar jornada.'));
    } finally {
      setBusyJourneyId(null);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 p-6 lg:p-8">
      <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)] lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Réguas</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Runtime, filas e playbooks em execução.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">
              O módulo agora precisa se comportar como console de automação: backlog real, driver visível e atalhos
              claros para editar ou disparar a régua certa.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 xl:max-w-[40rem] xl:justify-end">
            <div className="grid min-w-[13rem] flex-1 gap-2 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Réguas</span>
                <span className="text-lg font-semibold text-slate-900">{journeys.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>Ativas {journeyMetrics.active}</span>
                <span>Execuções {journeyMetrics.executions}</span>
              </div>
            </div>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 rounded-2xl bg-[#594ded] px-4 py-3 font-medium text-white transition hover:translate-y-[-1px] hover:bg-[#4f44d7]"
            >
              <Plus className="h-4 w-4" />
              Nova régua
            </button>
          </div>
        </div>
      </section>

      {feedback ? (
        <div className="rounded-[24px] border border-[#594ded]/20 bg-[#e8e6fc] px-4 py-3 text-sm text-[#594ded]">
          {feedback}
        </div>
      ) : null}

      {runtimeStatus ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Runtime driver</div>
            <div className="mt-3 flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${runtimeStatus.driver === 'bullmq' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {runtimeStatus.driver === 'bullmq' ? 'BullMQ + Redis' : 'Poller interno'}
                </div>
                <p className="text-sm text-slate-500">
                  {runtimeStatus.queueOperational
                    ? 'Fila externa operacional com fallback ativo.'
                    : 'Fila externa indisponível; o runtime segue pelo poller.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Fila operacional</div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <div className="text-3xl font-semibold text-slate-900">{runtimeStatus.pendingJobs}</div>
                <p className="text-sm text-slate-500">
                  pendentes · {runtimeStatus.runningJobs} rodando · {runtimeStatus.deadLetterJobs} dead-letter
                </p>
              </div>
              <div className="text-right text-sm text-slate-500">
                <div>Próximo disparo</div>
                <div className="mt-1 font-medium text-slate-900">
                  {runtimeStatus.nextScheduledAt ? new Date(runtimeStatus.nextScheduledAt).toLocaleString() : 'Sem agendamento'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Política do runtime</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>Retry: {runtimeStatus.maxJobAttempts} tentativa(s)</p>
              <p>Backoff: {runtimeStatus.retryDelayInSeconds}s</p>
              <p>Fallback poller: {runtimeStatus.runtimePollMs}ms</p>
              <p>Worker: {runtimeStatus.workerConcurrency} concorrência</p>
              <p>
                Redis: {runtimeStatus.redisHost ?? 'n/d'}
                {runtimeStatus.redisPort ? `:${runtimeStatus.redisPort}` : ''}
              </p>
              <p>
                Telemetria: {runtimeStatus.totalEnqueuedJobs} enfileirado(s) · {runtimeStatus.totalProcessedJobs} processado(s)
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {runtimeStatus?.lastQueueError ? (
        <div className="rounded-[24px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          BullMQ indisponível no último check: {runtimeStatus.lastQueueError}
        </div>
      ) : null}

      {runtimeStatus && runtimeStatus.recentDeadLetters.length > 0 ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-rose-500">Dead-letter recente</div>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                Jobs falhos mais recentes do runtime
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Use este bloco para localizar rapidamente a régua afetada e abrir o builder com contexto.
              </p>
            </div>
            <div className="rounded-full border border-rose-300 bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">
              {runtimeStatus.deadLetterJobs} em dead-letter
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {runtimeStatus.recentDeadLetters.map((job) => (
              <button
                key={job.jobId}
                onClick={() => router.push(`/journeys/${job.journeyId}`)}
                className="rounded-[24px] border border-rose-200 bg-white p-4 text-left transition hover:border-rose-300 hover:bg-rose-50/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{job.nodeLabel ?? job.nodeId}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-rose-500">
                      {job.journeyName}
                    </div>
                  </div>
                  <span className="rounded-full border border-rose-200 bg-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                    {job.actionType ?? 'runtime'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                  <p>{job.deadLetterReason ?? 'Sem motivo registrado.'}</p>
                  <p className="text-xs text-slate-400">
                    Dead-letter em{' '}
                    {job.deadLetteredAt ? new Date(job.deadLetteredAt).toLocaleString() : 'horário não registrado'}
                  </p>
                  <p className="text-xs text-slate-400">
                    Execution {job.executionId.slice(0, 8)} · requeue manual {job.manualRequeueCount}x
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && journeys.length === 0 ? (
          <p className="text-slate-400">Carregando automações...</p>
        ) : journeys.length === 0 ? (
          <div className="col-span-full rounded-[30px] border border-dashed border-slate-200 bg-white py-12 text-center">
            <Activity className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="text-slate-500">Você ainda não possui nenhuma jornada configurada.</p>
          </div>
        ) : (
          journeys.map((journey) => {
            const lastExecutionMeta = journey.lastExecutionStatus
              ? executionStatusMeta[journey.lastExecutionStatus]
              : null;

            return (
              <div
                key={journey.id}
                className="group relative rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.06)] transition hover:border-[#594ded]/30 hover:shadow-[0_4px_20px_rgba(89,77,237,0.08)]"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CircleDot className={`h-3 w-3 ${journey.isActive ? 'text-emerald-500' : 'text-slate-300'}`} />
                    <h3 className="truncate font-semibold text-slate-900" title={journey.name}>
                      {journey.name}
                    </h3>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => router.push(`/journeys/${journey.id}`)}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-1.5 text-slate-400 transition-colors hover:border-[#594ded]/20 hover:bg-[#e8e6fc] hover:text-[#594ded]"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Certeza que deseja deletar a jornada ${journey.name}?`)) {
                          deleteJourney(journey.id);
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-1.5 text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-100 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-500">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Nós</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">
                        {Array.isArray(journey.nodes) ? journey.nodes.length : 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Execuções</div>
                      <div className="mt-1 text-lg font-semibold text-slate-900">{journey.executionCount}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Última execução</span>
                      {lastExecutionMeta ? (
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${lastExecutionMeta.className}`}>
                          {lastExecutionMeta.label}
                        </span>
                      ) : (
                        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                          Sem histórico
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <Clock3 className="h-4 w-4 text-slate-400" />
                      {journey.lastExecutionAt
                        ? new Date(journey.lastExecutionAt).toLocaleString()
                        : 'Ainda não executada'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <span className="text-xs text-slate-400">
                    Criada em {new Date(journey.createdAt).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => handleTrigger(journey.id)}
                    disabled={!journey.isActive || busyJourneyId === journey.id}
                    className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    <Play className="h-4 w-4" />
                    {busyJourneyId === journey.id ? 'Disparando...' : 'Disparar'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
