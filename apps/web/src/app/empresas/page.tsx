'use client';

import React, { useEffect, useState } from 'react';
import { Search, Plus, Trash2, Edit, ExternalLink, Save } from 'lucide-react';
import { useCompanyStore } from '../../stores/useCompanyStore';

interface CompanyFormState {
  name: string;
  industry: string;
  website: string;
}

const emptyCompanyForm: CompanyFormState = {
  name: '',
  industry: '',
  website: '',
};

export default function CompaniesPage() {
  const { companies, isLoading, error, fetchCompanies, createCompany, updateCompany, deleteCompany } = useCompanyStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [companyForm, setCompanyForm] = useState<CompanyFormState>(emptyCompanyForm);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCompanies();
  }, [fetchCompanies]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      void fetchCompanies(searchTerm);
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, fetchCompanies]);

  const handleEdit = (company: (typeof companies)[number]) => {
    setEditingCompanyId(company.id);
    setCompanyForm({
      name: company.name,
      industry: company.industry || '',
      website: company.website || '',
    });
    setPageError(null);
  };

  const resetForm = () => {
    setEditingCompanyId(null);
    setCompanyForm(emptyCompanyForm);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setPageError(null);

    const payload = {
      name: companyForm.name,
      industry: companyForm.industry || undefined,
      website: companyForm.website || undefined,
    };

    try {
      if (editingCompanyId) {
        await updateCompany(editingCompanyId, payload);
      } else {
        await createCompany(payload);
      }
      resetForm();
    } catch (submitError) {
      setPageError(submitError instanceof Error ? submitError.message : 'Erro ao salvar empresa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-[1680px] flex-col gap-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Empresas</h1>
          <p className="mt-1 text-sm text-slate-400">Gerencie as empresas (contas) do seu tenant.</p>
        </div>
        <button
          onClick={resetForm}
          className="flex items-center gap-2 rounded-2xl bg-cyan-300 px-4 py-2.5 font-medium text-slate-950 shadow-[0_18px_48px_rgba(89,211,255,0.28)] transition hover:translate-y-[-1px]"
        >
          <Plus className="w-4 h-4" />
          Nova Empresa
        </button>
      </div>

      {(error || pageError) ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
          {pageError || error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex flex-1 flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.78)] shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
        <div className="border-b border-white/10 bg-white/[0.04] p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar empresas por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-[rgba(7,16,29,0.94)] shadow-sm">
              <tr>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Empresa</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Segmento (Indústria)</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Website</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="cursor-default divide-y divide-white/6 bg-transparent">
              {isLoading && companies.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400">Localizando empresas...</td>
                </tr>
              )}
              
              {!isLoading && companies.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400">
                    Nenhuma empresa encontrada. Comece a prospectar!
                  </td>
                </tr>
              )}

              {companies.map((company) => (
                <tr key={company.id} className="group transition-colors hover:bg-white/[0.03]">
                  <td className="border-b border-white/[0.04] px-6 py-4 text-sm font-medium text-white">
                    {company.name}
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      {company.contacts?.length || 0} contatos vinculados
                    </span>
                  </td>
                  <td className="border-b border-white/[0.04] px-6 py-4 text-sm text-slate-300">
                     <span className="inline-flex items-center rounded-full bg-white/[0.08] px-2.5 py-0.5 text-xs font-medium text-slate-200">
                      {company.industry || 'Não especificado'}
                    </span>
                  </td>
                  <td className="border-b border-white/[0.04] px-6 py-4 text-sm text-cyan-200 hover:text-cyan-100">
                     {company.website ? (
                        <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-1">
                          {company.website.replace(/^https?:\/\//, '')} <ExternalLink className="w-3 h-3" />
                        </a>
                     ) : '-'}
                  </td>
                  <td className="border-b border-white/[0.04] px-6 py-4 text-right text-sm">
                    <div className="flex justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => handleEdit(company)}
                        className="rounded-xl bg-white/[0.06] p-1.5 text-slate-500 transition-colors hover:bg-cyan-400/10 hover:text-cyan-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm('Deseja realmente excluir esta empresa? \nAtenção: Contatos vinculados não terão mais empresa associada.')) {
                            deleteCompany(company.id);
                          }
                        }}
                        className="rounded-xl bg-white/[0.06] p-1.5 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <section className="rounded-[30px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-5 shadow-[0_20px_72px_rgba(0,0,0,0.24)]">
        <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
          {editingCompanyId ? 'Editar empresa' : 'Criar empresa'}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {editingCompanyId ? 'Atualizar conta' : 'Nova conta'}
        </h2>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <input
            value={companyForm.name}
            onChange={(event) => setCompanyForm((current) => ({ ...current, name: event.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
            placeholder="Nome da empresa"
            required
          />
          <input
            value={companyForm.industry}
            onChange={(event) => setCompanyForm((current) => ({ ...current, industry: event.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
            placeholder="Industria / segmento"
          />
          <input
            value={companyForm.website}
            onChange={(event) => setCompanyForm((current) => ({ ...current, website: event.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.08]"
            placeholder="https://empresa.com"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? 'Salvando...' : editingCompanyId ? 'Salvar alteracoes' : 'Criar empresa'}
          </button>
          {editingCompanyId ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              Cancelar edicao
            </button>
          ) : null}
        </form>
      </section>
      </div>
    </div>
  );
}
