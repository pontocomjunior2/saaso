'use client';

import { cn } from '@/lib/utils';
import {
  Bot,
  Building2,
  CalendarClock,
  Mail,
  Phone,
  UserRound,
  Workflow,
  X,
} from 'lucide-react';
import type { DetailedCard } from './board-types';
import { useUIMode } from '../layout/UIModeProvider';

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Sem registro';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getConversationMeta(status?: string) {
  if (status === 'HANDOFF_REQUIRED') {
    return {
      label: 'Takeover humano',
      tone: 'border-amber-300/25 bg-amber-300/12 text-amber-100',
      description: 'Humano conduzindo a conversa neste momento.',
    };
  }

  if (status === 'OPEN') {
    return {
      label: 'Piloto automático',
      tone: 'border-emerald-300/25 bg-emerald-400/12 text-emerald-100',
      description: 'Agente respondendo automaticamente nesta conversa.',
    };
  }

  if (status === 'CLOSED') {
    return {
      label: 'Conversa encerrada',
      tone: 'border-white/10 bg-white/[0.06] text-slate-200',
      description: 'A conversa foi encerrada e saiu da fila operacional.',
    };
  }

  return {
    label: 'Sem conversa ativa',
    tone: 'border-white/10 bg-white/[0.06] text-slate-200',
    description: 'Ainda nao existe conversa operacional ativa neste card.',
  };
}

function getSequenceMeta(card: DetailedCard | null) {
  if (card?.automation) {
    return {
      label: card.automation.label,
      description: card.automation.description,
      nextStep: card.automation.nextAction,
    };
  }

  const run = card?.sequenceRuns?.[0];

  if (!run) {
    return {
      label: 'Sem régua em execução',
      description: 'Nenhuma execução ativa encontrada para este card.',
      nextStep: 'Aguardando entrada do lead ou disparo da campanha.',
    };
  }

  const currentStep = run.steps.find((step) => step.order === run.currentStepIndex + 1) ?? run.steps[run.currentStepIndex];
  const nextPendingStep = run.steps.find((step) => step.status === 'PENDING' || step.status === 'QUEUED');

  const labelByStatus: Record<string, string> = {
    PENDING: 'Na fila',
    RUNNING: 'Em execução',
    COMPLETED: 'Concluída',
    FAILED: 'Falhou',
    PAUSED: 'Pausada',
    CANCELED: 'Cancelada',
  };

  return {
    label: `${labelByStatus[run.status] ?? run.status} · ${run.campaign.name}`,
    description: currentStep
      ? `Etapa atual ${currentStep.order} via ${currentStep.channel} com status ${currentStep.status.toLowerCase()}.`
      : 'Execução criada, sem etapa atual identificada.',
    nextStep: nextPendingStep
      ? `Próxima ação ${nextPendingStep.order} agendada para ${formatDateTime(nextPendingStep.scheduledFor)}.`
      : 'Sem próxima ação pendente identificada.',
  };
}

