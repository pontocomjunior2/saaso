'use client';

import { useContactStore } from '@/stores/useContactStore';
import { Building2, Tags, Users } from 'lucide-react';
import { useEffect } from 'react';

export default function SegmentsPage() {
  const { segments, isSegmentsLoading, error, fetchSegments } = useContactStore();

  useEffect(() => {
    void fetchSegments();
  }, [fetchSegments]);

  const sections = [
    {
      title: 'Tags',
      description: 'Marcadores de operacao usados para filtrar base, reguas e campanhas.',
      icon: Tags,
      items: segments.tags,
    },
    {
      title: 'Cargos',
      description: 'Perfis mais recorrentes entre os contatos do workspace.',
      icon: Users,
      items: segments.positions,
    },
    {
      title: 'Industrias',
      description: 'Agrupamento por mercado para orientar mensagens e templates.',
      icon: Building2,
      items: segments.industries,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 p-6 lg:p-8">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
        <h1 className="text-3xl font-semibold text-slate-900">Segmentos da base</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
          Esta leitura usa tags, cargos e industrias ja existentes na base para orientar nutricao, campanha e
          priorizacao comercial.
        </p>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-300 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-3">
        {sections.map((section) => (
          <div key={section.title} className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8e6fc] bg-[#e8e6fc] text-[#594ded]">
                <section.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{section.title}</p>
                <p className="mt-1 text-sm text-slate-500">{section.description}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {isSegmentsLoading ? (
                <div className="text-sm text-slate-400">Lendo segmentos...</div>
              ) : section.items.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhum dado disponivel.</div>
              ) : (
                section.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <span className="text-sm text-slate-900">{item.label}</span>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                      {item.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
