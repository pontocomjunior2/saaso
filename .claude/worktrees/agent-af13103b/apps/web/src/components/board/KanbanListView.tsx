'use client';

import { useKanbanStore } from '@/stores/useKanbanStore';
import { 
  MoreVertical, 
  Pencil, 
  Trash2, 
  User, 
  Mail, 
  Phone, 
  Bot, 
  Play, 
  Pause,
  MessageSquare,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface KanbanListViewProps {
  onCardSelect: (cardId: string) => void;
  onEditCard: (card: any) => void;
}

export default function KanbanListView({ onCardSelect, onEditCard }: KanbanListViewProps) {
  const { pipeline, toggleAutopilot, isLoading } = useKanbanStore();

  if (isLoading && !pipeline) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-[30px] border border-[#f0f0f0] bg-white text-[#9e9e9e]">
        Carregando lista de cards...
      </div>
    );
  }

  const allCards = pipeline?.stages.flatMap(stage => 
    stage.cards.map(card => ({ ...card, stageName: stage.name, stageId: stage.id }))
  ) || [];

  if (allCards.length === 0) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[30px] border border-dashed border-[#f0f0f0] bg-white px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f7f7f7] text-[#cbd5e0]">
          <MessageSquare className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-[#1a202c]">Nenhum card encontrado</h3>
        <p className="mt-2 max-w-xs text-sm text-[#718096]">
          Não existem cards ativos neste pipeline. Crie um novo card para começar a gerenciar sua operação.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[30px] border border-[#f0f0f0] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#f0f0f0] bg-[#fafafb]">
              <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-[#718096]">Card / Título</th>
              <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-[#718096]">Estágio</th>
              <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-[#718096]">Automação</th>
              <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-[#718096]">Contato / Email</th>
              <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-[#718096]">Responsável</th>
              <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-[#718096] text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0f0f0]">
            {allCards.map((card: any) => {
              const automation = card.automation;
              const hasConversation = card.agentConversations && card.agentConversations.length > 0;
              const conversationId = hasConversation ? card.agentConversations[0].id : null;
              const conversationStatus = hasConversation ? card.agentConversations[0].status : null;

              return (
                <tr 
                  key={card.id} 
                  className="group transition hover:bg-[#fafafb]"
                >
                  <td 
                    className="cursor-pointer px-6 py-4"
                    onClick={() => onCardSelect(card.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f2f5] text-[#594ded]">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold text-[#1a202c] group-hover:text-[#594ded]">
                          {card.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#a0aec0]">
                          ID: {card.id.slice(0, 8)}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        card.stageName.toLowerCase().includes('todo') ? "bg-[#fc736f]" :
                        card.stageName.toLowerCase().includes('progress') ? "bg-[#3b78f5]" :
                        card.stageName.toLowerCase().includes('review') ? "bg-[#f5bd4f]" :
                        "bg-[#22bd73]"
                      )} />
                      <span className="text-[14px] font-medium text-[#545a66]">{card.stageName}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]",
                      automation?.status === 'AUTOPILOT' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                      automation?.status === 'TAKEOVER' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                      "bg-slate-50 text-slate-500 border border-slate-100"
                    )}>
                      {automation?.label || 'Inativo'}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 text-[13px] text-[#545a66]">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-[#cbd5e0]" />
                        <span className="truncate font-medium">{card.contact?.name || 'Sem contato'}</span>
                      </div>
                      {card.contact?.email && (
                        <div className="flex items-center gap-2 text-[11px] text-[#a0aec0]">
                          <Mail className="h-3 w-3" />
                          <span className="truncate">{card.contact.email}</span>
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-center">
                    {card.assignee ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f1f1f1] text-[11px] font-bold text-[#545a66] shadow-sm">
                          {card.assignee.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[14px] font-medium text-[#545a66]">{card.assignee.name.split(' ')[0]}</span>
                      </div>
                    ) : (
                      <span className="text-[13px] text-[#cbd5e0]">Não atribuído</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                      {conversationId && (
                        <button
                          onClick={() => toggleAutopilot(conversationId, conversationStatus)}
                          title={conversationStatus === 'OPEN' ? "Mudar para Takeover" : "Mudar para Piloto Automático"}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl transition",
                            conversationStatus === 'OPEN' ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                          )}
                        >
                          {conversationStatus === 'OPEN' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                      )}
                      
                      <button
                        onClick={() => onEditCard(card)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8f8fd] text-[#718096] hover:bg-[#eeeffc] hover:text-[#594ded] transition"
                        title="Editar Card"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => onCardSelect(card.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8f8fd] text-[#718096] hover:bg-[#f0f2f5] hover:text-[#1a202c] transition"
                        title="Ver Detalhes"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
