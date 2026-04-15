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
import { Workflow, Plus, LoaderCircle, MessageSquareText, Save } from 'lucide-react';
import { useEffect } from 'react';

type WhatsAppAccountOption = {
  id: string;
  provider: string;
  phoneNumber: string | null;
  instanceName: string | null;
  status: string;
  assignedPipelineId: string | null;
  assignedPipelineName: string | null;
};

export default function PipelineBoardPage() {
  const { mode } = useUIMode();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { pipeline, fetchPipeline } = useKanbanStore();

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
  const [accounts, setAccounts] = useState<WhatsAppAccountOption[]>([]);
  const [selectedWhatsAppAccountId, setSelectedWhatsAppAccountId] = useState('');
  const [selectedInboundStageId, setSelectedInboundStageId] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

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

  useEffect(() => {
    let mounted = true;

    const loadAccounts = async () => {
      try {
        const response = await api.get<WhatsAppAccountOption[]>('/whatsapp/accounts');
        if (mounted) {
          setAccounts(response.data);
        }
      } catch {
        if (mounted) {
          setConfigError('Nao foi possivel carregar as contas WhatsApp.');
        }
      }
    };

    void loadAccounts();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSelectedWhatsAppAccountId(pipeline?.whatsAppAccountId ?? '');
    setSelectedInboundStageId(pipeline?.whatsAppInboundStageId ?? '');
  }, [pipeline?.whatsAppAccountId, pipeline?.whatsAppInboundStageId]);

  const selectedAccount = accounts.find((account) => account.id === selectedWhatsAppAccountId) ?? null;
  const availableAccounts = accounts.filter(
    (account) => !account.assignedPipelineId || account.assignedPipelineId === pipeline?.id || account.id === selectedWhatsAppAccountId,
  );

  const savePipelineConfig = async () => {
    setIsSavingConfig(true);
    setConfigError(null);
    setConfigMessage(null);

    try {
      await api.patch(`/pipelines/${id}`, {
        whatsAppAccountId: selectedWhatsAppAccountId || null,
        whatsAppInboundStageId: selectedInboundStageId || null,
      });
      await fetchPipeline(id);
      const response = await api.get<WhatsAppAccountOption[]>('/whatsapp/accounts');
      setAccounts(response.data);
      setConfigMessage('Configuracao do canal salva neste pipeline.');
    } catch (error: any) {
      setConfigError(error?.response?.data?.message ?? 'Nao foi possivel salvar a configuracao do WhatsApp.');
    } finally {
      setIsSavingConfig(false);
    }
  };

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

        <section className={mode === 'simple' ? 'rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm' : 'rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-5'}>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <MessageSquareText className={mode === 'simple' ? 'h-4 w-4 text-cyan-600' : 'h-4 w-4 text-cyan-100'} />
                <p className={mode === 'simple' ? 'text-sm font-semibold text-slate-950' : 'text-sm font-semibold text-white'}>Canal WhatsApp do pipeline</p>
              </div>
              <p className={mode === 'simple' ? 'mt-1 text-sm text-slate-600' : 'mt-1 text-sm text-slate-400'}>
                Novos inbounds deste canal entram direto na etapa configurada abaixo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void savePipelineConfig()}
              disabled={isSavingConfig}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#594ded] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#594ded]/20 transition hover:bg-[#4d42cc] disabled:opacity-60"
            >
              {isSavingConfig ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar canal
            </button>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className={mode === 'simple' ? 'mb-2 block text-sm font-medium text-slate-700' : 'mb-2 block text-sm font-medium text-slate-200'}>Conta WhatsApp</span>
              <select
                value={selectedWhatsAppAccountId}
                onChange={(e) => {
                  const nextAccountId = e.target.value;
                  setSelectedWhatsAppAccountId(nextAccountId);
                  if (!nextAccountId) {
                    setSelectedInboundStageId('');
                  }
                }}
                className={mode === 'simple' ? 'h-12 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none' : 'h-12 w-full rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white outline-none'}
              >
                <option value="">Sem canal vinculado</option>
                {availableAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.phoneNumber || account.instanceName || account.id} · {account.provider}
                    {account.assignedPipelineName ? ` · ${account.assignedPipelineName}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={mode === 'simple' ? 'mb-2 block text-sm font-medium text-slate-700' : 'mb-2 block text-sm font-medium text-slate-200'}>Etapa de entrada</span>
              <select
                value={selectedInboundStageId}
                onChange={(e) => setSelectedInboundStageId(e.target.value)}
                disabled={!selectedWhatsAppAccountId}
                className={mode === 'simple' ? 'h-12 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none' : 'h-12 w-full rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white outline-none'}
              >
                <option value="">Primeira etapa do pipeline</option>
                {allStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {selectedAccount?.assignedPipelineName && selectedAccount.assignedPipelineId !== pipeline?.id ? (
            <div className={mode === 'simple' ? 'mt-4 rounded-[18px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700' : 'mt-4 rounded-[18px] border border-amber-300/15 bg-amber-300/10 p-4 text-sm text-amber-100'}>
              Esta conta esta vinculada ao pipeline {selectedAccount.assignedPipelineName}. Ao salvar, o canal passa a responder por este funil.
            </div>
          ) : null}

          {pipeline?.whatsAppAccount ? (
            <div className={mode === 'simple' ? 'mt-4 rounded-[18px] border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-800' : 'mt-4 rounded-[18px] border border-cyan-300/15 bg-cyan-300/10 p-4 text-sm text-cyan-100'}>
              Canal atual: {pipeline.whatsAppAccount.phoneNumber || pipeline.whatsAppAccount.instanceName || pipeline.whatsAppAccount.id}
              {' · '}
              {pipeline.whatsAppAccount.provider}
              {pipeline.whatsAppInboundStage ? ` · entrada em ${pipeline.whatsAppInboundStage.name}` : ' · entrada na primeira etapa'}
            </div>
          ) : null}

          {configError ? <div className={mode === 'simple' ? 'mt-4 rounded-[18px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700' : 'mt-4 rounded-[18px] border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100'}>{configError}</div> : null}
          {configMessage ? <div className={mode === 'simple' ? 'mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700' : 'mt-4 rounded-[18px] border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100'}>{configMessage}</div> : null}
        </section>

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
