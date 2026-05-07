# Gestão de Pautas — Design Doc

**Data:** 2026-05-06
**Status:** Approved (brainstorming)
**Autor:** GoCreators team + Claude

## Contexto

Hoje a gestão de pautas (briefings de UGC) acontece de forma fragmentada:

1. Time de creators escreve pautas em **Google Docs** (um por marca).
2. Apps Script (`File 3`) parseia o Docs e popula uma planilha **"Apice - Pautas"** no Google Sheets.
3. Time **manualmente** preenche colunas `Creator 1..N` + `Variante 1..N` no sheet.
4. Apps Script (`File 1`, `syncCreatorsAll`) gera 3 abas derivadas (Por Pauta / Por Semana / Por Mês), 1 linha por creator.
5. Apps Script (`File 2`, `fillEntregasELinksFromLog`) cruza com "Log Apice" para marcar `Entregou` + link Dropbox.
6. Abas derivadas alimentam o **Creators Hub** (banco Supabase próprio, separado).

Problemas:
- Cinco lugares pra fonte da verdade (Docs, sheet master, 3 abas derivadas, hub Supabase).
- Edição manual em sheet sujeita a erro humano.
- Hub e Gocreators têm bancos separados — duplicação de creators.

## Objetivo

Centralizar gestão de pautas no **Supabase da Gocreators**, abandonando o sheet como banco de dados intermediário e o Supabase isolado do Creators Hub.

**Out of scope deste projeto:** migração do Creators Hub para ler do Supabase Gocreators (será projeto separado, mas o schema desenhado aqui suporta).

## Restrição crítica

A estrutura atual da aplicação Gocreators **não pode ser impactada**. Tudo é puramente aditivo:

- ✅ `/dashboard/pautas` (analytics existente, métricas por `creatives.guideline_number`) continua funcionando idêntico.
- ✅ `components/pautas-table.tsx` não é tocado.
- ✅ Sidebar mantém entrada "Pautas" no grupo Dashboards intocada.
- ✅ Apps Scripts antigos (Files 1, 2, 3) seguem operando — usuário desliga manualmente quando confiar no novo fluxo.
- ✅ Nenhuma tabela existente alterada — só novas adicionadas.

## Nova arquitetura

```
Google Docs (1 por brand)
      │
      │  Apps Script "sync-briefings-gocreators" (menu manual)
      │  PropertiesService: BRAND_ID, INGEST_URL, INGEST_SECRET
      ▼
Edge Function: supabase/functions/ingest-briefing/
      │  Auth: header x-ingest-secret
      │  Upsert idempotente em briefings (brand_id, briefing_number)
      │  POST /api/revalidate { tags: ["briefings"] }
      ▼
Supabase Postgres
  ├── briefings                  (conteúdo editorial — origem Docs)
  ├── briefing_assignments       (alocação 1:N — creator + variante + status)
  └── briefing_with_status (view)(status agregado computado)
      ▲
      │  Server Actions + unstable_cache (tag: briefings)
      │
Next.js Dashboard
  ├── /dashboard/pautas        (existente, intocada)
  └── /dashboard/briefings     (NOVA — gestão)
```

## Decisões de design (resumo)

| # | Decisão | Escolha |
|---|---------|---------|
| 1 | Status (Pendente/Em Andamento/Concluído) | Por alocação, com agregado da pauta computado em view |
| 2 | Variante | Texto livre, opcional por alocação |
| 3 | Identificação da brand no Apps Script | `PropertiesService.getScriptProperties()` (BRAND_ID) |
| 4 | Idempotência | Upsert por `(brand_id, briefing_number)` — atualiza conteúdo |
| 5 | Endpoint de ingestão | Supabase Edge Function (match com convenção do projeto) |
| 6 | Backfill | Pautas ativas (Entregou=0 na aba Por Pauta), creator-resolution via Legenda Handles |
| 7 | Naming | Tabela `briefings` (inglês, alinhado com schema), rota `/dashboard/briefings`, UI label "Pautas" |
| 8 | Estrutura existente | Não tocada (puramente aditivo) |

## 1. Modelo de dados

### `supabase/schemas/20_briefings.sql`

