'use client';

import KanbanBoard from '@/components/board/KanbanBoard';
import KanbanListView from '@/components/board/KanbanListView';
import { CardFormModal } from '@/components/board/CardFormModal';
import { CardDetailSheet } from '@/components/board/CardDetailSheet';
import type { DetailedCard, PipelineSummary } from '@/components/board/board-types';
import api from '@/lib/api';
import { useUIMode } from '@/components/layout/UIModeProvider';
import { KanbanSquare, Orbit, RefreshCcw, Workflow, Plus, Search, Filter, Calendar, LayoutGrid, List } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function PipelinesPage() {
  useUIMode();
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<DetailedCard | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCardLoading, setIsCardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para novas funcionalidades
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<{ id: string; title: string; stageId: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.get<PipelineSummary[]>('/pipelines');
        if (isMounted) {
          setPipelines(response.data);
          setSelectedPipelineId((current) => current ?? response.data[0]?.id ?? null);
        }
      } catch {
        if (isMounted) {
          setError('Nao foi possivel carregar os pipelines do tenant.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void run();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedCardId) {
      setSelectedCard(null);
      return;
    }

    let isMounted = true;

    const run = async () => {
      setIsCardLoading(true);

      try {
        const response = await api.get<DetailedCard>(`/cards/${selectedCardId}`);
        if (isMounted) {
          setSelectedCard(response.data);
        }
      } catch {
        if (isMounted) {
          setSelectedCard(null);
        }
      } finally {
        if (isMounted) {
          setIsCardLoading(false);
        }
      }
    };

    void run();
    return () => {
      isMounted = false;
    };
  }, [selectedCardId]);

  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ?? null,
    [pipelines, selectedPipelineId],
  );

  const totalCards = selectedPipeline?.stages.reduce((total, stage) => total + (stage.cards?.length ?? 0), 0) ?? 0;

  return (
    <>
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6 lg:p-8">
        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-[#594ded] text-white shadow-sm">
                <Workflow className="h-6 w-6" />
              </div>
              <h1 className="text-[24px] font-bold text-[#1a202c]">
                {selectedPipeline?.name ?? 'Board Operacional'}
              </h1>
              
              <div className="ml-4 hidden items-center -space-x-2 sm:flex">
                {[1, 2, 3].map((i) => (
                  <div key={i} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#fbfbfb] bg-[#${['dfdfdf', 'cfcfcf', 'bfbfbf'][i-1]}] text-[11px] font-semibold text-[#545a66]`}>
                    U{i}
                  </div>
                ))}
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#fbfbfb] bg-[#f0f0f0] text-[11px] font-medium text-[#718096]">
                  +9
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setEditingCard(null);
                setIsModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#594ded] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#594ded]/20 transition hover:bg-[#4d42cc]"
            >
              <Plus className="h-4 w-4" />
              New Task
            </button>
          </div>

          <div className="flex flex-col gap-4 border-b border-[#f0f0f0] pb-0 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-6">
              {pipelines.map((pipeline) => {
                const isActive = pipeline.id === selectedPipelineId;
                return (
                  <button
                    key={pipeline.id}
                    onClick={() => {
                      setSelectedPipelineId(pipeline.id);
                      setSelectedCardId(null);
                      setSelectedCard(null);
                    }}
                    className={`flex items-center gap-2 border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-[#594ded] text-[#594ded]'
                        : 'border-transparent text-[#718096] hover:text-[#1a202c]'
                    }`}
                  >
                    <KanbanSquare className="h-[18px] w-[18px]" />
                    {pipeline.name}
                  </button>
                );
              })}
              
              <button 
                onClick={() => setViewMode('kanban')}
                className={`mt-1 flex items-center gap-2 border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
                  viewMode === 'kanban' ? 'border-[#594ded] text-[#594ded]' : 'border-transparent text-[#718096] hover:text-[#1a202c]'
                }`}
              >
                <LayoutGrid className="h-[18px] w-[18px]" /> Board
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`mt-1 flex items-center gap-2 border-b-2 px-1 pb-4 text-sm font-medium transition-colors ${
                  viewMode === 'list' ? 'border-[#594ded] text-[#594ded]' : 'border-transparent text-[#718096] hover:text-[#1a202c]'
                }`}
              >
                <List className="h-[18px] w-[18px]" /> List
              </button>
              <button disabled className="mt-1 flex items-center gap-2 border-b-2 border-transparent px-1 pb-4 text-sm font-medium text-[#a0aec0] transition-colors hover:text-[#718096]">
                <Calendar className="h-[18px] w-[18px]" /> Calendar
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a0aec0]" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full rounded-lg border border-[#f0f0f0] py-2 pl-9 pr-4 text-sm text-[#393939] placeholder-[#a0aec0] outline-none transition focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded] sm:w-48"
                />
              </div>
              
              <button className="flex items-center gap-2 text-sm font-medium text-[#718096] transition hover:text-[#1a202c]">
                <Filter className="h-4 w-4" /> Filter
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[46rem] items-center justify-center rounded-[30px] border border-[#f0f0f0] bg-white text-[#9e9e9e]">
            Carregando board principal...
          </div>
        ) : selectedPipelineId ? (
          <div className="rounded-[30px] bg-transparent min-h-[46rem]">
            {viewMode === 'kanban' ? (
              <KanbanBoard
                pipelineId={selectedPipelineId}
                selectedCardId={selectedCardId}
                onCardSelect={(cardId) => setSelectedCardId(cardId)}
                onAddCard={(stageId) => {
                  setEditingCard(null);
                  setIsModalOpen(true);
                  // Pass initialStageId to modal if needed, but the modal already handles it via initialStageId prop
                }}
                onEditCard={(card) => {
                  setEditingCard({ id: card.id, title: card.title, stageId: card.stageId });
                  setIsModalOpen(true);
                }}
              />
            ) : (
              <KanbanListView 
                onCardSelect={(cardId) => setSelectedCardId(cardId)}
                onEditCard={(card) => {
                  setEditingCard({ id: card.id, title: card.title, stageId: card.stageId });
                  setIsModalOpen(true);
                }}
              />
            )}
          </div>
        ) : (
          <div className="flex min-h-[42rem] items-center justify-center rounded-[30px] border border-[#f0f0f0] bg-white px-6 text-center text-[#9e9e9e]">
            Nenhum pipeline encontrado. Rode o seed para popular o ambiente demo.
          </div>
        )}
      </div>

      <CardDetailSheet
        card={selectedCard}
        isOpen={Boolean(selectedCardId)}
        isLoading={isCardLoading}
        onClose={() => {
          setSelectedCardId(null);
          setSelectedCard(null);
        }}
      />

      <CardFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCard(null);
        }}
        pipelineId={selectedPipelineId || ''}
        cardId={editingCard?.id}
        initialTitle={editingCard?.title}
        initialStageId={editingCard?.stageId}
      />
    </>
  );
}
