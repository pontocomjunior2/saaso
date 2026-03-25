'use client';

import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import api from '@/lib/api';
import { GripVertical, LoaderCircle, MessageSquareText, Paperclip, Plus } from 'lucide-react';
import { useKanbanStore, type Card, type Stage } from '../../stores/useKanbanStore';
import { useUIMode } from '../layout/UIModeProvider';
import { cn } from '@/lib/utils';

interface Props {
  pipelineId?: string;
  onCardSelect?: (cardId: string) => void;
  selectedCardId?: string | null;
  onAddCard?: (stageId: string) => void;
  onEditCard?: (card: Card) => void;
}

function getConversation(card: Card) {
  return card.agentConversations?.[0] ?? null;
}

function getStageAgent(stage: Stage, card: Card) {
  return getConversation(card)?.agent ?? stage.agents?.[0] ?? null;
}

function getRuleSummary(card: Card) {
  if (card.automation) {
    return {
      badge: card.automation.label,
      nextAction: card.automation.nextAction,
    };
  }

  const run = card.sequenceRuns?.[0] ?? null;
  if (run) {
    const nextStep = run.steps.find((step) => step.status === 'PENDING' || step.status === 'QUEUED');
    const nextStepLabel = nextStep ? `${nextStep.order} via ${nextStep.channel}` : null;
    const badgeByStatus: Record<string, string> = {
      PENDING: 'Régua na fila',
      RUNNING: 'Régua em execução',
      COMPLETED: 'Régua concluída',
      FAILED: 'Régua com erro',
      PAUSED: 'Régua pausada',
      CANCELED: 'Régua cancelada',
    };

    return {
      badge: badgeByStatus[run.status] ?? 'Régua ativa',
      nextAction: nextStep
        ? `Status ${run.status.toLowerCase()} · próxima ação ${nextStepLabel}.`
        : `Status ${run.status.toLowerCase()} na campanha ${run.campaign.name}.`,
    };
  }

  const latestActivity = card.activities?.[0] ?? null;

  if (!latestActivity) {
    return {
      badge: 'Sem régua',
      nextAction: 'Aguardando primeira ação operacional.',
    };
  }

  if (latestActivity.type === 'JOURNEY_HANDOFF') {
    return {
      badge: 'Régua pausada',
      nextAction: 'Aguardando intervenção humana antes de retomar a automação.',
    };
  }

  if (latestActivity.type === 'JOURNEY_STAGE_MOVED') {
    return {
      badge: 'Régua ativa',
      nextAction: 'Monitorar resposta do lead na nova etapa do funil.',
    };
  }

  if (latestActivity.type === 'JOURNEY_ACTIVITY') {
    return {
      badge: 'Régua em execução',
      nextAction: latestActivity.content,
    };
  }

  return {
    badge: 'Fluxo operacional',
    nextAction: latestActivity.content,
  };
}

function getStageTheme(stageName: string) {
  const key = stageName.toLowerCase();

  if (key.includes('todo') || key.includes('to do') || key.includes('novo')) {
    return {
      dot: 'bg-[#fc736f]',
      badge: 'bg-[#fdf2f2] text-[#fc736f]',
      progress: 'bg-[#fc736f]',
      accent: 'border-[#ffd9d8]',
    };
  }

  if (key.includes('progress') || key.includes('andamento')) {
    return {
      dot: 'bg-[#3b78f5]',
      badge: 'bg-[#eef3ff] text-[#3b78f5]',
      progress: 'bg-[#3b78f5]',
      accent: 'border-[#d8e5ff]',
    };
  }

  if (key.includes('review') || key.includes('revis')) {
    return {
      dot: 'bg-[#f5bd4f]',
      badge: 'bg-[#faf6e2] text-[#f5bd4f]',
      progress: 'bg-[#f5bd4f]',
      accent: 'border-[#f5e6b9]',
    };
  }

  return {
    dot: 'bg-[#22bd73]',
    badge: 'bg-[#ebfae2] text-[#22bd73]',
    progress: 'bg-[#22bd73]',
    accent: 'border-[#c8efda]',
  };
}

function getCardMetaPills(card: Card, stage: Stage) {
  const theme = getStageTheme(stage.name);
  const agent = getStageAgent(stage, card);
  const labels = [agent?.name ? `Agente ${agent.name}` : null, card.automation?.label ?? null]
    .filter(Boolean)
    .slice(0, 2) as string[];

  if (labels.length === 0) {
    labels.push(stage.name);
  }

  return labels.map((label, index) => ({
    label,
    className: index === 0 ? theme.badge : 'bg-[#f5f5f5] text-[#9e9e9e]',
  }));
}