export function CardDetailSheet({
  card,
  isOpen,
  isLoading,
  onClose,
}: {
  card: DetailedCard | null;
  isOpen: boolean;
  isLoading: boolean;
  onClose: () => void;
}) {
  const { mode } = useUIMode();
  const activeConversation = card?.agentConversations?.[0] ?? null;
  const stageAgent = card?.stage.agents?.[0] ?? null;
  const effectiveAgent = activeConversation?.agent ?? stageAgent ?? null;
  const conversationMeta = getConversationMeta(activeConversation?.status);
  const sequenceMeta = getSequenceMeta(card);
  const runSteps = card?.sequenceRuns?.[0]?.steps ?? [];
  const conversationTone =
    mode === 'simple'
      ? conversationMeta.label === 'Takeover humano'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : conversationMeta.label === 'Piloto automático'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-100 text-slate-600'
      : conversationMeta.tone;

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-0 z-50 transition',
        isOpen ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-slate-950/30 backdrop-blur-[2px] transition',
          isOpen ? 'pointer-events-auto' : '',
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'pointer-events-auto absolute right-0 top-0 h-full w-full max-w-[34rem] text-slate-900 transition duration-300',
          mode === 'simple'
            ? 'border-l border-slate-200 bg-[rgba(255,255,255,0.92)] shadow-[-24px_0_64px_rgba(15,23,42,0.12)] backdrop-blur-xl'
            : 'border-l border-white/10 bg-[rgba(247,249,252,0.98)] shadow-[-24px_0_64px_rgba(15,23,42,0.18)]',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex h-full flex-col">
          <div className={cn('border-b px-6 py-5', mode === 'simple' ? 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.92))]' : 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,248,252,0.92))]')}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Detalhe do card</p>
                <h2 className="mt-2 truncate text-2xl font-semibold">{card?.title ?? 'Andamento do cliente'}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {card ? `${card.stage.pipeline.name} · ${card.stage.name}` : 'Selecione um card para abrir a leitura operacional.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className={cn('flex-1 overflow-y-auto px-6 py-6', mode === 'simple' ? 'bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(241,245,249,0.82))]' : 'bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.92))]')}>
            {isLoading ? (
              <div className="flex h-full min-h-[16rem] items-center justify-center rounded-[24px] border border-slate-200 bg-white text-sm text-slate-500">
                Carregando detalhe do card...
              </div>
            ) : !card ? (
              <div className="flex h-full min-h-[16rem] items-center justify-center rounded-[24px] border border-slate-200 bg-white px-6 text-center text-sm text-slate-500">
                Nenhum card selecionado.
              </div>
            ) : (
              <div className="space-y-5">
                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
                  <div className="rounded-[24px] bg-[linear-gradient(135deg,rgba(255,164,164,0.16),rgba(210,165,255,0.16),rgba(130,196,255,0.14))] p-4">
                    <div className="rounded-[22px] border border-white/60 bg-white/85 p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', mode === 'simple' ? 'bg-[#eef6ff] text-cyan-700' : 'bg-slate-900 text-cyan-100')}>
                          <Workflow className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={cn('inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em]', conversationTone)}>
                            {conversationMeta.label}
                          </div>
                          <p className="mt-3 text-sm font-medium text-slate-900">{sequenceMeta.label}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{conversationMeta.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-slate-900">
                      <Bot className="h-4 w-4 text-cyan-600" />
                      <h3 className="text-sm font-semibold">Agente desta etapa</h3>
                    </div>
                    <p className="mt-4 text-lg font-semibold">{effectiveAgent?.name ?? 'Sem agente atribuído'}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {activeConversation?.summary ??
                        (effectiveAgent
                          ? 'Este agente está ligado à etapa atual e pode retomar a operação a partir do ponto onde o humano parou.'
                          : 'Nenhum agente foi configurado para esta etapa do funil.')}
                    </p>
                    <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-400">
                      Última atualização {formatDateTime(activeConversation?.updatedAt)}
                    </p>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-slate-900">
                      <CalendarClock className="h-4 w-4 text-cyan-600" />
                      <h3 className="text-sm font-semibold">Régua de nutrição</h3>
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-900">{sequenceMeta.description}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{sequenceMeta.nextStep}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-400">
                      Próxima revisão {formatDateTime(card.sequenceRuns?.[0]?.nextRunAt)}
                    </p>
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-slate-900">
                    <UserRound className="h-4 w-4 text-cyan-600" />
                    <h3 className="text-sm font-semibold">Contato</h3>
                  </div>

                  {card.contact ? (
                    <div className="mt-4 space-y-4 text-sm text-slate-600">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">{card.contact.name}</p>
                        <p className="mt-1">{card.contact.company?.name ?? 'Sem empresa vinculada'}</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-slate-500" />
                            <span>{card.contact.phone ?? 'Sem telefone'}</span>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-500" />
                            <span>{card.contact.email ?? 'Sem email'}</span>
                          </div>
                        </div>
                      </div>
                      {card.contact.company ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-500" />
                            <span>
                              {card.contact.company.name}
                              {card.contact.company.industry ? ` · ${card.contact.company.industry}` : ''}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Este card ainda não possui contato vinculado.</p>
                  )}
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-slate-900">Linha do tempo operacional</h3>
                  <div className="mt-4 space-y-3">
                    {card.activities.length > 0 ? (
                      card.activities.slice(0, 6).map((activity) => (
                        <div key={activity.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">{activity.type}</p>
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                              {formatDateTime(activity.createdAt)}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{activity.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">Sem atividades registradas até agora.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-slate-900">Status da régua</h3>
                  <div className="mt-4 space-y-3">
                    {runSteps.length > 0 ? (
                      runSteps.map((step) => (
                        <div key={step.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              Etapa {step.order} · {step.channel}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Agendada para {formatDateTime(step.scheduledFor)}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                            {step.status}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">Nenhuma etapa de régua vinculada a este card até o momento.</p>
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
