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
      badgeClassName: 'border-amber-300 bg-amber-100 text-amber-700',
      description: 'Humano assumiu esta conversa. O agente pode retomar quando o piloto automatico for religado.',
      actionLabel: 'Religar piloto automático',
      nextStatus: 'OPEN' as ConversationStatus,
    };
  }

  if (status === 'CLOSED') {
    return {
      label: 'Encerrada',
      badgeClassName: 'border-slate-200 bg-slate-100 text-slate-600',
      description: 'Conversa encerrada e fora da fila operacional.',
      actionLabel: 'Reabrir conversa',
      nextStatus: 'OPEN' as ConversationStatus,
    };
  }

  if (!assignedAgent) {
    return {
      label: 'Sem agente',
      badgeClassName: 'border-slate-200 bg-slate-100 text-slate-600',
      description: 'Nenhum agente esta configurado para a etapa atual do card.',
      actionLabel: 'Assumir manualmente',
      nextStatus: 'HANDOFF_REQUIRED' as ConversationStatus,
    };
  }

  if (!assignedAgent.isActive) {
    return {
      label: 'Agente pausado',
      badgeClassName: 'border-amber-300 bg-amber-100 text-amber-700',
      description: 'O agente desta etapa foi desligado globalmente. A conversa depende de operacao humana.',
      actionLabel: 'Assumir manualmente',
      nextStatus: 'HANDOFF_REQUIRED' as ConversationStatus,
    };
  }

  return {
    label: 'Autônoma',
    badgeClassName: 'border-emerald-300 bg-emerald-100 text-emerald-700',
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
        <div className="rounded-3xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[rgba(255,255,255,0.86)] shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
        <div className="grid min-h-[52rem] gap-0 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="flex min-h-[52rem] flex-col overflow-hidden border-slate-200 bg-[rgba(255,255,255,0.92)] xl:border-r">
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Conversas</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">Todas</h3>
              </div>
              <button
                onClick={() => void fetchInbox()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300"
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
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white"
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
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{thread.contact.name}</p>
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

                    <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{buildThreadPreview(thread)}</p>

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

        <div className="flex min-h-[52rem] flex-col overflow-hidden bg-[rgba(255,255,255,0.76)]">
          <div className="border-b border-slate-200 bg-white/70 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                    {selectedThread?.contact.name?.slice(0, 1) || 'C'}
                  </div>
                  <div className="min-w-0">
                  <h3 className="truncate text-xl font-semibold text-slate-950">
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

          <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,252,0.75))] px-6 py-6">
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
                <div className="max-w-xl rounded-[24px] border border-slate-200 bg-white px-6 py-5 text-center">
                  <p className="text-sm font-medium text-slate-950">Thread sem mensagens de canal ainda</p>
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

          <div className="border-t border-slate-200 bg-white/80 p-5">
            <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
              <textarea
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder={selectedThread ? `Escreva a mensagem para ${selectedThread.contact.name}` : 'Selecione uma thread para responder'}
                rows={4}
                disabled={!selectedThread || isSending}
                className="w-full resize-none bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                <div className="flex items-center gap-2">
                  <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                    <Paperclip className="h-4 w-4" />
                    Anexar
                  </button>
                  <button type="button" className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500">
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
