'use client';

import {
  AlertCircle,
  ArrowRight,
  Mail,
  MessageSquare,
  Plus,
  UserRound,
  Workflow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CardActivity } from './board-types';

type IconName = 'Plus' | 'ArrowRight' | 'MessageSquare' | 'AlertCircle' | 'Mail' | 'Workflow' | 'UserRound';

const ICON_MAP: Record<IconName, React.ComponentType<{ className?: string }>> = {
  Plus,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  Mail,
  Workflow,
  UserRound,
};

interface TypeMeta {
  label: string;
  icon: IconName;
  color: string;
}

const TYPE_LABELS: Record<string, TypeMeta> = {
  CREATED: { label: 'Card criado', icon: 'Plus', color: 'text-slate-500' },
  MOVED: { label: 'Card movido', icon: 'ArrowRight', color: 'text-blue-500' },
  WHATSAPP_OUTBOUND: { label: 'WhatsApp enviado', icon: 'MessageSquare', color: 'text-green-500' },
  WHATSAPP_OUTBOUND_FAILED: { label: 'Falha no WhatsApp', icon: 'AlertCircle', color: 'text-red-500' },
  EMAIL_OUTBOUND: { label: 'Email enviado', icon: 'Mail', color: 'text-blue-500' },
  JOURNEY_ACTIVITY: { label: 'Acao de jornada', icon: 'Workflow', color: 'text-purple-500' },
  JOURNEY_HANDOFF: { label: 'Handoff para humano', icon: 'UserRound', color: 'text-amber-500' },
  JOURNEY_STAGE_MOVED: { label: 'Movido por jornada', icon: 'ArrowRight', color: 'text-purple-500' },
};

function formatDateTime(value?: string | null) {
  if (!value) return 'Sem registro';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function ChannelBadge({ channel }: { channel: string }) {
  const isWa = channel.toUpperCase() === 'WHATSAPP';
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]',
        isWa ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700',
      )}
    >
      {isWa ? 'WhatsApp' : 'Email'}
    </span>
  );
}

export function ActivityTimeline({ activities }: { activities: CardActivity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-slate-500">Sem atividades registradas ate agora.</p>;
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical connector line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-200" aria-hidden="true" />

      {activities.map((activity, idx) => {
        const meta = TYPE_LABELS[activity.type] ?? {
          label: activity.type,
          icon: 'Workflow' as IconName,
          color: 'text-slate-400',
        };
        const IconComponent = ICON_MAP[meta.icon as IconName] ?? Workflow;

        return (
          <div key={activity.id} className={cn('relative flex gap-3', idx < activities.length - 1 ? 'pb-4' : '')}>
            {/* Dot */}
            <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
              <IconComponent className={cn('h-4 w-4', meta.color)} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn('text-sm font-medium', meta.color)}>{meta.label}</p>
                  {activity.channel && <ChannelBadge channel={activity.channel} />}
                </div>
                <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  {formatDateTime(activity.createdAt)}
                </span>
              </div>

              {activity.content && (
                <p className="mt-1.5 text-sm leading-6 text-slate-600">{activity.content}</p>
              )}

              {activity.templateName && (
                <p className="mt-1 text-xs text-slate-400">Template: {activity.templateName}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
