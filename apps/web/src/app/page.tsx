'use client';

import KanbanBoard from '@/components/board/KanbanBoard';
import { CardDetailSheet } from '@/components/board/CardDetailSheet';
import type { DetailedCard, PipelineSummary } from '@/components/board/board-types';
import api from '@/lib/api';
import Link from 'next/link';
import { Bot, KanbanSquare, MessageSquareMore, Orbit, Sparkles, Wand2, Workflow } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface WorkerOverview {
  id: string;
  name: string;
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
  };
}

interface InboxThreadSummary {
  contact: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    company: {
      id: string;
      name: string;
    } | null;
  };
  latestMessage: {
    id: string;
    content: string;
    createdAt: string;
  } | null;
  latestConversation: {
    id: string;
    status: 'OPEN' | 'HANDOFF_REQUIRED' | 'CLOSED';
    updatedAt: string;
  } | null;
  assignedAgent: {
    id: string;
    name: string;
    isActive: boolean;
  } | null;
  messageCount: number;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Sem registro';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatShortTime(value?: string | null) {
  if (!value) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function Home() {
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<DetailedCard | null>(null);
  const [workers, setWorkers] = useState<WorkerOverview[]>([]);
  const [threads, setThreads] = useState<InboxThreadSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCardLoading, setIsCardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [pipelineResponse, workerResponse, inboxResponse] = await Promise.all([
          api.get<PipelineSummary[]>('/pipelines'),
          api.get<WorkerOverview[]>('/agents/overview'),
          api.get<InboxThreadSummary[]>('/whatsapp/inbox'),
        ]);

        if (!isMounted) {
          return;
        }

        setPipelines(pipelineResponse.data);
        setWorkers(workerResponse.data);
        setThreads(inboxResponse.data);
        setSelectedPipelineId((current) => current ?? pipelineResponse.data[0]?.id ?? null);
      } catch {
        if (isMounted) {
          setError('Nao foi possivel carregar a central operacional do tenant.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void run();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCardId) {
      setSelectedCard(null);
      return;
    }

    let isMounted = true;

    const run = async () => {
      setIsCardLoading(true);
      try {
        const response = await api.get<DetailedCard>(`/cards/${selectedCardId}`);
        if (isMounted) {
          setSelectedCard(response.data);
        }
      } catch {
        if (isMounted) {
          setSelectedCard(null);
        }
      } finally {
        if (isMounted) {
          setIsCardLoading(false);
        }
      }
    };

    void run();
    return () => {
      isMounted = false;
    };
  }, [selectedCardId]);

  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ?? null,
    [pipelines, selectedPipelineId],
  );

  const totalCards =
    selectedPipeline?.stages.reduce((total, stage) => total + (stage.cards?.length ?? 0), 0) ?? 0;

  const workerMetrics = useMemo(() => {
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

  const inboxMetrics = useMemo(() => {
    return threads.reduce(
      (summary, thread) => {
        if (thread.latestConversation?.status === 'HANDOFF_REQUIRED') {
          summary.takeover += 1;
        } else if (thread.assignedAgent?.isActive) {
          summary.autonomous += 1;
        } else {
          summary.withoutAgent += 1;
        }
        return summary;
      },
      { autonomous: 0, takeover: 0, withoutAgent: 0 },
    );
  }, [threads]);

  const activeConversation = selectedCard?.agentConversations?.[0] ?? null;
  const activeRun = selectedCard?.sequenceRuns?.[0] ?? null;

  const refreshSelectedCard = async () => {
    if (!selectedCardId) {
      return;
    }

    const response = await api.get<DetailedCard>(`/cards/${selectedCardId}`);
    setSelectedCard(response.data);
  };

  const refreshPipelines = async () => {
    const response = await api.get<PipelineSummary[]>('/pipelines');
    setPipelines(response.data);
  };

  return (
    <>
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6 lg:p-8">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_420px]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_8px_22px_rgba(15,23,42,0.045)] lg:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[#eef6ff] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-700">
              <Sparkles className="h-3.5 w-3.5" />
              Central operacional
            </div>

            <div className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-semibold text-slate-900 lg:text-[2.2rem]">
                  Workers, inbox, kanban e régua em uma única leitura.
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  Esta tela resume a operação inteira antes do detalhe: quem está atuando, onde há takeover e qual fluxo exige atenção agora.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/wizard"
                  className="inline-flex items-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#5bd0ff,#83f4c3)] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_14px_40px_rgba(91,208,255,0.22)] transition hover:translate-y-[-1px]"
                >
                  <Wand2 className="h-4 w-4" />
                  Abrir Wizard
                </Link>
                <Link
                  href="/workers"
                  className="inline-flex items-center gap-2 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:border-slate-300"
                >
                  <Bot className="h-4 w-4 text-cyan-700" />
                  Ver Workers
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              { icon: Workflow, label: 'Pipelines', value: String(pipelines.length || 0) },
              { icon: Orbit, label: 'Etapas ativas', value: String(selectedPipeline?.stages.length || 0) },
              { icon: KanbanSquare, label: 'Cards visíveis', value: String(totalCards) },
            ].map((item) => (
              <div key={item.label} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.045)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-cyan-700">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.045)]">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Leitura atual</p>
              <p className="mt-3 text-sm font-medium text-slate-900">
                {selectedCard ? selectedCard.title : 'Selecione um card'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {selectedCard?.automation
                  ? `${selectedCard.automation.label} · ${selectedCard.automation.nextAction}`
                  : activeConversation
                    ? `Agente ${activeConversation.agent.name} em ${activeConversation.status.toLowerCase()}.`
                    : activeRun
                      ? `Régua ${activeRun.campaign.name} em ${activeRun.status.toLowerCase()}.`
                      : 'Clique em um card para abrir o detalhe do cliente.'}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                Última atualização {formatDateTime(activeConversation?.updatedAt ?? activeRun?.updatedAt)}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Workers</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Pulso dos agentes</h3>
              </div>
              <Link href="/workers" className="text-sm font-medium text-cyan-700 transition hover:text-cyan-800">
                Abrir tela completa
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {[
                { label: 'Autônomos', value: workerMetrics.autopilot },
                { label: 'Takeover', value: workerMetrics.takeover },
                { label: 'Delay', value: workerMetrics.waitingDelay },
                { label: 'Em execução', value: workerMetrics.running },
              ].map((metric) => (
                <div key={metric.label} className="rounded-[22px] border border-slate-200 bg-[#f8f9fb] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {workers.slice(0, 3).map((worker) => (
                <div key={worker.id} className="rounded-[24px] border border-slate-200 bg-[#f8f9fb] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{worker.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {worker.stage ? `${worker.stage.pipeline.name} · ${worker.stage.name}` : 'Sem etapa vinculada'}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.18em] ${worker.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {worker.isActive ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">Autônomos {worker.metrics.autopilot}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">Takeover {worker.metrics.takeover}</span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-600">Delay {worker.metrics.waitingDelay}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Inbox</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">Threads que exigem leitura</h3>
              </div>
              <Link href="/inbox" className="text-sm font-medium text-cyan-700 transition hover:text-cyan-800">
                Abrir inbox
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Autônomas', value: inboxMetrics.autonomous },
                { label: 'Takeover', value: inboxMetrics.takeover },
                { label: 'Sem agente', value: inboxMetrics.withoutAgent },
              ].map((metric) => (
                <div key={metric.label} className="rounded-[22px] border border-slate-200 bg-[#f8f9fb] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{metric.label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{metric.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {threads.slice(0, 4).map((thread) => (
                <div key={thread.contact.id} className="rounded-[24px] border border-slate-200 bg-[#f8f9fb] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{thread.contact.name}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {thread.contact.company?.name || thread.contact.phone || thread.contact.email || 'Contato sem dados'}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatShortTime(thread.latestMessage?.createdAt ?? thread.latestConversation?.updatedAt ?? null)}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                    {thread.latestMessage?.content || 'Sem mensagens recentes registradas.'}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <MessageSquareMore className="h-3.5 w-3.5" />
                    <span>{thread.assignedAgent?.name ?? 'Sem agente'}</span>
                    <span>•</span>
                    <span>{thread.messageCount} mensagens</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Pipeline principal</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {selectedPipeline?.name ?? 'Nenhum pipeline disponível'}
              </h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {pipelines.map((pipeline) => {
                const isActive = pipeline.id === selectedPipelineId;
                return (
                  <button
                    key={pipeline.id}
                    onClick={() => {
                      setSelectedPipelineId(pipeline.id);
                      setSelectedCardId(null);
                      setSelectedCard(null);
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-cyan-300 text-slate-950'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {pipeline.name}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex min-h-[46rem] items-center justify-center rounded-[30px] border border-slate-200 bg-white text-slate-500">
            Carregando board principal...
          </div>
        ) : error ? (
          <div className="flex min-h-[36rem] items-center justify-center rounded-[30px] border border-rose-300 bg-rose-50 px-6 text-center text-rose-700">
            {error}
          </div>
        ) : selectedPipelineId ? (
          <div className="rounded-[30px] bg-transparent">
            <KanbanBoard
              pipelineId={selectedPipelineId}
              onCardSelect={(cardId) => setSelectedCardId(cardId)}
              selectedCardId={selectedCardId}
            />
          </div>
        ) : (
          <div className="flex min-h-[36rem] items-center justify-center rounded-[30px] border border-slate-200 bg-white px-6 text-center text-slate-500">
            Nenhum pipeline encontrado. Rode o seed para popular o ambiente demo.
          </div>
        )}
      </div>

      <CardDetailSheet
        card={selectedCard}
        isOpen={Boolean(selectedCardId)}
        isLoading={isCardLoading}
        onRefreshCard={() => {
          void refreshSelectedCard();
          void refreshPipelines();
        }}
        allStages={(selectedPipeline?.stages ?? []).map((stage) => ({
          id: stage.id,
          name: stage.name,
          order: 0,
        }))}
        onClose={() => {
          setSelectedCardId(null);
          setSelectedCard(null);
        }}
      />
    </>
  );
}
