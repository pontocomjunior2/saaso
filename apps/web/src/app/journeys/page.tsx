'use client';

import React, { useEffect, useState } from 'react';
import { Activity, CircleDot, Clock3, Edit, Play, Plus, Trash2 } from 'lucide-react';
import { useJourneyStore } from '../../stores/useJourneyStore';
import { useRouter } from 'next/navigation';

const executionStatusMeta: Record<string, { label: string; className: string }> = {
  COMPLETED: {
    label: 'Concluida',
    className: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
  },
  RUNNING: {
    label: 'Executando',
    className: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
  },
  FAILED: {
    label: 'Falhou',
    className: 'border-rose-400/20 bg-rose-500/10 text-rose-100',
  },
  SKIPPED: {
    label: 'Ignorada',
    className: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
  },
  PENDING: {
    label: 'Pendente',
    className: 'border-slate-400/20 bg-slate-500/10 text-slate-200',
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
      <section className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.88)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.22)] lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Réguas</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Runtime, filas e playbooks em execução.</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              O módulo agora precisa se comportar como console de automação: backlog real, driver visível e atalhos
              claros para editar ou disparar a régua certa.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 xl:max-w-[40rem] xl:justify-end">
            <div className="grid min-w-[13rem] flex-1 gap-2 rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Réguas</span>
                <span className="text-lg font-semibold text-white">{journeys.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span>Ativas {journeyMetrics.active}</span>
                <span>Execuções {journeyMetrics.executions}</span>
              </div>
            </div>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 font-medium text-slate-950 transition hover:translate-y-[-1px]"
            >
              <Plus className="h-4 w-4" />
              Nova régua
            </button>
          </div>
        </div>
      </section>

      {feedback ? (
        <div className="rounded-[24px] border border-cyan-300/12 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
          {feedback}
        </div>
      ) : null}

      {runtimeStatus ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-[28px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Runtime driver</div>
            <div className="mt-3 flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${runtimeStatus.driver === 'bullmq' ? 'bg-emerald-400' : 'bg-amber-300'}`} />
              <div>
                <div className="text-lg font-semibold text-white">
                  {runtimeStatus.driver === 'bullmq' ? 'BullMQ + Redis' : 'Poller interno'}
                </div>
                <p className="text-sm text-slate-400">
                  {runtimeStatus.queueOperational
                    ? 'Fila externa operacional com fallback ativo.'
                    : 'Fila externa indisponível; o runtime segue pelo poller.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Fila operacional</div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <div className="text-3xl font-semibold text-white">{runtimeStatus.pendingJobs}</div>
                <p className="text-sm text-slate-400">
                  pendentes · {runtimeStatus.runningJobs} rodando · {runtimeStatus.deadLetterJobs} dead-letter
                </p>
              </div>
              <div className="text-right text-sm text-slate-400">
                <div>Próximo disparo</div>
                <div className="mt-1 text-white">
                  {runtimeStatus.nextScheduledAt ? new Date(runtimeStatus.nextScheduledAt).toLocaleString() : 'Sem agendamento'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]">
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Política do runtime</div>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
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
        <div className="rounded-[24px] border border-amber-300/15 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          BullMQ indisponível no último check: {runtimeStatus.lastQueueError}
        </div>
      ) : null}

      {runtimeStatus && runtimeStatus.recentDeadLetters.length > 0 ? (
        <div className="rounded-[28px] border border-rose-400/15 bg-[rgba(32,9,18,0.76)] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-rose-200/70">Dead-letter recente</div>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Jobs falhos mais recentes do runtime
              </h2>
              <p className="mt-1 text-sm text-rose-100/70">
                Use este bloco para localizar rapidamente a régua afetada e abrir o builder com contexto.
              </p>
            </div>
            <div className="rounded-full border border-rose-300/15 bg-rose-400/10 px-3 py-1 text-xs font-medium text-rose-100">
              {runtimeStatus.deadLetterJobs} em dead-letter
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {runtimeStatus.recentDeadLetters.map((job) => (
              <button
                key={job.jobId}
                onClick={() => router.push(`/journeys/${job.journeyId}`)}
                className="rounded-[24px] border border-rose-300/12 bg-white/5 p-4 text-left transition hover:border-rose-300/30 hover:bg-white/[0.08]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-white">{job.nodeLabel ?? job.nodeId}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-rose-100/55">
                      {job.journeyName}
                    </div>
                  </div>
                  <span className="rounded-full border border-rose-300/15 bg-rose-400/10 px-2.5 py-1 text-[11px] font-medium text-rose-100">
                    {job.actionType ?? 'runtime'}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-sm text-rose-50/80">
                  <p>{job.deadLetterReason ?? 'Sem motivo registrado.'}</p>
                  <p className="text-xs text-rose-100/55">
                    Dead-letter em{' '}
                    {job.deadLetteredAt ? new Date(job.deadLetteredAt).toLocaleString() : 'horário não registrado'}
                  </p>
                  <p className="text-xs text-rose-100/55">
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
          <div className="col-span-full rounded-[30px] border border-dashed border-white/10 bg-[rgba(7,16,29,0.72)] py-12 text-center">
            <Activity className="mx-auto mb-3 h-12 w-12 text-slate-700" />
            <p className="text-slate-400">Você ainda não possui nenhuma jornada configurada.</p>
          </div>
        ) : (
          journeys.map((journey) => {
            const lastExecutionMeta = journey.lastExecutionStatus
              ? executionStatusMeta[journey.lastExecutionStatus]
              : null;

            return (
              <div
                key={journey.id}
                className="group relative rounded-[28px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)] transition hover:border-cyan-300/20 hover:bg-[rgba(9,19,35,0.9)]"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CircleDot className={`h-3 w-3 ${journey.isActive ? 'text-green-500' : 'text-gray-300'}`} />
                    <h3 className="truncate font-semibold text-white" title={journey.name}>
                      {journey.name}
                    </h3>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => router.push(`/journeys/${journey.id}`)}
                      className="rounded-xl border border-white/10 bg-white/[0.05] p-1.5 text-slate-400 transition-colors hover:border-cyan-300/20 hover:bg-cyan-300/10 hover:text-cyan-100"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Certeza que deseja deletar a jornada ${journey.name}?`)) {
                          deleteJourney(journey.id);
                        }
                      }}
                      className="rounded-xl border border-white/10 bg-white/[0.05] p-1.5 text-slate-400 transition-colors hover:border-rose-400/20 hover:bg-rose-500/10 hover:text-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mb-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm text-slate-500">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Nós</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        {Array.isArray(journey.nodes) ? journey.nodes.length : 0}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Execuções</div>
                      <div className="mt-1 text-lg font-semibold text-white">{journey.executionCount}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs uppercase tracking-[0.18em] text-slate-400">Última execução</span>
                      {lastExecutionMeta ? (
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${lastExecutionMeta.className}`}>
                          {lastExecutionMeta.label}
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-400">
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

                <div className="flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-xs text-slate-400">
                    Criada em {new Date(journey.createdAt).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => handleTrigger(journey.id)}
                    disabled={!journey.isActive || busyJourneyId === journey.id}
                    className="flex items-center gap-1.5 text-sm font-medium text-emerald-200 transition-colors hover:text-emerald-100 disabled:cursor-not-allowed disabled:text-slate-500"
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
