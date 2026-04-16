'use client';

import { Bot, UserCheck, Pause } from 'lucide-react';

export interface AgentStatusBadgeProps {
  agentName?: string | null;
  status: 'active' | 'paused' | 'takeover' | null;
  compact?: boolean; // true for Kanban cards, false for CardDetailSheet
}

const CONFIG = {
  active: {
    label: 'Ativo',
    tooltip: 'Agente ativo — piloto automatico',
    dotColor: 'bg-emerald-500',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    icon: <Bot className="h-3 w-3" />,
  },
  paused: {
    label: 'Pausado',
    tooltip: 'Regua pausada',
    dotColor: 'bg-gray-400',
    textColor: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200',
    icon: <Pause className="h-3 w-3" />,
  },
  takeover: {
    label: 'Humano',
    tooltip: 'SDR assumiu a conversa',
    dotColor: 'bg-amber-500',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: <UserCheck className="h-3 w-3" />,
  },
} as const;

export function AgentStatusBadge({ agentName, status, compact = false }: AgentStatusBadgeProps) {
  if (!status) return null;

  const cfg = CONFIG[status];
  if (!cfg) return null;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md ${cfg.bgColor} ${cfg.textColor} px-1.5 py-0.5 text-[10px] font-semibold`}
        title={cfg.tooltip}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotColor}`} />
        {cfg.label}
      </span>
    );
  }

  // Full size (for CardDetailSheet)
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border ${cfg.borderColor} ${cfg.bgColor} px-3 py-2`}
      title={cfg.tooltip}
    >
      <span className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
      <span className={`text-sm font-bold ${cfg.textColor}`}>{cfg.label}</span>
      {cfg.icon}
      {agentName && <span className="text-xs text-slate-500 ml-1">{agentName}</span>}
    </div>
  );
}

/**
 * Maps conversation status to AgentStatusBadge status.
 * OPEN -> active, HANDOFF_REQUIRED -> takeover, CLOSED/null -> null
 */
export function conversationStatusToAgentStatus(
  conversationStatus?: string | null,
): 'active' | 'paused' | 'takeover' | null {
  if (conversationStatus === 'OPEN') return 'active';
  if (conversationStatus === 'HANDOFF_REQUIRED') return 'takeover';
  return null;
}
