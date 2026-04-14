'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import KanbanBoard from '@/components/board/KanbanBoard';
import { CardFormModal } from '@/components/board/CardFormModal';
import { CardDetailSheet } from '@/components/board/CardDetailSheet';
import { PipelineTemplateModal } from '@/components/board/PipelineTemplateModal';
import type { DetailedCard } from '@/components/board/board-types';
import api from '@/lib/api';
import { useUIMode } from '@/components/layout/UIModeProvider';
import { useKanbanStore } from '@/stores/useKanbanStore';
import { Workflow, Plus } from 'lucide-react';
import { useEffect } from 'react';

export default function PipelineBoardPage() {
  useUIMode();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { pipeline } = useKanbanStore();

  const allStages = (pipeline?.stages ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    order: s.order,
  }));

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<DetailedCard | null>(null);
  const [isCardLoading, setIsCardLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<{ id: string; title: string; stageId: string } | null>(null);

  const fetchCard = useCallback(async (cardId: string) => {
    setIsCardLoading(true);
    try {
      const response = await api.get<DetailedCard>(`/cards/${cardId}`);
      setSelectedCard(response.data);
    } catch {
      setSelectedCard(null);
    } finally {
      setIsCardLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCardId) {
      setSelectedCard(null);
      return;
    }

    void fetchCard(selectedCardId);
  }, [selectedCardId, fetchCard]);

  const refreshSelectedCard = useCallback(() => {
    if (selectedCardId) {
      void fetchCard(selectedCardId);
    }
  }, [selectedCardId, fetchCard]);

  return (
    <>
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 p-6 lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-[#594ded] text-white shadow-sm">
              <Workflow className="h-6 w-6" />
            </div>
            <h1 className="text-[24px] font-bold text-[#1a202c]">Board Operacional</h1>
          </div>

          <button
            onClick={() => {
              setEditingCard(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#594ded] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#594ded]/20 transition hover:bg-[#4d42cc]"
          >
            <Plus className="h-4 w-4" />
            Novo Card
          </button>
        </div>

        <div className="rounded-[30px] bg-transparent min-h-[46rem]">
          <KanbanBoard
            pipelineId={id}
            selectedCardId={selectedCardId}
            onCardSelect={(cardId) => setSelectedCardId(cardId)}
            onAddCard={() => {
              setEditingCard(null);
              setIsModalOpen(true);
            }}
            onEditCard={(card) => {
              setEditingCard({ id: card.id, title: card.title, stageId: card.stageId });
              setIsModalOpen(true);
            }}
            onLoadTemplate={() => setIsTemplateModalOpen(true)}
          />
        </div>
      </div>

      <CardDetailSheet
        card={selectedCard}
        isOpen={Boolean(selectedCardId)}
        isLoading={isCardLoading}
        onClose={() => {
          setSelectedCardId(null);
          setSelectedCard(null);
        }}
        onRefreshCard={refreshSelectedCard}
        allStages={allStages}
      />

      <CardFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCard(null);
        }}
        pipelineId={id}
        cardId={editingCard?.id}
        initialTitle={editingCard?.title}
        initialStageId={editingCard?.stageId}
      />

      <PipelineTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        currentPipelineId={id}
      />
    </>
  );
}
