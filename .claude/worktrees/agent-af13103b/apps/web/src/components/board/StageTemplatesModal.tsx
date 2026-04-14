'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Loader2, Save, Mail, MessageSquare } from 'lucide-react';
import api from '@/lib/api';

interface StageTemplate {
  id: string;
  name: string;
  channel: 'WHATSAPP' | 'EMAIL';
  subject: string | null;
  body: string;
}

interface Props {
  stageId: string;
  stageName: string;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM = { name: '', channel: 'WHATSAPP' as 'WHATSAPP' | 'EMAIL', subject: '', body: '' };

export function StageTemplatesModal({ stageId, stageName, isOpen, onClose }: Props) {
  const [templates, setTemplates] = useState<StageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEditingId(null);
    setError(null);
    setIsLoading(true);
    api
      .get<StageTemplate[]>(`/stage-message-templates?stageId=${stageId}`)
      .then((res) => setTemplates(res.data))
      .catch(() => setError('Erro ao carregar templates.'))
      .finally(() => setIsLoading(false));
  }, [isOpen, stageId]);

  const startNew = () => {
    setForm(EMPTY_FORM);
    setEditingId('new');
    setError(null);
  };

  const startEdit = (t: StageTemplate) => {
    setForm({ name: t.name, channel: t.channel, subject: t.subject ?? '', body: t.body });
    setEditingId(t.id);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError(null);
  };

  const save = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      setError('Nome e corpo são obrigatórios.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        stageId,
        name: form.name.trim(),
        channel: form.channel,
        subject: form.channel === 'EMAIL' && form.subject.trim() ? form.subject.trim() : undefined,
        body: form.body.trim(),
      };

      if (editingId === 'new') {
        const res = await api.post<StageTemplate>('/stage-message-templates', payload);
        setTemplates((prev) => [...prev, res.data]);
      } else {
        const { stageId: _sid, ...patchPayload } = payload;
        const res = await api.patch<StageTemplate>(`/stage-message-templates/${editingId}`, patchPayload);
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? res.data : t)));
      }
      setEditingId(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao salvar template.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/stage-message-templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError('Erro ao remover template.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex w-full max-w-xl flex-col gap-5 rounded-[28px] bg-white p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-bold text-[#1a202c]">Templates da etapa</h2>
            <p className="text-[13px] text-[#a0aec0]">{stageName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#a0aec0] hover:bg-[#f5f5f5] hover:text-[#1a202c]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[13px] text-rose-600">
            {error}
          </div>
        )}

        {/* Template list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-[#a0aec0]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {templates.length === 0 && editingId !== 'new' && (
              <p className="py-4 text-center text-[13px] text-[#a0aec0]">
                Nenhum template configurado. Clique em + para adicionar.
              </p>
            )}
            {templates.map((t) => (
              editingId === t.id ? (
                <TemplateForm
                  key={t.id}
                  form={form}
                  setForm={setForm}
                  onSave={save}
                  onCancel={cancelEdit}
                  isSaving={isSaving}
                />
              ) : (
                <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-[#f0f0f0] px-4 py-3">
                  <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white ${t.channel === 'WHATSAPP' ? 'bg-[#22bd73]' : 'bg-[#3b78f5]'}`}>
                    {t.channel === 'WHATSAPP' ? <MessageSquare className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-[#1a202c]">{t.name}</p>
                    <p className="truncate text-[12px] text-[#a0aec0]">{t.body}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(t)}
                      className="rounded-lg px-2 py-1 text-[12px] font-medium text-[#718096] hover:bg-[#f5f5f5] hover:text-[#1a202c]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => void remove(t.id)}
                      disabled={deletingId === t.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a0aec0] hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                    >
                      {deletingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )
            ))}

            {editingId === 'new' && (
              <TemplateForm
                form={form}
                setForm={setForm}
                onSave={save}
                onCancel={cancelEdit}
                isSaving={isSaving}
              />
            )}
          </div>
        )}

        {editingId === null && (
          <button
            onClick={startNew}
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#e2e8f0] py-3 text-[13px] font-semibold text-[#594ded] hover:border-[#594ded] hover:bg-[#f5f3ff]"
          >
            <Plus className="h-4 w-4" /> Novo template
          </button>
        )}

        <p className="text-[11px] text-[#a0aec0]">
          Variáveis disponíveis: <code className="rounded bg-[#f5f5f5] px-1">{'{{nome}}'}</code>{' '}
          <code className="rounded bg-[#f5f5f5] px-1">{'{{telefone}}'}</code>{' '}
          <code className="rounded bg-[#f5f5f5] px-1">{'{{email}}'}</code>
        </p>
      </div>
    </div>
  );
}

function TemplateForm({
  form,
  setForm,
  onSave,
  onCancel,
  isSaving,
}: {
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#594ded]/30 bg-[#f5f3ff] p-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#718096]">Nome</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Boas-vindas"
            className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#1a202c] outline-none focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#718096]">Canal</label>
          <select
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value as 'WHATSAPP' | 'EMAIL' })}
            className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#1a202c] outline-none focus:border-[#594ded]"
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">Email</option>
          </select>
        </div>
      </div>

      {form.channel === 'EMAIL' && (
        <div>
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#718096]">Assunto</label>
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Assunto do email"
            className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#1a202c] outline-none focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#718096]">Mensagem</label>
        <textarea
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          placeholder="Olá {{nome}}, tudo bem?"
          rows={4}
          className="w-full resize-none rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 text-[13px] text-[#1a202c] outline-none focus:border-[#594ded] focus:ring-1 focus:ring-[#594ded]"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-xl px-4 py-2 text-[13px] font-medium text-[#718096] hover:bg-white"
        >
          Cancelar
        </button>
        <button
          onClick={() => void onSave()}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-[#594ded] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#4d42cc] disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar
        </button>
      </div>
    </div>
  );
}
