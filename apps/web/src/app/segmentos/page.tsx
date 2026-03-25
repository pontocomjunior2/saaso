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
      <section className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
        <h1 className="text-3xl font-semibold text-white">Segmentos da base</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          Esta leitura usa tags, cargos e industrias ja existentes na base para orientar nutricao, campanha e
          priorizacao comercial.
        </p>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-3">
        {sections.map((section) => (
          <div key={section.title} className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.78)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-cyan-100">
                <section.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{section.title}</p>
                <p className="mt-1 text-sm text-slate-400">{section.description}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {isSegmentsLoading ? (
                <div className="text-sm text-slate-400">Lendo segmentos...</div>
              ) : section.items.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhum dado disponivel.</div>
              ) : (
                section.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <span className="text-sm text-white">{item.label}</span>
                    <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-medium text-slate-200">
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
