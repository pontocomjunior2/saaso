# Login Redesign — Spec

**Data:** 2026-04-11  
**Escopo:** `apps/web/src/components/layout/SessionProvider.tsx` (somente componentes visuais)  
**Abordagem:** Opção 1 — reescrever visual, manter lógica intacta

---

## Problema

- Tela de login com layout 2 colunas exibe comandos técnicos (`docker compose`, `npx prisma`) para qualquer usuário
- Campo "Tenant slug" exposto no formulário — UX estranha, campo desnecessário para o usuário final
- Textos hardcoded sem acentuação correta ("Nao", "sessao", "usuario")
- Prefixo `"Erro no Backend:"` vaza em mensagens de erro exibidas ao usuário
- `LoadingExperience` exibe tenant/e-mail do usuário de forma desnecessária

---

## Decisões de design

| Decisão | Escolha |
|---|---|
| Layout | Card flutuante centralizado (sem colunas) |
| Paleta | Violeta + Azul (`#8b5cf6` → `#3b82f6`) |
| Fundo | `#080614` com dois radial-gradients animados (violeta superior-esquerdo, azul inferior-direito) |
| Conteúdo acima do form | Logo (ícone `KeyRound`) + título "Entrar" |
| Campos visíveis | Apenas e-mail + senha |
| Tenant slug | Lido de `NEXT_PUBLIC_DEMO_TENANT_SLUG` (env), nunca exibido |

---

## Seção 1 — Estrutura da tela

**Fundo:**
- Cor base: `#080614`
- `radial-gradient` violeta em `top-left` (`rgba(139,92,246,0.22)`)
- `radial-gradient` azul em `bottom-right` (`rgba(59,130,246,0.18)`)
- Animação CSS `keyframes` de "respiração" sutil (escala + opacidade, ~8s loop)

**Card:**
- Largura máxima: `max-w-sm` (384px)
- `rounded-3xl`, `border border-violet-500/20`, `bg-[rgba(15,10,30,0.88)]`
- `backdrop-blur-2xl`, `shadow-[0_32px_100px_rgba(0,0,0,0.5)]`
- Centralizado via `flex items-center justify-center min-h-screen`
- Padding: `p-8`

**Dentro do card (ordem):**
1. Ícone logo: 42×42, `rounded-xl`, `bg-violet-500/10 border border-violet-500/20`, ícone `KeyRound` (`text-violet-300`)
2. Título: `text-2xl font-semibold text-white mt-4` — texto: "Entrar"
3. Subtítulo: `text-sm text-slate-400 mt-1` — nome do workspace derivado via `formatTenantName(initialValues.tenantSlug)` (função já disponível no arquivo)
4. Formulário (mt-8)
5. Erro (condicional)
6. Botão

---

## Seção 2 — Formulário e estados

**Campos:**
- Label: `text-sm font-medium text-slate-300 mb-2 block`
- Input: `w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-violet-400/60 focus:bg-white/[0.08]`
- Campos: `type="email"` (e-mail) e `type="password"` (senha)
- Tenant slug: removido do formulário; continua presente em `LoginInput` internamente, preenchido via `DEFAULT_SESSION.tenantSlug`

**Estados do botão:**
- Normal: `bg-[linear-gradient(135deg,#8b5cf6,#3b82f6)] text-white rounded-2xl px-4 py-3 text-sm font-semibold shadow-[0_14px_40px_rgba(139,92,246,0.3)] hover:translate-y-[-1px] transition`
- Submitting: `bg-violet-500/40 text-white cursor-wait` + spinner `LoaderCircle` + texto "Autenticando..."

**Erro:**
- Box mantida: `rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100`
- Textos filtrados pela função `sanitizeErrorMessage()` (remove `"Erro no Backend:"`)

**LoadingExperience:**
- Mesmo fundo e card
- Conteúdo: spinner `LoaderCircle` animado + texto "Conectando com o workspace..."
- Remove exibição de tenant/e-mail no texto

---

## Seção 3 — Mudanças técnicas

**Arquivo:** `apps/web/src/components/layout/SessionProvider.tsx`

**Componentes alterados:**
- `LoadingExperience` — reescrito
- `AuthExperience` — reescrito

**Lógica preservada (sem toque):**
- `AppSessionProvider` (todo o bloco)
- `login()`, `logout()`, `useEffect` de token e `saaso-auth-expired`
- `session-storage.ts`, `api.ts`
- `auth.service.ts`, `auth.controller.ts`

**Adições:**
```ts
function sanitizeErrorMessage(raw: string): string {
  return raw.replace(/^Erro no Backend:\s*/i, '').trim();
}
```

**Correções de texto:**
- "Nao foi possivel" → "Não foi possível"
- "sessao" → "sessão"
- "usuario" → "usuário"
- "Faça login novamente" → já correto, manter

---

## Fora de escopo

- Refresh token / JWT renewal
- Campo "Lembrar-me"
- Tela de cadastro (register)
- Qualquer mudança no backend