function getCardProgress(card: Card) {
  if (card.sequenceRuns?.[0]) {
    const run = card.sequenceRuns[0];
    const total = run.steps.length || 1;
    const done = run.steps.filter((step) => ['SENT', 'SKIPPED', 'RUNNING'].includes(step.status)).length;
    return { done, total };
  }

  if (card.automation?.status === 'COMPLETED') {
    return { done: 4, total: 4 };
  }

  if (card.automation?.status === 'RUNNING' || card.automation?.status === 'AUTOPILOT') {
    return { done: 2, total: 4 };
  }

  if (card.agentConversations?.[0]?.status === 'OPEN') {
    return { done: 1, total: 4 };
  }

  return { done: 0, total: 4 };
}

function getInitials(value?: string | null) {
  if (!value) {
    return '--';
  }

  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function KanbanBoard({ 
  pipelineId, 
  onCardSelect, 
  selectedCardId,
  onAddCard,
  onEditCard
}: Props) {
  const { 
    pipeline, 
    isLoading, 
    error, 
    fetchPipeline, 
    moveCardLocally, 
    moveCardApi,
    toggleAutopilot 
  } = useKanbanStore();
  useUIMode();
  const [isMounted, setIsMounted] = useState(false);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    if (pipelineId) {
      void fetchPipeline(pipelineId);
    }
  }, [pipelineId, fetchPipeline]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    moveCardLocally(draggableId, source.droppableId, destination.droppableId, source.index, destination.index);
    void moveCardApi(draggableId, destination.droppableId, destination.index);
  };

  const handleAutopilotToggle = async (card: Card) => {
    const conversation = getConversation(card);
    if (!conversation) return;

    setBusyCardId(card.id);
    try {
      await toggleAutopilot(conversation.id, conversation.status);
    } catch (err) {
      console.error('Failed to toggle autopilot', err);
    } finally {
      setBusyCardId(null);
    }
  };

  if (!isMounted) return null;

  if (isLoading) {
    return (
      <div className="flex min-h-[36rem] items-center justify-center rounded-[28px] border border-[#f0f0f0] bg-white p-10 text-[#9e9e9e]">
        Carregando pipeline...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[36rem] items-center justify-center rounded-[28px] border border-rose-200 bg-rose-50 p-10 text-rose-600">
        {error}
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex min-h-[36rem] items-center justify-center rounded-[28px] border border-[#f0f0f0] bg-white p-10 text-[#9e9e9e]">
        Nenhum pipeline selecionado ou encontrado.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[42rem] flex-col text-[#393939]">
      <main className="flex-1 overflow-x-auto px-1 pb-1">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex h-full items-start gap-4 pb-2">
            {pipeline.stages.map((stage) => {
              const stageTheme = getStageTheme(stage.name);

              return (
                <div key={stage.id} className="flex min-h-[38rem] w-[21rem] min-w-[21rem] flex-col">
                  <div className="flex items-center justify-between pb-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', stageTheme.dot)} />
                      <h2 className="text-[15px] font-bold text-[#1a202c]">{stage.name}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded-[6px] px-2 py-0.5 text-[11px] font-bold tracking-wider', stageTheme.badge)}>
                        {stage.cards?.length || 0}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAddCard?.(stage.id)}
                        className="flex h-6 w-6 items-center justify-center text-[#a0aec0] transition hover:text-[#718096]"
                        aria-label={`Adicionar card em ${stage.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={cn(
                          'min-h-[150px] flex-1 overflow-y-auto rounded-2xl pb-4 transition-colors',
                          snapshot.isDraggingOver ? 'bg-[#f5f3ff]' : 'bg-transparent',
                        )}
                      >
                        {stage.cards?.map((card, index) => {
                          const conversation = getConversation(card);
                          const autopilotEnabled = conversation?.status === 'OPEN';
                          const ruleSummary = getRuleSummary(card);
                          const metaPills = getCardMetaPills(card, stage);
                          const progress = getCardProgress(card);
                          const progressPercent = Math.max(
                            10,
                            Math.round((progress.done / Math.max(progress.total, 1)) * 100),
                          );

                          return (
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  style={provided.draggableProps.style}
                                  onClick={() => onCardSelect?.(card.id)}
                                  className={cn(
                                    'mb-4 rounded-[16px] border border-[#f0f0f0] bg-white p-[20px] transition-all',
                                    snapshot.isDragging
                                      ? `shadow-[0_24px_48px_rgba(89,77,237,0.14)] ${stageTheme.accent}`
                                      : selectedCardId === card.id
                                        ? `shadow-[0_8px_24px_rgba(89,77,237,0.08)] border-[#594ded] ring-1 ring-[#594ded]`
                                        : 'shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-[#e2e8f0]',
                                    onCardSelect ? 'cursor-pointer' : '',
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex flex-wrap gap-2">
                                      {metaPills.map((pill) => (
                                        <span
                                          key={pill.label}
                                          className={cn('rounded-[6px] px-2 py-1 text-[10px] font-bold uppercase tracking-widest', pill.className)}
                                        >
                                          {pill.label}
                                        </span>
                                      ))}
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onEditCard?.({ ...card, stageId: stage.id });
                                        }}
                                        className="rounded-md border border-[#f0f0f0] bg-white p-1.5 text-[#777777] transition hover:bg-[#fafafa] hover:text-[#594ded]"
                                        title="Editar Card"
                                      >
                                        <Plus className="h-3.5 w-3.5 rotate-45" /> {/* Using Plus rotated for 'edit' or I can use Pencil if I import it */}
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`Arrastar card ${card.title}`}
                                        onClick={(event) => event.stopPropagation()}
                                        {...provided.dragHandleProps}
                                        className="rounded-md border border-[#f0f0f0] bg-white p-1.5 text-[#777777] transition hover:bg-[#fafafa]"
                                      >
                                        <GripVertical className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-4">
                                    <p className="text-[15px] font-bold leading-snug text-[#1a202c]">{card.title}</p>
                                    
                                    {card.contact && (
                                      <p className="mt-1 text-[13px] font-semibold text-[#594ded]">
                                        {card.contact.name}
                                        {/* @ts-ignore - company exists in the expanded card object from include */}
                                        {card.contact.company?.name && <span className="text-[#a0aec0] font-normal"> · {card.contact.company.name}</span>}
                                      </p>
                                    )}

                                    <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-[#a0aec0]">
                                      {ruleSummary.nextAction}
                                    </p>
                                  </div>

                                  <div className="mt-5">
                                    <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-[#1a202c]">
                                      <span className="text-[#a0aec0]">Progress</span>
                                      <span>
                                        {progress.done}/{progress.total}
                                      </span>
                                    </div>
                                    <div className="mt-2.5 flex h-[6px] overflow-hidden rounded-full bg-[#f0f0f0]">
                                      <div
                                        className={cn('h-full rounded-full transition-all duration-500', stageTheme.progress)}
                                        style={{ width: `${progressPercent}%` }}
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-5 flex items-center justify-between">
                                    <div className="flex -space-x-2">
                                      {[card.contact?.name, card.assignee?.name].filter(Boolean).map((person, idx) => (
                                        <div
                                          key={person}
                                          className="relative flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white bg-[#d9d9d9] text-[10px] font-bold text-[#545a66]"
                                          style={{ zIndex: 10 - idx }}
                                        >
                                          {getInitials(person)}
                                        </div>
                                      ))}
                                    </div>

                                    <div className="flex items-center gap-4 text-[12px] font-medium text-[#a0aec0]">
                                      <span className="flex items-center gap-1.5 transition hover:text-[#718096]">
                                        <MessageSquareText className="h-4 w-4" />
                                        {card.sequenceRuns?.[0]?.steps.length ?? card.agentConversations?.length ?? 0}
                                      </span>
                                      <span className="flex items-center gap-1.5 transition hover:text-[#718096]">
                                        <Paperclip className="h-4 w-4" />
                                        {card.activities?.length ?? 0}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="mt-4 rounded-2xl border border-[#f0f0f0] bg-[#fbfbfb] p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-[10px] uppercase tracking-[0.22em] text-[#9e9e9e]">
                                          Piloto automático
                                        </p>
                                        <p className="mt-1 text-[12px] font-medium text-[#545a66]">
                                          {conversation
                                            ? autopilotEnabled
                                              ? 'Agente conduzindo o fluxo.'
                                              : 'Humano em takeover.'
                                            : 'Sem conversa ativa.'}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={!conversation || busyCardId === card.id}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          void handleAutopilotToggle(card);
                                        }}
                                        className={`inline-flex h-8 w-16 items-center rounded-full px-1 transition ${
                                          autopilotEnabled ? 'bg-[#22bd73]' : 'bg-[#d9d9d9]'
                                        } ${!conversation ? 'cursor-not-allowed opacity-50' : ''}`}
                                      >
                                        <span
                                          className={`flex h-6 w-6 items-center justify-center rounded-full bg-white shadow transition ${
                                            autopilotEnabled ? 'translate-x-8' : 'translate-x-0'
                                          }`}
                                        >
                                          {busyCardId === card.id ? (
                                            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#9e9e9e]" />
                                          ) : null}
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </main>
    </div>
  );
}