```sql
create table if not exists "public"."briefings" (
  "id" bigint generated always as identity not null,
  "brand_id" bigint not null,
  "briefing_number" integer not null,        -- coluna D na planilha (ex: 1297)
  "semana" integer,                          -- A
  "mes" integer,                             -- B (1-12)
  "ano" integer,                             -- C
  "ref_url" text,                            -- F
  "take_inicial" text,                       -- E
  "fala_inicial" text,                       -- G
  "conceito" text,
  "produtos" text[] not null default '{}',   -- H (suporta múltiplos)
  "source" text not null default 'docs',     -- 'docs' | 'native' (futuro)
  "source_doc_id" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),

  constraint "briefings_pkey" primary key ("id"),
  constraint "briefings_brand_number_key" unique ("brand_id", "briefing_number"),
  constraint "briefings_brand_id_fkey" foreign key ("brand_id")
    references "public"."brands" ("id") on delete cascade,
  constraint "briefings_source_check" check (source in ('docs', 'native')),
  constraint "briefings_mes_check" check (mes is null or (mes between 1 and 12))
);

create index if not exists "briefings_brand_period_idx"
  on "public"."briefings" ("brand_id", "ano", "mes");
```

### `supabase/schemas/21_briefing_assignments.sql`

```sql
create table if not exists "public"."briefing_assignments" (
  "id" bigint generated always as identity not null,
  "briefing_id" bigint not null,
  "creator_id" bigint not null,
  "variante" text,
  "status" text not null default 'pendente',
  "delivered_url" text,
  "assigned_at" timestamptz not null default now(),
  "assigned_by" uuid,
  "updated_at" timestamptz not null default now(),
  "updated_by" uuid,

  constraint "briefing_assignments_pkey" primary key ("id"),
  constraint "briefing_assignments_briefing_creator_key" unique ("briefing_id", "creator_id"),
  constraint "briefing_assignments_briefing_id_fkey" foreign key ("briefing_id")
    references "public"."briefings" ("id") on delete cascade,
  constraint "briefing_assignments_creator_id_fkey" foreign key ("creator_id")
    references "public"."creators" ("id") on delete restrict,
  constraint "briefing_assignments_status_check"
    check (status in ('pendente', 'em_andamento', 'concluido', 'cancelado'))
);

create index if not exists "briefing_assignments_creator_status_idx"
  on "public"."briefing_assignments" ("creator_id", "status");
create index if not exists "briefing_assignments_status_idx"
  on "public"."briefing_assignments" ("status");
```

### `supabase/schemas/22_briefing_with_status.sql`

```sql
create or replace view "public"."briefing_with_status" as
select
  b.*,
  coalesce(stats.total, 0)             as assignment_count,
  coalesce(stats.pendente, 0)          as pending_count,
  coalesce(stats.em_andamento, 0)      as in_progress_count,
  coalesce(stats.concluido, 0)         as completed_count,
  coalesce(stats.cancelado, 0)         as cancelled_count,
  case
    when coalesce(stats.total, 0) = 0                          then 'nao_alocada'
    when stats.cancelado = stats.total                         then 'cancelada'
    when stats.concluido = stats.total                         then 'concluida'
    when stats.concluido > 0 and stats.concluido < stats.total then 'parcialmente_concluida'
    when stats.em_andamento > 0                                then 'em_andamento'
    else 'pendente'
  end as aggregate_status
from public.briefings b
left join lateral (
  select
    count(*) as total,
    count(*) filter (where status = 'pendente')      as pendente,
    count(*) filter (where status = 'em_andamento')  as em_andamento,
    count(*) filter (where status = 'concluido')     as concluido,
    count(*) filter (where status = 'cancelado')     as cancelado
  from public.briefing_assignments where briefing_id = b.id
) stats on true;
```

### `updated_at` — convenção do projeto

Tabelas existentes (`creator_costs`, `brand_goals`) usam `updated_at` mas **sem trigger SQL**. As Server Actions atualizam manualmente passando `updated_at: new Date().toISOString()` no UPSERT (ver `app/dashboard/creators/actions.ts`).

Mantemos esse padrão — Edge Function e Server Actions populam `updated_at` no payload. Sem triggers novos no DB.

## 2. Endpoint de ingestão (Edge Function)

### `supabase/functions/ingest-briefing/index.ts`

**Contrato:**

```
POST /functions/v1/ingest-briefing
Headers:
  x-ingest-secret: <env INGEST_BRIEFING_SECRET>
  Content-Type: application/json

Body:
{
  "brand_id": 7,
  "source_doc_id": "1bQ8rABZWcyvTKix...",
  "briefings": [
    {
      "briefing_number": 1297,
      "semana": 1,
      "mes": 5,
      "ano": 2026,
      "ref_url": "https://...",
      "take_inicial": "Tirando...",
      "fala_inicial": "Se seu cabelo fica assim...",
      "conceito": "...",
      "produtos": ["Livre"]
    }
  ]
}

Response 200:
{ "received": 25, "inserted": 18, "updated": 7, "errors": [] }

Response 400/401:
{ "error": "..." }
```

