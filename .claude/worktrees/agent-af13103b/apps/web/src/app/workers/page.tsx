'use client';

import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Bot, CircleDot, LoaderCircle, Sparkles, Workflow } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useUIMode } from '@/components/layout/UIModeProvider';

interface Worker {
  id: string;
  name: string;
  systemPrompt: string;
  isActive: boolean;
  stage: {
    id: string;
    name: string;
    pipeline: {
      id: string;
      name: string;
    };
  } | null;
  metrics: {
    totalCardsInStage: number;
    autopilot: number;
    takeover: number;
    waitingDelay: number;
    running: number;
    completed: number;
    failed: number;
    idle: number;
  };
  recentCards: Array<{
    id: string;
    title: string;
    automationStatus:
      | 'TAKEOVER'
      | 'AGENT_PAUSED'
      | 'RUNNING'
      | 'WAITING_DELAY'
      | 'COMPLETED'
      | 'FAILED'
      | 'AUTOPILOT'
      | 'IDLE';
    automationLabel: string;
    contactName: string | null;
  }>;
}

const statusTone: Record<string, string> = {
  AUTOPILOT: 'bg-emerald-100 text-emerald-700',
  TAKEOVER: 'bg-amber-100 text-amber-700',
  WAITING_DELAY: 'bg-sky-100 text-sky-700',
  RUNNING: 'bg-cyan-100 text-cyan-700',
  COMPLETED: 'bg-indigo-100 text-indigo-700',
  FAILED: 'bg-rose-100 text-rose-700',
  AGENT_PAUSED: 'bg-amber-100 text-amber-700',
  IDLE: 'bg-slate-100 text-slate-600',
};

export default function WorkersPage() {
  const { mode } = useUIMode();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const response = await api.get<Worker[]>('/agents/overview');
        if (mounted) {
          setWorkers(response.data);
        }
      } catch {
        if (mounted) {
          setError('Nao foi possivel carregar os workers configurados.');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const globalMetrics = useMemo(() => {
    return workers.reduce(
      (summary, worker) => {
        summary.autopilot += worker.metrics.autopilot;
        summary.takeover += worker.metrics.takeover;
        summary.waitingDelay += worker.metrics.waitingDelay;
        summary.running += worker.metrics.running;
        return summary;
      },
      { autopilot: 0, takeover: 0, waitingDelay: 0, running: 0 },
    );
  }, [workers]);

  return (
    <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-6 p-6 lg:p-8">
      <section className={cn('rounded-[30px] border p-6', mode === 'simple' ? 'border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.045)]' : 'border-white/[0.08] bg-[rgba(13,22,34,0.88)] shadow-[0_20px_72px_rgba(0,0,0,0.22)]')}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.3em]', mode === 'simple' ? 'border-slate-200 bg-[#eef6ff] text-cyan-700' : 'border-cyan-300/15 bg-cyan-300/[0.08] text-cyan-100')}>
              <Sparkles className="h-3.5 w-3.5" />
              Workers IA
            </div>
            <h2 className={cn('mt-5 text-3xl font-semibold lg:text-[2.2rem]', mode === 'simple' ? 'text-slate-900' : 'text-white')}>Quem está operando cada etapa do funil.</h2>
            <p className={cn('mt-3 text-sm leading-7', mode === 'simple' ? 'text-slate-500' : 'text-slate-400')}>
              Esta tela mostra os workers ativos no tenant, o volume operacional por agente e os cards recentes que cada um está acompanhando.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Piloto automático', value: globalMetrics.autopilot },
              { label: 'Takeover', value: globalMetrics.takeover },
              { label: 'Aguardando delay', value: globalMetrics.waitingDelay },
              { label: 'Em execução', value: globalMetrics.running },
            ].map((item) => (
              <div key={item.label} className={cn('rounded-[22px] border px-4 py-3', mode === 'simple' ? 'border-slate-200 bg-[#f8f9fb]' : 'border-white/[0.08] bg-white/[0.03]')}>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                <p className={cn('mt-2 text-xl font-semibold', mode === 'simple' ? 'text-slate-900' : 'text-white')}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {error ? <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">{error}</div> : null}

      {isLoading ? (
        <div className={cn('flex min-h-[28rem] items-center justify-center rounded-[30px] border', mode === 'simple' ? 'border-slate-200 bg-white text-slate-500' : 'border-white/[0.08] bg-[rgba(13,22,34,0.88)] text-slate-400')}>
          <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
          Carregando workers...
        </div>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {workers.map((worker) => (
            <article key={worker.id} className={cn('rounded-[30px] border p-5', mode === 'simple' ? 'border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.045)]' : 'border-white/[0.08] bg-[rgba(13,22,34,0.88)] shadow-[0_16px_48px_rgba(0,0,0,0.18)]')}>
              <div className="flex items-start justify-between gap-3">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl border', mode === 'simple' ? 'border-slate-200 bg-[#eef6ff] text-cyan-700' : 'border-white/[0.08] bg-white/[0.04] text-cyan-100')}>
                  <Bot className="h-5 w-5" />
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${worker.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {worker.isActive ? 'Ativo' : 'Pausado'}
                </span>
              </div>

              <h3 className={cn('mt-4 text-xl font-semibold', mode === 'simple' ? 'text-slate-900' : 'text-white')}>{worker.name}</h3>
              <div className={cn('mt-3 flex items-center gap-2 text-sm', mode === 'simple' ? 'text-slate-500' : 'text-slate-400')}>
                <Workflow className={cn('h-4 w-4', mode === 'simple' ? 'text-cyan-700' : 'text-cyan-100')} />
                <span>{worker.stage ? `${worker.stage.pipeline.name} · ${worker.stage.name}` : 'Sem etapa vinculada'}</span>
              </div>
              <p className={cn('mt-4 line-clamp-4 text-sm leading-6', mode === 'simple' ? 'text-slate-600' : 'text-slate-300')}>{worker.systemPrompt || 'Sem instruções configuradas.'}</p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  { label: 'Cards da etapa', value: worker.metrics.totalCardsInStage },
                  { label: 'Autônomos', value: worker.metrics.autopilot },
                  { label: 'Takeover', value: worker.metrics.takeover },
                  { label: 'Delay', value: worker.metrics.waitingDelay },
                ].map((metric) => (
                  <div key={metric.label} className={cn('rounded-[20px] border px-4 py-3', mode === 'simple' ? 'border-slate-200 bg-[#f8f9fb]' : 'border-white/[0.08] bg-white/[0.03]')}>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{metric.label}</p>
                    <p className={cn('mt-2 text-lg font-semibold', mode === 'simple' ? 'text-slate-900' : 'text-white')}>{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className={cn('mt-5 rounded-[24px] border p-4', mode === 'simple' ? 'border-slate-200 bg-[#f8f9fb]' : 'border-white/[0.08] bg-white/[0.03]')}>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <CircleDot className="h-3.5 w-3.5" />
                  Cards recentes
                </div>

                <div className="mt-3 space-y-3">
                  {worker.recentCards.length > 0 ? (
                    worker.recentCards.map((card) => (
                      <div key={card.id} className={cn('rounded-[18px] border px-4 py-3', mode === 'simple' ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-black/10')}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className={cn('truncate text-sm font-medium', mode === 'simple' ? 'text-slate-900' : 'text-white')}>{card.title}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{card.contactName || 'Sem contato vinculado'}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${statusTone[card.automationStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                            {card.automationLabel}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Nenhum card recente para este worker.</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
