# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

Plataforma interna para gestores de tráfego e acompanhadores de creators monitorarem a performance de criativos UGC vinculados a múltiplas marcas/contas de anúncio no Meta Ads. Dados originados de um banco existente de Facebook Ads consultado via Metabase API.

## Stack

- **Framework:** Next.js 14 com App Router (template `with-supabase`)
- **UI:** Tailwind CSS + shadcn/ui
- **Gráficos:** Recharts
- **Backend:** Next.js Server Actions (sem API Routes custom — Edge Functions só para ETL)
- **Auth:** Supabase Auth — perfil único, sem diferenciação de papéis (todos os usuários autenticados têm acesso total)
- **Banco:** Supabase (PostgreSQL) — sem Row Level Security por perfil
- **ETL:** Job agendado que consulta Metabase API e alimenta o Supabase

## Comandos

```bash
# Setup inicial
npx create-next-app -e with-supabase

# Dev
npm run dev

# Build
npm run build

# Lint
npm run lint

# Servir Edge Functions localmente (sem verificação de JWT)
supabase functions serve --no-verify-jwt
```

## Variáveis de ambiente

Arquivos de ambiente **não versionados** necessários para rodar o projeto:

- `.env.local` — variáveis do Next.js (Supabase URL, anon key, Metabase, etc.)
- `supabase/.env` — secrets das Edge Functions (service role key, Metabase credentials, etc.)

**Worktrees:** ao trabalhar em worktrees isoladas, copiar esses arquivos do worktree principal antes de rodar o projeto:

```bash
cp /path/to/main/.env.local /path/to/worktree/.env.local
cp /path/to/main/supabase/.env /path/to/worktree/supabase/.env
```

## Arquitetura

### Camadas

1. **Frontend** — Next.js App Router, componentes shadcn/ui, tabelas ordenáveis e filtros por marca
2. **Backend/BFF** — Server Actions com lógica de negócio desacoplada da apresentação
3. **Dados** — Supabase PostgreSQL, Storage (criativos), Edge Functions
4. **ETL** — Pipeline idempotente Metabase API → Supabase, com log de sincronização e alertas

### Modelo de dados

Entidades principais: `creators`, `brands`, `ad_accounts`, `creator_brands`, `creatives`, `ad_metrics`, `users`.

- `creator_brands.handles` (text[]) — array de @handles usados pelo creator naquela marca; o ETL faz match case-insensitive entre nome do anúncio e handles
- `creatives.created_time` — data de criação no Meta, **nunca sobrescrever** em re-sincronizações
- `ad_metrics` armazena valores brutos (`spend`, `revenue`, `link_clicks`, `impressions`) para recálculo de métricas derivadas (ROAS = revenue/spend, CTR = link_clicks/impressions)

### Visão "total" vs "recentes"

Cada métrica tem dois recortes: **total** (acumulado) e **recentes** (anúncios criados no mês atual ou anterior, baseado em `created_time`).

## Regras de negócio importantes

- ETL deve ser **idempotente** — re-execuções não duplicam dados
- Match de anúncios por handle: case-insensitive, tolerante a variações de formatação
- Sem score ou ranking automático no MVP
- Sem listagem de criativos individuais na tela do creator no MVP

## Supabase — Declarative Schemas

Gerenciamento do banco usa **declarative schemas** — nunca criar migration files manualmente.

### Fluxo

1. Declarar o estado desejado em arquivos `.sql` dentro de `supabase/schemas/`
2. Gerar migration automaticamente: `supabase db diff -f <nome>`
3. Aplicar localmente: `supabase migration up`
4. Deploy em produção: `supabase db push`

### Estrutura

```
supabase/
├── schemas/        # Estado declarado (editamos aqui)
│   ├── 01_creators.sql
│   ├── 02_brands.sql
│   ├── 03_ad_accounts.sql
│   ├── 04_creator_brands.sql
│   ├── 05_creatives.sql
│   ├── 06_ad_metrics.sql
│   ├── 07_get_creator_metrics.sql   # SQL Functions/RPC
│   ├── 08_sync_logs.sql
│   ├── 09_ad_account_daily_spend.sql
│   └── 10_cron_schedule.sql
└── migrations/     # Gerado automaticamente — não editar manualmente
```

