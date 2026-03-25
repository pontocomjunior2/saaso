'use client';

import { CheckCircle2, LoaderCircle, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import type { LeadFormField } from '../../../../stores/useLeadFormStore';

interface PublicLeadFormResponse {
  name: string;
  slug: string;
  headline: string | null;
  description: string | null;
  submitButtonLabel: string;
  successTitle: string | null;
  successMessage: string | null;
  fields: LeadFormField[];
}

interface SubmitSuccess {
  success: true;
  successTitle: string;
  successMessage: string;
}

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
}

function getFieldInitialValue(field: LeadFormField): string {
  if (field.type === 'select') {
    return '';
  }

  return '';
}

export default function PublicLeadFormPage() {
  const params = useParams<{ tenantSlug: string; slug: string }>();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tenantSlug = params.tenantSlug ?? '';
  const slug = params.slug ?? '';
  const isEmbedMode = searchParams.get('embed') === '1';
  const [form, setForm] = useState<PublicLeadFormResponse | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SubmitSuccess | null>(null);

  useEffect(() => {
    if (!tenantSlug || !slug) {
      return;
    }

    let isMounted = true;

    const loadForm = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${getApiBaseUrl()}/public/forms/${tenantSlug}/${slug}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Nao foi possivel carregar este formulario.');
        }

        const data = (await response.json()) as PublicLeadFormResponse;
        if (!isMounted) {
          return;
        }

        setForm(data);
        setValues(
          Object.fromEntries(
            data.fields.map((field) => [field.key, getFieldInitialValue(field)]),
          ),
        );
      } catch (requestError: unknown) {
        if (isMounted) {
          setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar formulario.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadForm();
    return () => {
      isMounted = false;
    };
  }, [tenantSlug, slug]);

  const title = useMemo(() => form?.headline || form?.name || 'Formulario', [form]);

  useEffect(() => {
    if (!isEmbedMode || typeof window === 'undefined' || !rootRef.current) {
      return;
    }

    const postHeight = () => {
      if (!rootRef.current) {
        return;
      }

      window.parent.postMessage(
        {
          type: 'saaso:form-resize',
          formKey: `${tenantSlug}:${slug}`,
          height: Math.ceil(rootRef.current.scrollHeight),
        },
        '*',
      );
    };

    const schedulePost = () => {
      window.requestAnimationFrame(postHeight);
    };

    schedulePost();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedulePost()) : null;

    if (resizeObserver && rootRef.current) {
      resizeObserver.observe(rootRef.current);
    }

    window.addEventListener('resize', schedulePost);

    return () => {
      window.removeEventListener('resize', schedulePost);
      resizeObserver?.disconnect();
    };
  }, [error, form, isEmbedMode, isLoading, isSubmitting, slug, success, tenantSlug, values]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/public/forms/${tenantSlug}/${slug}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as SubmitSuccess | { message?: string | string[] };

      if (!response.ok) {
        const errorData = data as { message?: string | string[] };
        const message = Array.isArray(errorData.message) ? errorData.message.join(' ') : errorData.message;
        throw new Error(message || 'Nao foi possivel enviar o formulario.');
      }

      setSuccess(data as SubmitSuccess);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Erro ao enviar formulario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`relative overflow-hidden text-white ${
        isEmbedMode
          ? 'min-h-0 bg-transparent px-0 py-0'
          : 'min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(89,211,255,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,177,104,0.14),transparent_24%),linear-gradient(180deg,#07111f,#02060d)] px-6 py-10'
      }`}
    >
      <div className={`mx-auto w-full ${isEmbedMode ? 'max-w-none' : 'max-w-4xl'}`}>
        <div
          ref={rootRef}
          className={`${
            isEmbedMode
              ? 'rounded-[28px] border border-slate-200 bg-white p-6 text-slate-900 shadow-none lg:p-7'
              : 'rounded-[36px] border border-white/10 bg-[rgba(7,16,29,0.82)] p-6 shadow-[0_32px_120px_rgba(0,0,0,0.45)] lg:p-8'
          }`}
        >
          {!isEmbedMode ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Saaso lead capture
            </div>
          ) : null}

          {isLoading ? (
            <div className={`flex items-center gap-3 py-14 ${isEmbedMode ? 'text-slate-500' : 'text-slate-300'}`}>
              <LoaderCircle className={`h-5 w-5 animate-spin ${isEmbedMode ? 'text-slate-700' : 'text-cyan-300'}`} />
              Carregando formulario...
            </div>
          ) : error ? (
            <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : success ? (
            <div className="mt-8 rounded-[32px] border border-emerald-400/20 bg-emerald-400/10 px-6 py-10 text-center">
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-200" />
              <h1 className={`mt-5 text-3xl font-semibold ${isEmbedMode ? 'text-slate-950' : 'text-white'}`}>
                {success.successTitle}
              </h1>
              <p className={`mt-3 text-sm leading-7 ${isEmbedMode ? 'text-slate-700' : 'text-emerald-50/85'}`}>
                {success.successMessage}
              </p>
            </div>
          ) : form ? (
            <>
              <h1 className={`text-3xl font-semibold lg:text-4xl ${isEmbedMode ? 'text-slate-950' : 'mt-6 text-white'}`}>
                {title}
              </h1>
              <p className={`mt-3 max-w-2xl text-sm leading-7 ${isEmbedMode ? 'text-slate-600' : 'text-slate-300'}`}>
                {form.description || 'Preencha seus dados para iniciar o atendimento.'}
              </p>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                {form.fields.map((field) => (
                  <label key={field.id} className="block">
                    <span className={`mb-2 block text-sm font-medium ${isEmbedMode ? 'text-slate-800' : 'text-slate-200'}`}>
                      {field.label}
                      {field.required ? ' *' : ''}
                    </span>
                    {field.type === 'textarea' ? (
                      <textarea
                        rows={5}
                        value={values[field.key] ?? ''}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        placeholder={field.placeholder}
                        className={`w-full rounded-[24px] border px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 ${
                          isEmbedMode
                            ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-slate-400'
                            : 'border-white/10 bg-white/[0.05] text-white focus:border-cyan-300/50 focus:bg-white/[0.07]'
                        }`}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={values[field.key] ?? ''}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        className={`w-full rounded-[24px] border px-4 py-3 text-sm outline-none transition ${
                          isEmbedMode
                            ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-slate-400'
                            : 'border-white/10 bg-white/[0.05] text-white focus:border-cyan-300/50 focus:bg-white/[0.07]'
                        }`}
                      >
                        <option value="">Selecione</option>
                        {(field.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                        value={values[field.key] ?? ''}
                        onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                        placeholder={field.placeholder}
                        className={`w-full rounded-[24px] border px-4 py-3 text-sm outline-none transition placeholder:text-slate-500 ${
                          isEmbedMode
                            ? 'border-slate-200 bg-slate-50 text-slate-900 focus:border-slate-400'
                            : 'border-white/10 bg-white/[0.05] text-white focus:border-cyan-300/50 focus:bg-white/[0.07]'
                        }`}
                      />
                    )}
                    {field.helpText ? (
                      <p className={`mt-2 text-xs ${isEmbedMode ? 'text-slate-500' : 'text-slate-500'}`}>{field.helpText}</p>
                    ) : null}
                  </label>
                ))}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium transition hover:translate-y-[-1px] disabled:opacity-60 ${
                    isEmbedMode
                      ? 'bg-slate-950 text-white shadow-[0_16px_40px_rgba(15,23,42,0.18)]'
                      : 'bg-cyan-300 text-slate-950 shadow-[0_18px_48px_rgba(89,211,255,0.24)]'
                  }`}
                >
                  {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isSubmitting ? 'Enviando...' : form.submitButtonLabel}
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
