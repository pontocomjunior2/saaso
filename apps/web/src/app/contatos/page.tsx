'use client';

import api from '@/lib/api';
import { useCompanyStore } from '@/stores/useCompanyStore';
import { useContactStore, type Contact } from '@/stores/useContactStore';
import { Edit, Plus, Save, Search, Trash2 } from 'lucide-react';
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
  };

  const resetContactForm = () => {
    setEditingContact(null);
    setContactForm(emptyContactForm);
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
      resetContactForm();
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
      resetManualForm();
    } catch (submitError) {
      setPageError(submitError instanceof Error ? submitError.message : 'Erro ao criar entrada manual.');
    } finally {
      setIsManualSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 p-6 lg:p-8">
      <section className="rounded-[32px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-6 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white">Contatos e entrada manual</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
              Crie contatos avulsos ou abra leads manualmente ja vinculados a empresa, etapa e oportunidade.
            </p>
          </div>
          <button
            onClick={resetContactForm}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.1]"
          >
            <Plus className="h-4 w-4" />
            Novo contato
          </button>
        </div>
      </section>

      {(error || pageError) && (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {pageError || error}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <div className="flex flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.78)] shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
          <div className="border-b border-white/10 bg-white/[0.04] p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar contatos por nome ou email..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 border-b border-white/10 bg-[rgba(7,16,29,0.94)] shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Contato</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Empresa</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Tags</th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Oportunidade</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Acoes</th>
                </tr>
              </thead>
              <tbody className="cursor-default divide-y divide-white/6 bg-transparent">
                {isLoading && contacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">Localizando contatos...</td>
                  </tr>
                ) : null}
                {!isLoading && contacts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      Nenhum contato encontrado.
                    </td>
                  </tr>
                ) : null}
                {contacts.map((contact) => (
                  <tr key={contact.id} className="group transition-colors hover:bg-white/[0.03]">
                    <td className="border-b border-white/[0.04] px-6 py-4 text-sm text-white">
                      <p className="font-medium">{contact.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {contact.email || contact.phone || 'Sem email ou telefone'}
                      </p>
                    </td>
                    <td className="border-b border-white/[0.04] px-6 py-4 text-sm text-slate-300">
                      {contact.company?.name || 'Sem empresa'}
                    </td>
                    <td className="border-b border-white/[0.04] px-6 py-4 text-sm text-slate-300">
                      <div className="flex flex-wrap gap-2">
                        {contact.tags.length ? (
                          contact.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs text-slate-200">
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500">Sem tags</span>
                        )}
                      </div>
                    </td>
                    <td className="border-b border-white/[0.04] px-6 py-4 text-sm text-slate-300">
                      <p>{contact.cards?.[0]?.title || 'Sem card aberto'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {contact.cards?.[0]
                          ? `${contact.cards[0].stage.pipeline.name} · ${contact.cards[0].stage.name}`
                          : 'Sem oportunidade vinculada'}
                      </p>
                    </td>
                    <td className="border-b border-white/[0.04] px-6 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => openEdit(contact)}
                          className="rounded-xl bg-white/[0.06] p-1.5 text-slate-500 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Deseja realmente excluir este contato?')) {
                              void deleteContact(contact.id);
                            }
                          }}
                          className="rounded-xl bg-white/[0.06] p-1.5 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
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
        </div>

        <div className="space-y-5">
          <section className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Contato rapido</p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              {editingContact ? `Editar ${editingContact.name}` : 'Criar contato avulso'}
            </h2>

            <form className="mt-5 space-y-4" onSubmit={handleContactSubmit}>
              <input value={contactForm.name} onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Nome completo" required />
              <input value={contactForm.email} onChange={(event) => setContactForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="E-mail" type="email" />
              <input value={contactForm.phone} onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Telefone" />
              <input value={contactForm.position} onChange={(event) => setContactForm((current) => ({ ...current, position: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Cargo" />
              <select value={contactForm.companyId} onChange={(event) => setContactForm((current) => ({ ...current, companyId: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]">
                <option value="">Sem empresa vinculada</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
              <input value={contactForm.tagsInput} onChange={(event) => setContactForm((current) => ({ ...current, tagsInput: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Tags separadas por virgula" />
              <button type="submit" disabled={isContactSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-4 w-4" />
                {isContactSubmitting ? 'Salvando...' : editingContact ? 'Salvar alteracoes' : 'Criar contato'}
              </button>
              {editingContact ? (
                <button
                  type="button"
                  onClick={resetContactForm}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06]"
                >
                  Cancelar edicao
                </button>
              ) : null}
            </form>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">Entrada manual</p>
            <h2 className="mt-1 text-xl font-semibold text-white">Abrir lead ja no funil</h2>

            <form className="mt-5 space-y-4" onSubmit={handleManualSubmit}>
              <input value={manualForm.contactName} onChange={(event) => setManualForm((current) => ({ ...current, contactName: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Nome do contato" required />
              <input value={manualForm.email} onChange={(event) => setManualForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="E-mail" type="email" />
              <input value={manualForm.phone} onChange={(event) => setManualForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Telefone" />
              <input value={manualForm.position} onChange={(event) => setManualForm((current) => ({ ...current, position: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Cargo" />
              <input value={manualForm.tagsInput} onChange={(event) => setManualForm((current) => ({ ...current, tagsInput: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Tags separadas por virgula" />

              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input type="checkbox" checked={manualForm.createNewCompany} onChange={(event) => setManualForm((current) => ({ ...current, createNewCompany: event.target.checked, companyId: event.target.checked ? '' : current.companyId }))} className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300" />
                Criar nova empresa nesta entrada
              </label>

              {manualForm.createNewCompany ? (
                <>
                  <input value={manualForm.companyName} onChange={(event) => setManualForm((current) => ({ ...current, companyName: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Nome da empresa" />
                  <input value={manualForm.industry} onChange={(event) => setManualForm((current) => ({ ...current, industry: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Industria" />
                  <input value={manualForm.website} onChange={(event) => setManualForm((current) => ({ ...current, website: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="https://empresa.com" />
                </>
              ) : (
                <select value={manualForm.companyId} onChange={(event) => setManualForm((current) => ({ ...current, companyId: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]">
                  <option value="">Sem empresa vinculada</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              )}

              <select value={manualForm.pipelineId} onChange={(event) => { const pipelineId = event.target.value; const nextPipeline = pipelines.find((item) => item.id === pipelineId); setManualForm((current) => ({ ...current, pipelineId, stageId: nextPipeline?.stages[0]?.id ?? '' })); }} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]">
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
                ))}
              </select>
              <select value={manualForm.stageId} onChange={(event) => setManualForm((current) => ({ ...current, stageId: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/40 focus:bg-white/[0.08]">
                {selectedPipeline?.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </select>
              <input value={manualForm.cardTitle} onChange={(event) => setManualForm((current) => ({ ...current, cardTitle: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Titulo da oportunidade" />
              <textarea value={manualForm.note} onChange={(event) => setManualForm((current) => ({ ...current, note: event.target.value }))} rows={4} className="w-full resize-none rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]" placeholder="Resumo inicial ou observacao do operador" />
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input type="checkbox" checked={manualForm.manualTakeover} onChange={(event) => setManualForm((current) => ({ ...current, manualTakeover: event.target.checked }))} className="h-4 w-4 rounded border-white/20 bg-transparent text-cyan-300" />
                Comecar esta conversa ja em takeover manual
              </label>
              <button type="submit" disabled={isManualSubmitting || !manualForm.stageId} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_rgba(89,211,255,0.28)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-4 w-4" />
                {isManualSubmitting ? 'Criando lead...' : 'Criar entrada manual'}
              </button>
            </form>
          </section>
        </div>
      </section>
    </div>
  );
}