Prefixos numéricos (`01_`, `02_`, ...) definem a ordem de execução. Ao adicionar novos schemas, usar o próximo número da sequência.

### Limitações do diff

Não rastreados pelo `supabase db diff`: DML (INSERT/UPDATE/DELETE), RLS policies, comments, materialized views, partitions. Como o projeto não usa RLS por perfil, isso não impacta o MVP.

### Regras

- Sempre adicionar novas colunas ao final das tabelas para evitar diffs confusos
- Nunca resetar uma versão já deployada em produção — reverter via novo schema + novo diff
- Configurar ordem de execução em `config.toml` via `[db.migrations] schema_paths` quando houver dependências entre tabelas

## Padrões de código

### Supabase Client: Server vs Client

Existem dois clients distintos — usar o errado causa falhas de auth:

- **Server** (Server Components, Server Actions, Middleware): `import { createClient } from "@/lib/supabase/server"` — async, usa cookies
- **Client** (componentes `"use client"`): `import { createClient } from "@/lib/supabase/client"` — sync, sem cookies

**Sempre criar nova instância** dentro de cada função (nunca usar variável global — incompatível com Fluid Compute do Supabase).

### Server Actions

Server actions ficam colocadas com suas páginas em `app/[route]/actions.ts`. Padrão:

1. Validar input com `safeParse()` de schema Zod (de `lib/schemas/`)
2. Retornar `{ success: true, [data?] } | { success: false; error: string }`
3. Chamar `revalidatePath()` após mutações para atualizar a UI

### Validação (Zod)

Schemas vivem em `lib/schemas/` e exportam schema + type derivado:

```typescript
export const createBrandSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;
```

Mensagens de erro são em **português** (user-facing).

### Client Components: useTransition + Toast

Componentes client que chamam server actions usam `useTransition()` para loading state e `toast` (sonner) para feedback:

```typescript
const [isPending, startTransition] = useTransition();

function handleSubmit(values: Input) {
  startTransition(async () => {
    const result = await myServerAction(values);
    if (result.success) { toast.success("Sucesso!"); setOpen(false); }
    else { toast.error(result.error); }
  });
}
```

### Middleware & Auth

Middleware em `middleware.ts` → `lib/supabase/middleware.ts` protege `/dashboard/*`:
- Usa `supabase.auth.getUser()` para verificar sessão
- Redireciona para `/auth/login` se não autenticado
- Rotas públicas: `/`, `/auth/*`

Novas rotas protegidas sob `/dashboard/` são automaticamente cobertas.

### Edge Functions (Deno)

Edge Functions em `supabase/functions/[nome]/index.ts`:
- Runtime Deno, imports via ESM CDN (`https://esm.sh/`)
- Secrets via `Deno.env.get()` (configurados em `supabase/.env`, não em `.env.local`)
- Usa `SUPABASE_SERVICE_ROLE_KEY` para operações privilegiadas (upserts)
- Invocação: `supabase.functions.invoke("sync-ad-metrics", { body: { trigger: "manual" } })`

### RPC Functions (Stored Procedures)

SQL functions definidas em `supabase/schemas/` (ex: `07_get_creator_metrics.sql`) são chamadas via `supabase.rpc()`:

```typescript
const { data } = await supabase.rpc("get_creator_metrics", { p_brand_id: brandId });
```

Parâmetros SQL usam prefixo `p_`.

## Teste local

Usuário de teste para login via Chrome DevTools MCP ou testes manuais:

- **URL:** `http://localhost:3000/auth/login`
- **Email:** `teste@gocreators.com`
- **Senha:** `teste123456`

Criado via Supabase Auth API no ambiente local. Não usar INSERT direto em `auth.users` — sempre usar a API (`/auth/v1/signup`) para que `auth.identities` seja populado corretamente.

## Linguagem

O código e commits devem ser em **inglês**. A documentação do projeto e comunicação são em **português (BR)**.
