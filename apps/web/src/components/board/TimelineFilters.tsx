'use client';

import type { TimelineEventSource } from './board-types';
import { cn } from '@/lib/utils';

export type TimelineFilterValue = 'all' | TimelineEventSource;

interface TimelineFiltersProps {
  value: TimelineFilterValue;
  onChange: (value: TimelineFilterValue) => void;
}

const OPTIONS: Array<{ value: TimelineFilterValue; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'whatsapp', label: 'Mensagens' },
  { value: 'activity', label: 'Atividades' },
  { value: 'agent', label: 'Agente' },
];

export function TimelineFilters({ value, onChange }: TimelineFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition',
              active
                ? 'border-[#594ded] bg-[#e8e6fc] text-[#594ded]'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
