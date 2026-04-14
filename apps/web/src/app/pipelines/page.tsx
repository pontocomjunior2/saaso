'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useUIMode } from '@/components/layout/UIModeProvider';
import { 
  Workflow, 
  Plus, 
  Search, 
  ArrowRight, 
  LayoutGrid, 
  Users, 
  Activity,
  ChevronRight
} from 'lucide-react';
import type { PipelineSummary } from '@/components/board/board-types';
import { cn } from '@/lib/utils';

export default function PipelinesPage() {
  const { mode } = useUIMode();
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchPipelines = async () => {
      setIsLoading(true);
      try {
        const response = await api.get<PipelineSummary[]>('/pipelines');
        if (isMounted) {
          setPipelines(response.data);
        }
      } catch {
        if (isMounted) {
          setError('Nao foi possivel carregar a lista de pipelines.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchPipelines();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPipelines = pipelines.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] p-6 lg:p-10">
      {/* Header Section */}
      <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-cyan-100">
            <Workflow className="h-3 w-3" />
            Gestao Comercial
          </div>
          <h1 className={cn(
            "text-4xl font-bold tracking-tight",
            mode === 'simple' ? "text-slate-900" : "text-white"
          )}>
            Pipelines Operacionais
          </h1>
          <p className={cn(
            "mt-3 text-lg leading-relaxed",
            mode === 'simple' ? "text-slate-600" : "text-slate-400"
          )}>
            Visualize e gerencie seus funis de venda. Clique em um pipeline para abrir o quadro kanban e gerir seus cards.
          </p>
        </div>

        <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#5bd0ff] px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-400/20 transition hover:scale-[1.02] active:scale-[0.98]">
          <Plus className="h-5 w-5" />
          Novo Pipeline
        </button>
      </header>

      {/* Filters & Search */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar pipeline por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full rounded-2xl border py-3.5 pl-11 pr-4 text-sm outline-none transition-all",
              mode === 'simple' 
                ? "border-slate-200 bg-white text-slate-900 focus:border-cyan-500" 
                : "border-white/10 bg-white/5 text-white focus:border-cyan-400/50"
            )}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={cn(
              "h-64 animate-pulse rounded-[32px] border",
              mode === 'simple' ? "border-slate-100 bg-slate-50" : "border-white/5 bg-white/5"
            )} />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-600">
          {error}
        </div>
      ) : filteredPipelines.length === 0 ? (
        <div className={cn(
          "rounded-[32px] border border-dashed p-16 text-center",
          mode === 'simple' ? "border-slate-200 bg-slate-50" : "border-white/10 bg-white/[0.02]"
        )}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Search className="h-8 w-8" />
          </div>
          <h3 className={cn("text-xl font-semibold", mode === 'simple' ? "text-slate-900" : "text-white")}>
            Nenhum pipeline encontrado
          </h3>
          <p className="mt-2 text-slate-500">Tente ajustar sua busca ou crie um novo pipeline.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPipelines.map((pipeline) => {
            const totalLeads = pipeline.stages.reduce((acc, s) => acc + (s.cards?.length || 0), 0);
            
            return (
              <Link 
                key={pipeline.id} 
                href={`/pipelines/${pipeline.id}`}
                className={cn(
                  "group relative overflow-hidden rounded-[32px] border p-8 transition-all hover:scale-[1.02] active:scale-[0.98]",
                  mode === 'simple'
                    ? "border-slate-200 bg-white shadow-sm hover:shadow-xl hover:shadow-slate-200/50"
                    : "border-white/10 bg-white/5 hover:bg-white/[0.08] hover:shadow-2xl hover:shadow-cyan-500/10"
                )}
              >
                {/* Decorative background element */}
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl transition-all group-hover:bg-cyan-400/20" />

                <div className="mb-6 flex items-center justify-between">
                  <div className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors",
                    mode === 'simple' 
                      ? "border-slate-100 bg-slate-50 text-cyan-600 group-hover:border-cyan-100 group-hover:bg-cyan-50" 
                      : "border-white/10 bg-white/5 text-cyan-400 group-hover:border-cyan-400/20 group-hover:bg-cyan-400/10"
                  )}>
                    <LayoutGrid className="h-7 w-7" />
                  </div>
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border transition-all group-hover:translate-x-1",
                    mode === 'simple' ? "border-slate-100 bg-slate-50 text-slate-400" : "border-white/10 bg-white/5 text-slate-500"
                  )}>
                    <ChevronRight className="h-5 w-5" />
                  </div>
                </div>

                <h3 className={cn(
                  "text-2xl font-bold transition-colors",
                  mode === 'simple' ? "text-slate-900 group-hover:text-cyan-700" : "text-white group-hover:text-cyan-300"
                )}>
                  {pipeline.name}
                </h3>
                
                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className={cn(
                    "rounded-2xl p-4",
                    mode === 'simple' ? "bg-slate-50" : "bg-white/5"
                  )}>
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Activity className="h-3 w-3" />
                      Etapas
                    </div>
                    <div className={cn("text-xl font-bold", mode === 'simple' ? "text-slate-900" : "text-white")}>
                      {pipeline.stages.length}
                    </div>
                  </div>
                  <div className={cn(
                    "rounded-2xl p-4",
                    mode === 'simple' ? "bg-slate-50" : "bg-white/5"
                  )}>
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <Users className="h-3 w-3" />
                      Cards
                    </div>
                    <div className={cn("text-xl font-bold", mode === 'simple' ? "text-slate-900" : "text-white")}>
                      {totalLeads}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-cyan-500 opacity-0 transition-all group-hover:opacity-100">
                  Abrir board completo
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