**Comportamento:**
- Validar secret via header. Mismatch → 401.
- Validar `brand_id` existe na tabela `brands`. Não existe → 400.
- Validar payload com Zod (deno-compatible) ou validação manual:
  - `briefing_number`: int >= 1, obrigatório
  - `mes`: int 1-12 ou null
  - Outros campos: string ou null
- **Batch upsert** com `onConflict: 'brand_id,briefing_number'`, retornar lista de IDs.
- Limite: 500 briefings por request (defensivo).
- Briefings inválidas → entram em `errors[]` com motivo, não falham o batch inteiro.
- Após upsert: POST pra `${NEXT_REVALIDATE_URL}/api/revalidate` com `{tags: ["briefings"]}`.
- **Não toca** em `briefing_assignments`.

**Secrets em `supabase/.env`:**
```
INGEST_BRIEFING_SECRET=<gerado>
NEXT_REVALIDATE_URL=https://<dominio-vercel>
REVALIDATE_SECRET=<já existe>
```

## 3. Novo Apps Script

### `sync-briefings-gocreators.gs`

Substitui apenas o **File 3**. Files 1 e 2 ficam obsoletos no novo fluxo (alocação e log de entrega passam a viver no Gocreators).

**Estrutura:**
```javascript
function onOpen() {
  DocumentApp.getUi()
    .createMenu('Gocreators')
    .addItem('Sincronizar Pautas', 'syncBriefingsToGocreators')
    .addToUi();
}

function syncBriefingsToGocreators() {
  const props = PropertiesService.getScriptProperties();
  const brandId = parseInt(props.getProperty('BRAND_ID'), 10);
  const ingestUrl = props.getProperty('INGEST_URL');
  const ingestSecret = props.getProperty('INGEST_SECRET');

  if (!brandId || !ingestUrl || !ingestSecret) {
    DocumentApp.getUi().alert('Config faltando: BRAND_ID, INGEST_URL ou INGEST_SECRET nos Script Properties.');
    return;
  }

  const docId = DocumentApp.getActiveDocument().getId();
  const briefings = extractBriefingsFromDoc_(docId);

  if (briefings.length === 0) {
    DocumentApp.getUi().alert('Nenhuma pauta encontrada no Docs.');
    return;
  }

  const response = UrlFetchApp.fetch(ingestUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-ingest-secret': ingestSecret },
    payload: JSON.stringify({ brand_id: brandId, source_doc_id: docId, briefings: briefings }),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  const body = JSON.parse(response.getContentText() || '{}');

  if (status !== 200) {
    DocumentApp.getUi().alert(`Falha (${status}): ${body.error || response.getContentText()}`);
    return;
  }

  DocumentApp.getUi().alert(
    `Sincronização concluída.\n\n` +
    `Recebidas: ${body.received}\n` +
    `Novas: ${body.inserted}\n` +
    `Atualizadas: ${body.updated}\n` +
    `Erros: ${body.errors.length}`
  );
}

function extractBriefingsFromDoc_(docId) {
  // Reaproveita a lógica de parsing do File 3 existente:
  // - Itera por seções "PAUTA N"
  // - Extrai Take inicial, Fala inicial, Conceito, Referência(s), Produtos
  // - Extrai Semana, Mês, Ano de "Nomeie o video com..."
  // Retorna array de objetos com schema do payload da Edge Function.
  // Implementação literal a ser portada do File 3 que o usuário forneceu.
}
```

**Gap conhecido:** o File 3 compartilhado durante o brainstorming foi truncado por limite de mensagem (cortou em `const DOC_ID = '1bQ8rABZWcyvTKix...`). Antes de iniciar a implementação do Apps Script, o usuário precisa fornecer o arquivo completo (ou colar o restante) — toda a função `extractBriefingsFromDoc_` depende dessa lógica de parsing já validada em produção.

**Configuração (Apps Script UI: Project Settings > Script properties):**
- `BRAND_ID` = id numérico da brand (ex: `7`)
- `INGEST_URL` = `https://<project>.supabase.co/functions/v1/ingest-briefing`
- `INGEST_SECRET` = mesmo valor do `INGEST_BRIEFING_SECRET` da Edge Function

**Trigger automático:** fora do MVP. Usuário roda manualmente via menu por enquanto.

## 4. Dashboard UI

### Página `/dashboard/briefings`

Layout:

