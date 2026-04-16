'use client';

import { useEffect, useMemo } from 'react';
import { Workflow } from 'lucide-react';
import { TYPE_LABELS } from './ActivityTimeline';
import { QualifiedBadge } from './QualifiedBadge';
import { SuggestedStageButton } from './SuggestedStageButton';
import { TimelineFilters } from './TimelineFilters';
import type {
  AgentMessageDto,
  CardActivity,
  TimelineEventSource,
  UnifiedTimelineEvent,
  WhatsAppMessageDto,
} from './board-types';
import { useTimelineStore } from '@/stores/timeline-store';
import { cn } from '@/lib/utils';

interface StageRef {
  id: string;
  name: string;
  order: number;
}

interface TimelineTabProps {
  cardId: string;
  stages?: StageRef[];
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

function resolveStageName(stages: StageRef[] | undefined, stageId: string | null) {
  if (!stageId || !stages?.length) {
    return null;
  }

  return stages.find((stage) => stage.id === stageId)?.name ?? null;
}

function WhatsAppTimelineItem({ item }: { item: WhatsAppMessageDto }) {
  const inbound = item.direction === 'INBOUND';

  return (
    <li className={cn('flex', inbound ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl border px-4 py-3',
          inbound
            ? 'border-slate-200 bg-white text-slate-700'
            : 'border-emerald-200 bg-emerald-50 text-emerald-900',
        )}
      >
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
          {inbound ? 'WhatsApp recebido' : 'WhatsApp enviado'}
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.content}</p>
        <time className="mt-2 block text-xs text-slate-400" dateTime={item.createdAt}>
          {formatDateTime(item.createdAt)}
        </time>
      </div>
    </li>
  );
}

function ActivityTimelineItem({ item }: { item: CardActivity }) {
  const meta = TYPE_LABELS[item.type] ?? {
    label: item.type,
    icon: 'Workflow',
    color: 'text-slate-400',
  };

  return (
    <li className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <Workflow className="h-4 w-4 text-slate-400" />
        <p className={cn('text-sm font-medium', meta.color)}>{meta.label}</p>
      </div>
      {item.content ? <p className="mt-2 text-sm leading-6 text-slate-600">{item.content}</p> : null}
      <time className="mt-2 block text-xs text-slate-400" dateTime={item.createdAt}>
        {formatDateTime(item.createdAt)}
      </time>
    </li>
  );
}

function AgentTimelineItem({
  cardId,
  item,
  stages,
  onMoved,
}: {
  cardId: string;
  item: AgentMessageDto;
  stages?: StageRef[];
  onMoved: () => void;
}) {
  const metadata = item.metadata;
  const stageName = resolveStageName(stages, metadata?.suggested_next_stage_id ?? null);

  return (
    <li className="rounded-2xl border border-[#e8e6fc] bg-[rgba(232,230,252,0.35)] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#594ded]">Agente</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {metadata?.reply ?? item.content}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {metadata?.mark_qualified ? <QualifiedBadge /> : null}
        {metadata?.suggested_next_stage_id ? (
          <SuggestedStageButton
            cardId={cardId}
            suggestedStageId={metadata.suggested_next_stage_id}
            stageName={stageName}
            onMoved={onMoved}
          />
        ) : null}
      </div>

      {metadata?.handoff_reason ? (
        <p className="mt-2 text-xs text-amber-700">Handoff sugerido: {metadata.handoff_reason}</p>
      ) : null}

      <time className="mt-2 block text-xs text-slate-400" dateTime={item.createdAt}>
        {formatDateTime(item.createdAt)}
      </time>
    </li>
  );
}

export function TimelineTab({ cardId, stages }: TimelineTabProps) {
  const {
    items,
    nextCursor,
    filter,
    isLoading,
    isLoadingMore,
    error,
    currentCardId,
    fetchInitial,
    fetchMore,
    setFilter,
  } = useTimelineStore();

  useEffect(() => {
    if (currentCardId !== cardId) {
      void fetchInitial(cardId);
    }
  }, [cardId, currentCardId, fetchInitial]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') {
      return items;
    }

    return items.filter((item) => item.source === filter);
  }, [filter, items]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TimelineFilters value={filter} onChange={setFilter} />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void fetchInitial(cardId)}
            className="mt-2 text-sm font-medium text-red-800 underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : null}

      {!error && filteredItems.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Nenhuma interação ainda.
        </p>
      ) : null}

      <ol className="space-y-3">
        {filteredItems.map((item, index) => {
          const key = `${item.source}-${item.createdAt}-${index}`;

          if (item.source === 'whatsapp') {
            return <WhatsAppTimelineItem key={key} item={item.data as WhatsAppMessageDto} />;
          }

          if (item.source === 'activity') {
            return <ActivityTimelineItem key={key} item={item.data as CardActivity} />;
          }

          return (
            <AgentTimelineItem
              key={key}
              cardId={cardId}
              item={item.data as AgentMessageDto}
              stages={stages}
              onMoved={() => void fetchInitial(cardId)}
            />
          );
        })}
      </ol>

      {nextCursor ? (
        <button
          type="button"
          onClick={() => void fetchMore(cardId)}
          disabled={isLoadingMore}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoadingMore ? 'Carregando...' : 'Carregar mais'}
        </button>
      ) : null}
    </div>
  );
}
