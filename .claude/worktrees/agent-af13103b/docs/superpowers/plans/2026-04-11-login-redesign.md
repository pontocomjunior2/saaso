# Login Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o visual da tela de login por um card flutuante centralizado com paleta violeta/azul, formulário simplificado (sem campo tenant slug) e textos corretamente acentuados.

**Architecture:** Apenas os componentes `LoadingExperience` e `AuthExperience` dentro de `SessionProvider.tsx` são reescritos. Toda a lógica de autenticação (`AppSessionProvider`, `login()`, `logout()`, eventos, storage) permanece intacta. Uma nova função `sanitizeErrorMessage()` é adicionada para limpar prefixos técnicos antes de exibir erros ao usuário.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, lucide-react

---

### Task 1: Adicionar `sanitizeErrorMessage` e corrigir textos hardcoded

**Files:**
- Modify: `apps/web/src/components/layout/SessionProvider.tsx`

- [ ] **Step 1: Localizar os textos hardcoded com erros de acentuação**

Abra `apps/web/src/components/layout/SessionProvider.tsx` e localize as seguintes strings:

```
"Nao foi possivel autenticar no workspace."   (linha ~103)
"Sua sessao expirou ou ficou invalida. Faça login novamente."  (linha ~404)
"Conectando com o tenant de demonstracao"  (linha ~155)
"Tentando autenticar automaticamente em"  (linha ~157)
"usuario"  (linha ~158)
```

- [ ] **Step 2: Adicionar `sanitizeErrorMessage` logo após `getErrorMessage`**

Adicione a função abaixo imediatamente após o fechamento da função `getErrorMessage` (por volta da linha 104):

```ts
function sanitizeErrorMessage(raw: string): string {
  return raw.replace(/^Erro no Backend:\s*/i, '').trim();
}
```

- [ ] **Step 3: Corrigir os textos com acentuação**

Faça as seguintes substituições:

| Antes | Depois |
|---|---|
| `'Nao foi possivel autenticar no workspace.'` | `'Não foi possível autenticar no workspace.'` |
| `'Sua sessao expirou ou ficou invalida. Faça login novamente.'` | `'Sua sessão expirou. Faça login novamente.'` |

- [ ] **Step 4: Verificar que TypeScript compila sem erros**

```bash
cd apps/web && npx tsc --noEmit
```