```
┌────────────────────────────────────────────────────────────┐
│ Gestão de Pautas                                            │
│                                                              │
│ [Brand: Apice ▾] [Status: ▾] [Mês: 5/2026 ▾] [🔎 buscar]    │
│                                                              │
│ ┌──────┬────────────┬─────────┬───────┬─────────┬─────────┐│
│ │ Nº   │ Roteiro    │ Produto │ Sem/Mês│ Status │ Alocados││
│ ├──────┼────────────┼─────────┼───────┼─────────┼─────────┤│
│ │ 1297 │ Tirando... │ Livre   │ 1/5   │ Parcial │ 3/4     ││
│ │ 1298 │ Colocando..│ Livre   │ 1/5   │ Pendente│ 0       ││
│ └──────┴────────────┴─────────┴───────┴─────────┴─────────┘│
└────────────────────────────────────────────────────────────┘
```

Linha clicável → drawer lateral (`shadcn Sheet`) com:
- Conteúdo completo (take, fala, conceito, ref clicável)
- Lista de alocações: creator + variante + status select + delivered_url input
- Botão "Adicionar Creator" (combobox com creators da brand)

### Filtros (URL search params)

- `?brand=<id>` (obrigatório, default: primeira brand)
- `?status=` (default oculta `concluida` e `cancelada`)
- `?mes=<1-12>&ano=<YYYY>` (default: mês atual)
- `?q=<texto>` (busca em `briefing_number`, `take_inicial`, `fala_inicial`)

### Componentes novos

```
components/
├── briefing-management-table.tsx    # tabela principal
├── briefing-detail-sheet.tsx        # drawer lateral
├── briefing-allocation-form.tsx     # multi-select creators + variantes
├── briefing-assignment-row.tsx      # linha de alocação editável
└── briefing-status-badge.tsx        # badge colorido
```

### Sidebar (`components/app-sidebar.tsx`)

Adicionar entrada **NOVA** no grupo "Gestão" (não toca em nada existente):

```typescript
{ title: "Pautas (Gestão)", href: "/dashboard/briefings", icon: ScrollText },
```

Posicionar antes de "Sincronização".

## 5. Server Actions e queries

### `app/dashboard/briefings/actions.ts`

```typescript
// Listas (cached via unstable_cache, tag: briefings)
getBriefings(brandId, filters)       → BriefingWithStatus[]
getBriefingDetail(briefingId)        → Briefing + assignments[] (com creator name)
getAllocatableCreators(brandId)      → CreatorOption[] (de creator_brands desta brand)

// Mutations (revalidateTag('briefings') + revalidatePath)
assignCreatorsToBriefing({ briefingId, creators: [{ creatorId, variante? }] })
updateAssignmentStatus({ assignmentId, status, deliveredUrl? })
removeAssignment({ assignmentId })
```

### `lib/schemas/briefing.ts` (Zod)

```typescript
export const STATUSES = ['pendente', 'em_andamento', 'concluido', 'cancelado'] as const;

export const assignCreatorsSchema = z.object({
  briefingId: z.number().int().positive(),
  creators: z.array(z.object({
    creatorId: z.number().int().positive(),
    variante: z.string().max(200).optional().nullable(),
  })).min(1, 'Selecione ao menos um creator'),
});

export const updateAssignmentStatusSchema = z.object({
  assignmentId: z.number().int().positive(),
  status: z.enum(STATUSES),
  deliveredUrl: z.string().url().optional().nullable(),
}).refine(
  (data) => data.status !== 'concluido' || (data.deliveredUrl && data.deliveredUrl.length > 0),
  { message: 'URL da entrega é obrigatória ao marcar como Concluído', path: ['deliveredUrl'] }
);
```

### Regras de negócio

- `assignCreatorsToBriefing`: upsert `(briefing_id, creator_id)` — re-alocar mesmo creator não duplica.
- `updateAssignmentStatus`: status `concluido` exige `delivered_url` não nulo (validado via Zod refine).
- `removeAssignment`: só permite se status ∈ {pendente, cancelado}. Em outros, exige cancelar antes (preserva auditoria).
- Toda mutation grava `assigned_by`/`updated_by` com `auth.getUser().id`.

## 6. Cache e revalidação

### `lib/cache-tags.ts`

Adicionar:
```typescript
export const CACHE_TAGS = {
  // ...existentes
  BRIEFINGS: "briefings",
} as const;
```

### Pontos de invalidação

