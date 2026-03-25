'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  useInboxStore,
  type ConversationStatus,
  type InboxThreadAgent,
  type InboxThreadSummary,
} from '@/stores/useInboxStore';
import {
  ArrowUpRight,
  Bot,
  Building2,
  Mail,
  Mic,
  Paperclip,
  Phone,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  UserRoundCog,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useUIMode } from '@/components/layout/UIModeProvider';

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Sem atividade recente';
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

function getConversationStatusMeta(status?: ConversationStatus | null, assignedAgent?: InboxThreadAgent | null) {
  if (status === 'HANDOFF_REQUIRED') {
    return {
      label: 'Manual',
      badgeClassName: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
      description: 'Humano assumiu esta conversa. O agente pode retomar quando o piloto automatico for religado.',
      actionLabel: 'Religar piloto automático',
      nextStatus: 'OPEN' as ConversationStatus,
    };
  }

  if (status === 'CLOSED') {
    return {
      label: 'Encerrada',
      badgeClassName: 'border-white/10 bg-white/5 text-slate-200',
      description: 'Conversa encerrada e fora da fila operacional.',
      actionLabel: 'Reabrir conversa',
      nextStatus: 'OPEN' as ConversationStatus,
    };
  }

  if (!assignedAgent) {
    return {
      label: 'Sem agente',
      badgeClassName: 'border-white/10 bg-white/5 text-slate-200',
      description: 'Nenhum agente esta configurado para a etapa atual do card.',
      actionLabel: 'Assumir manualmente',
      nextStatus: 'HANDOFF_REQUIRED' as ConversationStatus,
    };
  }

  if (!assignedAgent.isActive) {
    return {
      label: 'Agente pausado',
      badgeClassName: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
      description: 'O agente desta etapa foi desligado globalmente. A conversa depende de operacao humana.',
      actionLabel: 'Assumir manualmente',
      nextStatus: 'HANDOFF_REQUIRED' as ConversationStatus,
    };
  }

  return {
    label: 'Autônoma',
    badgeClassName: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
    description: 'Agente conduzindo a conversa de forma automatica enquanto o takeover estiver desligado.',
    actionLabel: 'Assumir manualmente',
    nextStatus: 'HANDOFF_REQUIRED' as ConversationStatus,
  };
}

function buildThreadPreview(thread: InboxThreadSummary) {
  return (
    thread.latestMessage?.content ||
    thread.latestConversation?.summary ||
    'Thread sem mensagens registradas ate agora.'
  );
}