Esperado: nenhum erro.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/SessionProvider.tsx
git commit -m "fix: corrigir acentuação e adicionar sanitizeErrorMessage no SessionProvider"
```

---

### Task 2: Reescrever `LoadingExperience`

**Files:**
- Modify: `apps/web/src/components/layout/SessionProvider.tsx`

- [ ] **Step 1: Localizar o componente `LoadingExperience` (linha ~136)**

O componente atual tem um layout 2 colunas com referências a `session.tenantSlug` e `session.email`. Será substituído por um card centralizado minimalista.

- [ ] **Step 2: Substituir o componente `LoadingExperience` completo**

Substitua toda a função `LoadingExperience` pelo seguinte:

```tsx
function LoadingExperience() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 bg-[#080614]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.22)_0%,transparent_65%)]" />
        <div className="absolute -bottom-32 -right-32 h-[600px] w-[600px] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18)_0%,transparent_65%)]" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative w-full max-w-sm rounded-3xl border border-violet-500/20 bg-[rgba(15,10,30,0.88)] p-8 shadow-[0_32px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
          <KeyRound className="h-5 w-5 text-violet-300" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-white">Entrar</h1>
        <p className="mt-1 text-sm text-slate-400">Verificando sessão...</p>

        <div className="mt-8 flex items-center gap-3 text-slate-400">
          <LoaderCircle className="h-5 w-5 animate-spin text-violet-400" />
          <span className="text-sm">Conectando com o workspace...</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Atualizar a assinatura da chamada em `AppSessionProvider`**

Localize (por volta da linha 437):
```tsx
{status === 'checking' ? <LoadingExperience session={sessionInput} /> : null}
```

Substitua por:
```tsx
{status === 'checking' ? <LoadingExperience /> : null}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```

Esperado: nenhum erro.

- [ ] **Step 5: Verificar visualmente**

```bash
cd apps/web && npm run dev
```

Abra `http://localhost:3000` com o token de sessão apagado (DevTools → Application → Session Storage → apagar `saaso.access_token`) e confirme que a tela de loading exibe o card violeta centralizado com spinner.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/layout/SessionProvider.tsx
git commit -m "feat: reescrever LoadingExperience com card violeta centralizado"
```

---

### Task 3: Reescrever `AuthExperience`

**Files:**
- Modify: `apps/web/src/components/layout/SessionProvider.tsx`

- [ ] **Step 1: Localizar o componente `AuthExperience` (linha ~166)**

O componente atual tem layout 2 colunas com painel de marketing à esquerda e formulário com 3 campos (tenantSlug, email, senha) à direita. Será substituído por card centralizado com apenas email + senha.

- [ ] **Step 2: Substituir o componente `AuthExperience` completo**

Substitua toda a função `AuthExperience` pelo seguinte:

```tsx
function AuthExperience({
  authError,
  initialValues,
  onSubmit,
}: {
  authError: string | null;
  initialValues: LoginInput;
  onSubmit: (input: LoginInput) => Promise<void>;
}) {
  const [form, setForm] = useState<LoginInput>(initialValues);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm(initialValues);
  }, [initialValues]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(form);
    } catch {
      // authError já é definido pelo provider
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-10 bg-[#080614]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[600px] w-[600px] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.22)_0%,transparent_65%)]" />
        <div className="absolute -bottom-32 -right-32 h-[600px] w-[600px] animate-pulse rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18)_0%,transparent_65%)]" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="relative w-full max-w-sm rounded-3xl border border-violet-500/20 bg-[rgba(15,10,30,0.88)] p-8 shadow-[0_32px_100px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <div className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10">
          <KeyRound className="h-5 w-5 text-violet-300" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-white">Entrar</h1>
        <p className="mt-1 text-sm text-slate-400">{formatTenantName(initialValues.tenantSlug)}</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">E-mail</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.08]"
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Senha</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.08]"
              placeholder="Digite sua senha"
              required
              autoComplete="current-password"
            />
          </label>

          {authError && (
            <div className="flex gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{sanitizeErrorMessage(authError)}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition',
              isSubmitting
                ? 'cursor-wait bg-violet-500/40 text-white'
                : 'bg-[linear-gradient(135deg,#8b5cf6,#3b82f6)] text-white shadow-[0_14px_40px_rgba(139,92,246,0.3)] hover:translate-y-[-1px]',
            )}
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {isSubmitting ? 'Autenticando...' : 'Entrar no workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```

Esperado: nenhum erro.

- [ ] **Step 4: Verificar visualmente — estado unauthenticated**

Com o servidor dev rodando (`npm run dev`):

1. Apague o token (DevTools → Application → Session Storage → `saaso.access_token`)
2. Recarregue a página
3. Confirme que aparece o card violeta centralizado com campos e-mail + senha (sem campo tenant slug)
4. Confirme que o fundo é preto com gradientes violeta e azul
5. Faça login com credenciais corretas e confirme que redireciona para o dashboard

- [ ] **Step 5: Verificar visualmente — mensagem de erro**

1. Com a tela de login visível, insira uma senha errada e submeta
2. Confirme que a mensagem de erro aparece **sem** o prefixo "Erro no Backend:"
3. Ex: deve mostrar "Credenciais inválidas." e não "Erro no Backend: Credenciais inválidas."

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/layout/SessionProvider.tsx
git commit -m "feat: reescrever AuthExperience com card violeta, form simplificado e erros limpos"
```

---

### Task 4: Verificação final de regressão

**Files:** nenhum arquivo novo

- [ ] **Step 1: Build de produção sem erros**

```bash
cd apps/web && npm run build
```

Esperado: build completo sem erros de TypeScript ou lint.

- [ ] **Step 2: Verificar fluxo completo de sessão**

Com `npm run dev` rodando:

1. **Auto-login demo:** apague o token, recarregue — deve fazer auto-login se `NEXT_PUBLIC_DEMO_TENANT_SLUG` / `NEXT_PUBLIC_DEMO_EMAIL` / `NEXT_PUBLIC_DEMO_PASSWORD` estiverem configurados no `.env.local`
2. **Login manual:** apague token e session hint (`saaso.session` no localStorage), recarregue — deve exibir formulário com tenant nome derivado do default
3. **Expiração de sessão:** no console do browser execute `window.dispatchEvent(new Event('saaso-auth-expired'))` — deve voltar para tela de login com mensagem "Sua sessão expirou. Faça login novamente."
4. **Logout:** use o botão de logout no header — deve voltar para tela de login

- [ ] **Step 3: Commit final**

```bash
git add -A
git commit -m "chore: verificação final do redesign de login"
```