| Evento | Quem invalida | Como |
|--------|---------------|------|
| Edge Function ingest-briefing upsert | Edge Function | POST `/api/revalidate` `{tags:["briefings"]}` |
| Server action `assignCreatorsToBriefing` | Next.js | `revalidateTag('briefings')` + `revalidatePath('/dashboard/briefings')` |
| Server action `updateAssignmentStatus` | Next.js | idem |
| Server action `removeAssignment` | Next.js | idem |
| Backfill script | Node | POST `/api/revalidate` no fim |

## 7. Backfill de pautas ativas

### `scripts/backfill-briefings.ts`

Script Node executado **uma vez por brand**, depois do sistema novo estar live.

**Input:** 3 CSVs exportados manualmente do Sheets de cada brand:
- `apice-pautas.csv` — aba "Apice - Pautas"
- `apice-por-pauta.csv` — aba "Apice - Creators - Por Pauta"
- `legenda-handles.csv` — aba "Legenda Creators - Handles"

**Lógica:**
1. Carrega `legenda-handles.csv` → `Map<handle/nome → nome canônico>`
2. Carrega tabela `creators` do Supabase → `Map<full_name normalizado → creator_id>`
3. Lê `apice-pautas.csv` → coleciona briefings por `Pauta` (número)
4. Lê `apice-por-pauta.csv` → filtra rows com `Entregou = 0` (ativas, escolha 8a-iii)
5. Pra cada row ativa: resolve creator string → `creator_id` via legenda + creators
6. Se não resolver → escreve em `unmatched.csv` (não falha; usuário corrige)
7. Insere via service role:
   - UPSERT `briefings` (mesma lógica do Edge Function — onConflict)
   - INSERT `briefing_assignments` com `status='pendente'`
8. POST `/api/revalidate` `{tags:["briefings"]}`
9. Output: report com counts (`X briefings inseridos`, `Y assignments criados`, `Z unmatched`)

**Execução:**
```bash
npx tsx scripts/backfill-briefings.ts \
  --brand=7 \
  --input-dir=./backfill/apice/
```

**Idempotência:** rodar duas vezes não duplica (UPSERT em briefings; INSERT ON CONFLICT DO NOTHING em assignments por `(briefing_id, creator_id)`).

## 8. Auth e permissões

Padrão atual do projeto: qualquer user logado tem acesso total. Mantemos.

- Middleware existente em `middleware.ts` já protege `/dashboard/*` — `/dashboard/briefings` herda automaticamente.
- Server actions usam `createClient()` de `@/lib/supabase/server` (com cookies, sessão validada).
- Edge Function usa secret estático (não session).

## 9. Garantias finais (não-impacto)

Antes de mergear, validar:

- [ ] `npm run dev` + acessar `/dashboard/pautas` → analytics renderiza igual
- [ ] `npm run build` passa sem warning novo
- [ ] `npm run lint` passa
- [ ] `supabase db diff` gera somente `CREATE TABLE briefings`, `CREATE TABLE briefing_assignments`, `CREATE VIEW briefing_with_status` — nenhum `ALTER` em tabela existente, nenhum trigger novo
- [ ] Sidebar renderiza com 2 itens "Pautas" diferenciados (existente "Pautas" em Dashboards + nova "Pautas (Gestão)" em Gestão)
- [ ] Apps Scripts antigos no Sheets continuam funcionando (não testado pelo nosso lado, mas não foram tocados)

## 10. Workflow de execução

Ao iniciar implementação:

1. Criar branch nova a partir de `main`: `feat/briefings-management`
2. Seguir plano gerado pelo `writing-plans` skill
3. Local-first:
   - Editar `supabase/schemas/`
   - `supabase db diff -f add_briefings_tables`
   - `supabase migration up`
4. Edge Function: `supabase functions serve --no-verify-jwt` localmente, testar com `curl`
5. UI: `npm run dev` + login com `teste@gocreators.com`
6. **Não fazer push para produção sem confirmação explícita do usuário** (regra do CLAUDE.md)
7. PR contra `main` com descrição clara do escopo aditivo

## 11. Future hooks (fora do escopo deste projeto)

- **Criação nativa de pautas** na Gocreators: Server Action `createBriefingNative()` → `INSERT briefings (..., source='native')` → mesma view de status, sem mudança de schema.
- **Trigger automático no Apps Script**: time-based `every 6 hours` sync.
- **Creators Hub lendo do Supabase Gocreators**: criar RPC `get_briefings_for_creator(p_creator_id)` que retorna assignments do creator + dados do briefing. Hub passa a chamar essa RPC, abandona seu Supabase isolado.
- **Histórico de mudanças de status**: tabela `briefing_assignment_events` (log de transições) — só se houver demanda real.
