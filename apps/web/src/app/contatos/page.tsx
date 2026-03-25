'use client';

import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useContactStore, type Contact } from '@/stores/useContactStore';
import { Edit, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface PipelineOption {
  id: string;
  name: string;
  stages: Array<{ id: string; name: string }>;
}

interface ContactFormState {
  name: string;
  email: string;
  phone: string;
  position: string;
  companyId: string;
  tagsInput: string;
}

interface ManualEntryFormState {
  contactName: string;
  email: string;
  phone: string;
  position: string;
  tagsInput: string;
  pipelineId: string;
  stageId: string;
  cardTitle: string;
  note: string;
  manualTakeover: boolean;
  createNewCompany: boolean;
  companyId: string;
  companyName: string;
  industry: string;
  website: string;
}

const emptyContactForm: ContactFormState = {
  name: '',
  email: '',
  phone: '',
  position: '',
  companyId: '',
  tagsInput: '',
};

const emptyManualEntryForm: ManualEntryFormState = {
  contactName: '',
  email: '',
  phone: '',
  position: '',
  tagsInput: '',
  pipelineId: '',
  stageId: '',
  cardTitle: '',
  note: '',
  manualTakeover: false,
  createNewCompany: false,
  companyId: '',
  companyName: '',
  industry: '',
  website: '',
};

function parseTags(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ContactsPage() {
  const { contacts, isLoading, error, fetchContacts, createContact, updateContact, createManualEntry, deleteContact } =
    useContactStore();
  const { companies, fetchCompanies } = useCompanyStore();
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [contactForm, setContactForm] = useState<ContactFormState>(emptyContactForm);
  const [manualForm, setManualForm] = useState<ManualEntryFormState>(emptyManualEntryForm);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isContactSubmitting, setIsContactSubmitting] = useState(false);
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  // Sidebar States
  const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);
  const [isManualSheetOpen, setIsManualSheetOpen] = useState(false);

  useEffect(() => {
    void fetchContacts();
    void fetchCompanies();

    let mounted = true;
    void api.get<PipelineOption[]>('/pipelines').then((response) => {
      if (!mounted) return;
      setPipelines(response.data);
      setManualForm((current) => ({
        ...current,
        pipelineId: response.data[0]?.id ?? '',
        stageId: response.data[0]?.stages[0]?.id ?? '',
      }));
    }).catch(() => {
      if (mounted) setPageError('Nao foi possivel carregar pipelines.');
    });

    return () => {
      mounted = false;
    };
  }, [fetchCompanies, fetchContacts]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      void fetchContacts(searchTerm);
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchContacts, searchTerm]);

  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === manualForm.pipelineId) ?? null,
    [manualForm.pipelineId, pipelines],
  );

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      position: contact.position ?? '',
      companyId: contact.companyId ?? '',
      tagsInput: contact.tags.join(', '),
    });
    setIsContactSheetOpen(true);
  };

  const closeContactSheet = () => {
    setIsContactSheetOpen(false);
    setEditingContact(null);
    setContactForm(emptyContactForm);
  };

  const closeManualSheet = () => {
    setIsManualSheetOpen(false);
    resetManualForm();
  };

  const resetManualForm = () => {
    setManualForm((current) => ({
      ...emptyManualEntryForm,
      pipelineId: current.pipelineId || pipelines[0]?.id || '',
      stageId: pipelines.find((pipeline) => pipeline.id === (current.pipelineId || pipelines[0]?.id))?.stages[0]?.id || '',
    }));
  };

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageError(null);
    setIsContactSubmitting(true);

    const payload = {
      name: contactForm.name,
      email: contactForm.email || undefined,
      phone: contactForm.phone || undefined,
      position: contactForm.position || undefined,
      companyId: contactForm.companyId || undefined,
      tags: parseTags(contactForm.tagsInput),
    };

    try {
      if (editingContact) {
        await updateContact(editingContact.id, payload);
      } else {
        await createContact(payload);
      }
      closeContactSheet();
    } catch (submitError) {
      setPageError(submitError instanceof Error ? submitError.message : 'Erro ao salvar contato.');
    } finally {
      setIsContactSubmitting(false);
    }
  };

  const handleManualSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageError(null);
    setIsManualSubmitting(true);

    try {
      await createManualEntry({
        contactName: manualForm.contactName,
        email: manualForm.email || undefined,
        phone: manualForm.phone || undefined,
        position: manualForm.position || undefined,
        tags: parseTags(manualForm.tagsInput),
        stageId: manualForm.stageId,
        cardTitle: manualForm.cardTitle || undefined,
        note: manualForm.note || undefined,
        manualTakeover: manualForm.manualTakeover,
        companyId: !manualForm.createNewCompany && manualForm.companyId ? manualForm.companyId : undefined,
        companyName: manualForm.createNewCompany ? manualForm.companyName || undefined : undefined,
        industry: manualForm.createNewCompany ? manualForm.industry || undefined : undefined,
        website: manualForm.createNewCompany ? manualForm.website || undefined : undefined,
      });
      await fetchCompanies();
      closeManualSheet();
    } catch (submitError) {
      setPageError(submitError instanceof Error ? submitError.message : 'Erro ao criar entrada manual.');
    } finally {
      setIsManualSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-8 p-6 lg:p-10">
      {/* Header Section */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[#1a202c]">Gestao de Clientes</h1>
          <p className="mt-2.5 text-base text-[#718096]">
            Base unificada de contatos e historico operacional. Gerencie oportunidades e leads no funil.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsManualSheetOpen(true)}
            className="inline-flex items-center gap-2.5 rounded-2xl bg-white border border-[#e2e8f0] px-6 py-3.5 text-sm font-bold text-[#4a5568] shadow-sm transition hover:bg-[#f7fafc] active:translate-y-0.5"
          >
            <Plus className="h-4.5 w-4.5 text-[#594ded]" />
            Entrada Direta
          </button>
          <button
            onClick={() => setIsContactSheetOpen(true)}
            className="inline-flex items-center gap-2.5 rounded-2xl bg-[#594ded] px-6 py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(89,77,237,0.25)] transition hover:translate-y-[-2px] hover:shadow-[0_12px_32px_rgba(89,77,237,0.3)] active:translate-y-0"
          >
            <Plus className="h-4.5 w-4.5" />
            Novo cliente
          </button>
        </div>
      </section>

      {(error || pageError) && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-600 shadow-sm">
          {pageError || error}
        </div>
      )}

      {/* Main Table Section - Full Width */}
      <section className="flex flex-col overflow-hidden rounded-[32px] border border-[#f0f0f0] bg-white shadow-[0_8px_32px_rgba(0,0,0,0.03)]">
        <div className="border-b border-[#f0f0f0] bg-[#fafafb]/50 p-5">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a0aec0] transition-colors group-focus-within:text-[#594ded]" />
            <input
              type="text"
              placeholder="Buscar clientes por nome, email ou empresa..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full rounded-[18px] border border-[#f0f0f0] bg-white py-3.5 pl-12 pr-5 text-[15px] text-[#2d3748] outline-none transition-all placeholder:text-[#a0aec0] focus:border-[#594ded]/30 focus:ring-4 focus:ring-[#594ded]/5"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto max-h-[calc(100vh-320px)]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#fafafb] border-b border-[#f0f0f0]">
                <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-[#718096]">Cliente</th>
                <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-[#718096]">Empresa</th>
                <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-[#718096]">Tags</th>
                <th className="px-6 py-4 text-[13px] font-bold uppercase tracking-wider text-[#718096]">Oportunidade</th>
                <th className="px-6 py-4 text-right text-[13px] font-bold uppercase tracking-wider text-[#718096]">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f5f5f5]">
              {isLoading && contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#594ded] border-t-transparent" />
                      <span className="text-sm font-medium text-[#718096]">Sincronizando base de clientes...</span>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!isLoading && contacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-lg font-semibold text-[#2d3748]">Nenhum cliente por aqui</p>
                      <p className="text-sm text-[#718096]">Sua base comercial está vazia ou o termo buscado não retornou resultados.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {contacts.map((contact) => (
                <tr key={contact.id} className="group transition-colors hover:bg-[#f8f9fc]">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0f0f0] text-sm font-bold text-[#718096]">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-[#2d3748]">{contact.name}</p>
                        <p className="mt-0.5 text-[13px] text-[#718096]">
                          {contact.email || contact.phone || 'Sem contato direto'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn(
                      "rounded-lg px-2.5 py-1 text-[13px] font-medium",
                      contact.company ? "bg-[#f4f4fb] text-[#594ded]" : "text-[#a0aec0]"
                    )}>
                      {contact.company?.name || 'Sem empresa'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-wrap gap-1.5">
                      {contact.tags.length ? (
                        contact.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="inline-flex items-center rounded-md bg-[#fafafb] border border-[#f0f0f0] px-2 py-0.5 text-[11px] font-bold uppercase tracking-tight text-[#718096]">
                            {tag}
                          </span>
                        ))
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {contact.cards?.[0] ? (
                      <div>
                        <p className="text-[13px] font-bold text-[#2d3748] truncate max-w-[240px]">{contact.cards[0].title}</p>
                        <p className="mt-0.5 text-[12px] text-[#594ded] font-medium">
                          {contact.cards[0].stage.pipeline.name}
                        </p>
                      </div>
                    ) : (
                      <span className="text-[13px] text-[#cbd5e0]">Nenhuma</span>
                    )}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => openEdit(contact)}
                        className="rounded-lg p-2 text-[#a0aec0] transition-colors hover:bg-[#f4f4fb] hover:text-[#594ded]"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Deseja realmente excluir este cliente?')) {
                            void deleteContact(contact.id);
                          }
                        }}
                        className="rounded-lg p-2 text-[#a0aec0] transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sidebars (Sheets) */}
      
      {/* 1. Contact Creation/Edit Sidebar */}
      <div className={cn('fixed inset-0 z-50 transition-opacity duration-300', isContactSheetOpen ? 'bg-slate-900/40 backdrop-blur-[2px] opacity-100 visible' : 'opacity-0 invisible')} onClick={closeContactSheet}>
        <aside className={cn('absolute right-0 top-0 h-full w-full max-w-[400px] bg-white shadow-2xl transition-transform duration-300 transform', isContactSheetOpen ? 'translate-x-0' : 'translate-x-full')} onClick={(e) => e.stopPropagation()}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] p-6">
              <div>
                <h2 className="text-xl font-bold text-[#1a202c]">
                  {editingContact ? 'Editar Cliente' : 'Novo Cliente'}
                </h2>
                <p className="mt-1 text-sm text-[#718096]">Cadastro comercial direto na base.</p>
              </div>
              <button onClick={closeContactSheet} className="rounded-xl border border-[#f0f0f0] p-2 hover:bg-[#fafafb]">
                <X className="h-5 w-5 text-[#a0aec0]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form className="space-y-5" onSubmit={handleContactSubmit}>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#718096] ml-1">Nome completo</label>
                  <input value={contactForm.name} onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white" placeholder="João Silva" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#718096] ml-1">E-mail</label>
                  <input value={contactForm.email} onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white" placeholder="contato@servus.ia" type="email" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#718096] ml-1">Telefone</label>
                  <input value={contactForm.phone} onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white" placeholder="(11) 9999-9999" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#718096] ml-1">Cargo</label>
                  <input value={contactForm.position} onChange={(event) => setContactForm((current) => ({ ...current, position: event.target.value }))} className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white" placeholder="Diretor Comercial" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#718096] ml-1">Empresa</label>
                  <select value={contactForm.companyId} onChange={(event) => setContactForm((current) => ({ ...current, companyId: event.target.value }))} className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white">
                    <option value="">Sem empresa</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#718096] ml-1">Tags (separadas por vírgula)</label>
                  <input value={contactForm.tagsInput} onChange={(event) => setContactForm((current) => ({ ...current, tagsInput: event.target.value }))} className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white" placeholder="Premium, Inbound, VIP" />
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={isContactSubmitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#594ded] px-4 py-4 text-sm font-bold text-white transition hover:translate-y-[-1px] hover:shadow-lg hover:shadow-[#594ded]/20 disabled:opacity-50">
                    <Save className="h-4 w-4" />
                    {isContactSubmitting ? 'Salvando...' : editingContact ? 'Salvar Alterações' : 'Criar Cliente'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </aside>
      </div>

      {/* 2. Manual Entry (Funnel) Sidebar */}
      <div className={cn('fixed inset-0 z-50 transition-opacity duration-300', isManualSheetOpen ? 'bg-slate-900/40 backdrop-blur-[2px] opacity-100 visible' : 'opacity-0 invisible')} onClick={closeManualSheet}>
        <aside className={cn('absolute right-0 top-0 h-full w-full max-w-[400px] bg-white shadow-2xl transition-transform duration-300 transform', isManualSheetOpen ? 'translate-x-0' : 'translate-x-full')} onClick={(e) => e.stopPropagation()}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[#f0f0f0] p-6">
              <div>
                <h2 className="text-xl font-bold text-[#1a202c]">Entrada Direta no Funil</h2>
                <p className="mt-1 text-sm text-[#718096]">Abre lead diretamente em uma etapa operacional.</p>
              </div>
              <button onClick={closeManualSheet} className="rounded-xl border border-[#f0f0f0] p-2 hover:bg-[#fafafb]">
                <X className="h-5 w-5 text-[#a0aec0]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form className="space-y-5" onSubmit={handleManualSubmit}>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#718096] ml-1">Nome do Contato</label>
                  <input value={manualForm.contactName} onChange={(event) => setManualForm((current) => ({ ...current, contactName: event.target.value }))} className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white" placeholder="Nome do lead" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#718096] ml-1">Pipeline</label>
                    <select value={manualForm.pipelineId} onChange={(event) => { const pipelineId = event.target.value; const nextPipeline = pipelines.find((item) => item.id === pipelineId); setManualForm((current) => ({ ...current, pipelineId, stageId: nextPipeline?.stages[0]?.id ?? '' })); }} className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-[13px] text-[#2d3748] outline-none focus:border-[#594ded]/30 transition">
                      {pipelines.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[13px] font-bold text-[#718096] ml-1">Etapa</label>
                    <select value={manualForm.stageId} onChange={(event) => setManualForm((current) => ({ ...current, stageId: event.target.value }))} className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-[13px] text-[#2d3748] outline-none focus:border-[#594ded]/30 transition">
                      {selectedPipeline?.stages.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#718096] ml-1">Titulo da Oportunidade</label>
                  <input value={manualForm.cardTitle} onChange={(event) => setManualForm((current) => ({ ...current, cardTitle: event.target.value }))} className="w-full rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white" placeholder="Ex: Upgrade de Plano - João" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-bold text-[#718096] ml-1">Observações Iniciais</label>
                  <textarea value={manualForm.note} onChange={(event) => setManualForm((current) => ({ ...current, note: event.target.value }))} rows={4} className="w-full resize-none rounded-[16px] border border-[#f0f0f0] bg-[#fafafb]/50 px-4 py-3 text-sm text-[#2d3748] outline-none transition focus:border-[#594ded]/30 focus:bg-white" placeholder="Contexto para o agente comercial..." />
                </div>
                <label className="flex items-center gap-3 py-2 text-sm text-[#4a5568] cursor-pointer group">
                  <input type="checkbox" checked={manualForm.manualTakeover} onChange={(event) => setManualForm((current) => ({ ...current, manualTakeover: event.target.checked }))} className="h-5 w-5 rounded-lg border-[#e2e8f0] bg-[#fafafb] text-[#594ded] focus:ring-[#594ded]/20" />
                  <span className="group-hover:text-[#2d3748] transition-colors">Iniciar em takeover manual</span>
                </label>
                <div className="pt-4">
                  <button type="submit" disabled={isManualSubmitting || !manualForm.stageId} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#594ded] px-4 py-4 text-sm font-bold text-white transition hover:translate-y-[-1px] hover:shadow-lg shadow-[#594ded]/20 disabled:opacity-50">
                    <Plus className="h-4 w-4" />
                    {isManualSubmitting ? 'Iniciando lead...' : 'Abrir Lead no Funil'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </aside>
      </div>

    </div>
  );
}