export default function InboxPage() {
  const { mode } = useUIMode();
  const {
    threads,
    selectedContactId,
    selectedThread,
    isLoading,
    isThreadLoading,
    isSending,
    isUpdatingStatus,
    error,
    fetchInbox,
    fetchThread,
    sendMessage,
    updateConversationStatus,
  } = useInboxStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [draftMessage, setDraftMessage] = useState('');

  useEffect(() => {
    void fetchInbox();
  }, [fetchInbox]);

  const filteredThreads = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return threads;
    }

    return threads.filter((thread) => {
      const fields = [
        thread.contact.name,
        thread.contact.email,
        thread.contact.phone,
        thread.contact.company?.name,
        thread.latestMessage?.content,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return fields.includes(normalizedSearch);
    });
  }, [searchTerm, threads]);

  const inboxMetrics = useMemo(() => {
    return threads.reduce(
      (summary, thread) => {
        const conversation = thread.latestConversation;
        const assignedAgent = thread.assignedAgent;
        const requiresManual =
          conversation?.status === 'HANDOFF_REQUIRED' || !assignedAgent || assignedAgent.isActive === false;

        if (requiresManual) {
          summary.manual += 1;
        } else {
          summary.autonomous += 1;
        }

        if (!thread.latestMessage) {
          summary.pending += 1;
        }

        return summary;
      },
      { autonomous: 0, manual: 0, pending: 0 },
    );
  }, [threads]);

  const activeCard = selectedThread?.latestConversation?.card ?? selectedThread?.latestCard ?? null;
  const effectiveAgent = selectedThread?.latestConversation?.agent ?? selectedThread?.assignedAgent ?? null;
  const selectedConversationMeta = getConversationStatusMeta(
    selectedThread?.latestConversation?.status ?? null,
    selectedThread?.assignedAgent ?? null,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = draftMessage.trim();
    if (!selectedThread || !trimmedMessage) {
      return;
    }

    try {
      await sendMessage({
        contactId: selectedThread.contact.id,
        content: trimmedMessage,
        cardId: activeCard?.id,
      });
      setDraftMessage('');
    } catch {
      // erro exibido na tela
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6 lg:p-8">
      {error ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className={cn('overflow-hidden rounded-[32px] border', mode === 'simple' ? 'border-slate-200 bg-[rgba(255,255,255,0.86)] shadow-[0_18px_44px_rgba(15,23,42,0.08)]' : 'border-white/10 bg-[rgba(7,16,29,0.86)] shadow-[0_20px_72px_rgba(0,0,0,0.2)]')}>
        <div className="grid min-h-[52rem] gap-0 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className={cn('flex min-h-[52rem] flex-col overflow-hidden xl:border-r', mode === 'simple' ? 'border-slate-200 bg-[rgba(255,255,255,0.92)]' : 'border-white/10 bg-[rgba(7,16,29,0.9)]')}>
          <div className={cn('p-5', mode === 'simple' ? 'border-b border-slate-200' : 'border-b border-white/10')}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Conversas</p>
                <h3 className={cn('mt-2 text-xl font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>Todas</h3>
              </div>
              <button
                onClick={() => void fetchInbox()}
                className={cn('inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition', mode === 'simple' ? 'border-slate-200 bg-white text-slate-500 hover:border-slate-300' : 'border-white/10 bg-white/[0.04] text-slate-300')}
              >
                <RefreshCcw className={cn('h-4 w-4', isLoading ? 'animate-spin' : '')} />
              </button>
            </div>

            <div className="mt-4 flex items-center gap-4 border-b border-slate-200/80 pb-3 text-sm">
              <button className="border-b-2 border-cyan-500 pb-2 font-medium text-slate-900">Todas</button>
              <button className="pb-2 text-slate-500">Não lidas</button>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{filteredThreads.length}</span>
            </div>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar contato, empresa ou conteúdo..."
                className={cn('w-full rounded-2xl border py-3 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40', mode === 'simple' ? 'border-slate-200 bg-slate-50 text-slate-950 focus:bg-white' : 'border-white/10 bg-white/[0.06] text-white focus:bg-white/[0.08]')}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {isLoading && threads.length === 0 ? (
              <div className="flex h-full min-h-[20rem] items-center justify-center text-sm text-slate-400">
                Carregando threads...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex h-full min-h-[20rem] items-center justify-center px-6 text-center text-sm text-slate-400">
                Nenhuma thread corresponde à busca atual.
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isActive = thread.contact.id === selectedContactId;
                const statusMeta = getConversationStatusMeta(thread.latestConversation?.status ?? null, thread.assignedAgent);

                return (
                  <button
                    key={thread.contact.id}
                    onClick={() => void fetchThread(thread.contact.id)}
                    className={cn(
                      'mb-3 w-full rounded-[24px] border p-4 text-left transition',
                      isActive
                        ? 'border-cyan-300/30 bg-cyan-300/[0.08] shadow-[0_18px_44px_rgba(89,211,255,0.1)]'
                        : mode === 'simple'
                          ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={cn('truncate text-sm font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>{thread.contact.name}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {thread.contact.company?.name || thread.contact.phone || thread.contact.email || 'Contato sem dados'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-slate-500">{formatShortTime(thread.latestMessage?.createdAt ?? thread.latestConversation?.updatedAt ?? null)}</p>
                        <span className={cn('mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.24em]', statusMeta.badgeClassName)}>
                          {statusMeta.label}
                        </span>
                      </div>
                    </div>

                    <p className={cn('mt-4 line-clamp-2 text-sm leading-6', mode === 'simple' ? 'text-slate-600' : 'text-slate-300')}>{buildThreadPreview(thread)}</p>

                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                      <span>{thread.messageCount} mensagens</span>
                      <span>{thread.assignedAgent?.name ?? 'Sem agente'}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className={cn('flex min-h-[52rem] flex-col overflow-hidden', mode === 'simple' ? 'bg-[rgba(255,255,255,0.76)]' : 'bg-[rgba(7,16,29,0.86)]')}>
          <div className={cn('p-5', mode === 'simple' ? 'border-b border-slate-200 bg-white/70' : 'border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]')}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                    {selectedThread?.contact.name?.slice(0, 1) || 'C'}
                  </div>
                  <div className="min-w-0">
                  <h3 className={cn('truncate text-xl font-semibold', mode === 'simple' ? 'text-slate-950' : 'text-white')}>
                    {selectedThread?.contact.name || 'Selecione uma thread'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedThread ? 'Online' : 'Nenhuma conversa selecionada'}
                  </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedThread ? (
                    <span className={cn('rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.24em]', selectedConversationMeta.badgeClassName)}>
                      {selectedConversationMeta.label}
                    </span>
                  ) : null}
                  {effectiveAgent ? (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                      {effectiveAgent.name}
                    </span>
                  ) : null}
                  {activeCard ? (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                      {activeCard.stage.name}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/configuracoes"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300"
                >
                  <Settings2 className="h-4 w-4" />
                </Link>
                {selectedThread?.latestConversation ? (
                  <button
                    onClick={() =>
                      void updateConversationStatus(
                        selectedThread.latestConversation!.id,
                        selectedConversationMeta.nextStatus,
                      )
                    }
                    disabled={isUpdatingStatus}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
                  >
                    <UserRoundCog className="h-4 w-4" />
                    {isUpdatingStatus ? 'Atualizando...' : selectedConversationMeta.actionLabel}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className={cn('flex-1 overflow-y-auto px-6 py-6', mode === 'simple' ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,252,0.75))]' : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.015),rgba(255,255,255,0.03))]')}>
            {isThreadLoading ? (
              <div className="flex h-full min-h-[24rem] items-center justify-center text-sm text-slate-400">
                Carregando histórico da thread...
              </div>
            ) : !selectedThread ? (
              <div className="flex h-full min-h-[24rem] items-center justify-center px-10 text-center text-sm text-slate-400">
                Escolha uma thread na coluna da esquerda para abrir mensagens, takeover e contexto operacional.
              </div>
            ) : selectedThread.messages.length === 0 ? (
              <div className="flex h-full min-h-[24rem] items-center justify-center px-10">
                <div className={cn('max-w-xl rounded-[24px] border px-6 py-5 text-center', mode === 'simple' ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.04]')}>
                  <p className={cn('text-sm font-medium', mode === 'simple' ? 'text-slate-950' : 'text-white')}>Thread sem mensagens de canal ainda</p>
                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    {selectedThread.latestConversation?.summary ||
                      'Ainda nao existem mensagens registradas para este contato.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {selectedThread.messages.map((message) => {
                  const isOutbound = message.direction === 'OUTBOUND';

                  return (
                    <div key={message.id} className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[42rem] rounded-[24px] px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)]', isOutbound ? 'bg-[#cfe4ff] text-slate-900' : 'bg-white text-slate-900')}>
                        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                          <span>{isOutbound ? 'Você' : selectedThread.contact.name}</span>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{message.content}</p>
                        <p className="mt-3 text-xs text-slate-500">{formatDateTime(message.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={cn('p-5', mode === 'simple' ? 'border-t border-slate-200 bg-white/80' : 'border-t border-white/10 bg-white/[0.02]')}>
            <form onSubmit={handleSubmit} className={cn('rounded-[28px] border p-4', mode === 'simple' ? 'border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.04)]' : 'border-white/10 bg-white/[0.04]')}>
              <textarea
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder={selectedThread ? `Escreva a mensagem para ${selectedThread.contact.name}` : 'Selecione uma thread para responder'}
                rows={4}
                disabled={!selectedThread || isSending}
                className={cn('w-full resize-none bg-transparent text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60', mode === 'simple' ? 'text-slate-950' : 'text-white')}
              />

              <div className={cn('mt-4 flex items-center justify-between gap-3 pt-3', mode === 'simple' ? 'border-t border-slate-200' : 'border-t border-white/10')}>
                <div className="flex items-center gap-2">
                  <button type="button" className={cn('inline-flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm', mode === 'simple' ? 'border-slate-200 bg-white text-slate-700' : 'border-white/10 bg-white/[0.04] text-slate-300')}>
                    <Paperclip className="h-4 w-4" />
                    Anexar
                  </button>
                  <button type="button" className={cn('rounded-2xl border p-2.5', mode === 'simple' ? 'border-slate-200 bg-white text-slate-500' : 'border-white/10 bg-white/[0.04] text-slate-300')}>
                    <Mic className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!selectedThread || isSending || !draftMessage.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(89,211,255,0.28)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {isSending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}
