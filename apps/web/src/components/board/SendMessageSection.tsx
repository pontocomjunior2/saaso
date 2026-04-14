'use client';

import { useState } from 'react';
import { Send, MessageSquare, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DetailedCard, StageMessageTemplate } from './board-types';
import { useKanbanStore } from '@/stores/useKanbanStore';

function resolveVariables(text: string, card: DetailedCard): string {
  return text
    .replace(/\{\{nome\}\}/g, card.contact?.name ?? '')
    .replace(/\{\{email\}\}/g, card.contact?.email ?? '')
    .replace(/\{\{telefone\}\}/g, card.contact?.phone ?? '');
}

export function SendMessageSection({
  card,
  onMessageSent,
}: {
  card: DetailedCard;
  onMessageSent: () => void;
}) {
  const { sendMessage } = useKanbanStore();
  const [selectedTemplate, setSelectedTemplate] = useState<StageMessageTemplate | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templates = card.stage.messageTemplates ?? [];

  const handleSend = async () => {
    if (!selectedTemplate) return;
    setIsSending(true);
    setError(null);
    try {
      await sendMessage(card.id, selectedTemplate.id, selectedTemplate.channel);
      alert(`Mensagem enviada com sucesso via ${selectedTemplate.channel === 'WHATSAPP' ? 'WhatsApp' : 'Email'}!`);
      onMessageSent();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  const isDisabled = (() => {
    if (!selectedTemplate) return true;
    if (!card.contact) return true;
    if (selectedTemplate.channel === 'WHATSAPP' && !card.contact.phone) return true;
    if (selectedTemplate.channel === 'EMAIL' && !card.contact.email) return true;
    return false;
  })();

  const disabledReason = (() => {
    if (!card.contact) return 'Este card nao tem contato vinculado.';
    if (selectedTemplate?.channel === 'WHATSAPP' && !card.contact.phone) return 'Contato sem telefone';
    if (selectedTemplate?.channel === 'EMAIL' && !card.contact.email) return 'Contato sem email';
    return null;
  })();

  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-slate-900">
        <Send className="h-4 w-4 text-cyan-600" />
        <h3 className="text-sm font-semibold">Enviar Mensagem</h3>
      </div>

      {!card.contact ? (
        <p className="mt-4 text-sm text-slate-500">Este card nao tem contato vinculado.</p>
      ) : templates.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nenhum template configurado para esta etapa.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Template selector */}
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  setSelectedTemplate(template);
                  setError(null);
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition',
                  selectedTemplate?.id === template.id
                    ? 'border-[#594ded] bg-[#594ded]/5 text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300',
                )}
              >
                <span className="text-sm font-medium">{template.name}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]',
                    template.channel === 'WHATSAPP'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700',
                  )}
                >
                  {template.channel === 'WHATSAPP' ? 'WhatsApp' : 'Email'}
                </span>
              </button>
            ))}
          </div>

          {/* Preview */}
          {selectedTemplate && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              {selectedTemplate.channel === 'EMAIL' && selectedTemplate.subject && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Assunto</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {resolveVariables(selectedTemplate.subject, card)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Preview</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {resolveVariables(selectedTemplate.body, card)}
                </p>
              </div>
            </div>
          )}

          {/* Send button */}
          {selectedTemplate && (
            <div>
              <button
                type="button"
                onClick={handleSend}
                disabled={isDisabled || isSending}
                title={disabledReason ?? undefined}
                className={cn(
                  'inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50',
                  selectedTemplate.channel === 'WHATSAPP'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-blue-600 hover:bg-blue-700',
                )}
              >
                {isSending ? (
                  'Enviando...'
                ) : (
                  <>
                    {selectedTemplate.channel === 'WHATSAPP' ? (
                      <MessageSquare className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {selectedTemplate.channel === 'WHATSAPP' ? 'Enviar via WhatsApp' : 'Enviar via Email'}
                  </>
                )}
              </button>

              {disabledReason && (
                <p className="mt-2 text-center text-xs text-slate-500">{disabledReason}</p>
              )}

              {error && (
                <p className="mt-2 text-center text-sm text-red-600">{error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
