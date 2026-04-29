# Visão de Produtos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair `product_name` do `ad_name` via regex no ETL, persistir na tabela `creatives`, e expor esse campo como coluna nas tabelas de Pautas e Tabela Mensal (Creators), e como filtro nos dashboards de Visão Mensal e Diária.

**Architecture:** Adicionar coluna `product_name text` em `creatives`; incluir `extractProductName()` no ETL ao lado do já existente `extractGuidelineNumber()`; atualizar duas RPCs de tabela para retornar a dimensão via `STRING_AGG(DISTINCT ...)`; adicionar parâmetro `p_product_names text[]` nas RPCs de gráfico; criar RPC auxiliar `get_distinct_products`; construir filtro de produto nas telas de Visão Mensal e Diária.

**Tech Stack:** PostgreSQL (Supabase), Deno (Edge Functions), Next.js 14 App Router, TypeScript, shadcn/ui Select, Tailwind CSS v4.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `supabase/schemas/06_creatives.sql` | Modificar | Adicionar coluna `product_name text` |
| `supabase/functions/sync-ad-metrics/handle-matcher.ts` | Modificar | Adicionar `extractProductName()` |
| `supabase/functions/sync-ad-metrics/handle-matcher_test.ts` | Criar | Testes unitários Deno para `extractProductName` |
| `supabase/functions/sync-ad-metrics/index.ts` | Modificar | Passar `product_name` no upsert de criativos |
| `supabase/schemas/18_get_guideline_metrics.sql` | Modificar | Adicionar `product_names` à RPC de pautas |
| `supabase/schemas/15_get_creator_metrics.sql` | Modificar | Adicionar `product_names` à RPC de creators |
| `supabase/schemas/19_get_distinct_products.sql` | Criar | Nova RPC retornando produtos distintos por brand |
| `supabase/schemas/11_get_monthly_spend_view.sql` | Modificar | Adicionar filtro `p_product_names` |
| `supabase/schemas/12_get_daily_spend_view.sql` | Modificar | Adicionar filtro `p_product_names` |
| `app/dashboard/pautas/actions.ts` | Modificar | Adicionar `product_names` ao tipo `GuidelineMetric` |
| `app/dashboard/creators/actions.ts` | Modificar | Adicionar `product_names` ao tipo `CreatorMetric` |
| `app/dashboard/monthly-view/actions.ts` | Modificar | Adicionar `productNames` param + exportar `getDistinctProducts` |
| `app/dashboard/daily-view/actions.ts` | Modificar | Adicionar `productNames` param + exportar `getDistinctProducts` |
| `lib/queries/products.ts` | Criar | `getDistinctProducts(brandId)` — query compartilhada |
| `components/pautas-table.tsx` | Modificar | Adicionar coluna Produto |
| `components/creators-table.tsx` | Modificar | Adicionar coluna Produto ao lado de Creator |
| `components/monthly-view-charts.tsx` | Modificar | Adicionar filtro de produto + state |
| `components/daily-view-charts.tsx` | Modificar | Adicionar filtro de produto + state |

---

## Task 1: Schema — Adicionar `product_name` à tabela `creatives`

**Files:**
- Modify: `supabase/schemas/06_creatives.sql`

- [ ] **Step 1: Atualizar `06_creatives.sql` adicionando `product_name` ao final**

Substituir o conteúdo completo do arquivo por:

```sql
create table if not exists "public"."creatives" (
  "id" bigint generated always as identity not null,
  "creator_brand_id" bigint not null,
  "ad_account_id" bigint not null,
  "meta_ad_id" text not null,
  "created_time" timestamptz not null,
  "ad_name" text,
  "guideline_number" integer,
  "created_at" timestamptz not null default now(),
  "product_name" text,

  constraint "creatives_pkey" primary key ("id"),
  constraint "creatives_meta_ad_id_key" unique ("meta_ad_id"),
  constraint "creatives_creator_brand_id_fkey" foreign key ("creator_brand_id") references "public"."creator_brands" ("id") on delete cascade,
  constraint "creatives_ad_account_id_fkey" foreign key ("ad_account_id") references "public"."ad_accounts" ("id") on delete cascade
);
```

- [ ] **Step 2: Verificar que Supabase local está rodando**

```bash
supabase status
```
Expected: exibe `API URL` e `DB URL` com status running. Se não, rodar `supabase start`.

- [ ] **Step 3: Gerar a migration**

```bash
supabase db diff -f add_product_name_to_creatives
```
Expected: cria `supabase/migrations/[timestamp]_add_product_name_to_creatives.sql` com conteúdo:
```sql
ALTER TABLE "public"."creatives" ADD COLUMN "product_name" text;
```

- [ ] **Step 4: Aplicar migration localmente**

```bash
supabase migration up
```
Expected: `Applying migration [timestamp]_add_product_name_to_creatives.sql...` sem erros.

- [ ] **Step 5: Commit**

```bash
git add supabase/schemas/06_creatives.sql supabase/migrations/
git commit -m "feat: add product_name column to creatives table"
```

---

## Task 2: ETL — Extrair e sincronizar `product_name`

**Files:**
- Modify: `supabase/functions/sync-ad-metrics/handle-matcher.ts`
- Create: `supabase/functions/sync-ad-metrics/handle-matcher_test.ts`
- Modify: `supabase/functions/sync-ad-metrics/index.ts`

- [ ] **Step 1: Escrever o teste com falha esperada**

Criar `supabase/functions/sync-ad-metrics/handle-matcher_test.ts`:

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extractProductName, extractGuidelineNumber } from "./handle-matcher.ts";

Deno.test("extractProductName: extrai nome do produto do ad_name completo", () => {
  const adName =
    "@keycemachado - semana 3 - mes 04 - ano 2026 - com headline overlay - pauta 1245 - produto Linha PH - creator";
  assertEquals(extractProductName(adName), "Linha PH");
});

Deno.test("extractProductName: lida com variações de espaçamento antes do hífen", () => {
  assertEquals(extractProductName("produto Linha Detox - creator"), "Linha Detox");
});

Deno.test("extractProductName: captura produto ao final da string sem hífen", () => {
  assertEquals(extractProductName("- produto Linha PH"), "Linha PH");
});

Deno.test("extractProductName: retorna null quando 'produto' não está presente", () => {
  assertEquals(extractProductName("@creator - pauta 100 - sem info"), null);
});

Deno.test("extractProductName: case insensitive", () => {
  assertEquals(extractProductName("PRODUTO Linha PH - creator"), "Linha PH");
});

Deno.test("extractGuidelineNumber: ainda funciona corretamente após a mudança", () => {
  assertEquals(
    extractGuidelineNumber("pauta 1245 - produto Linha PH"),
    1245,
  );
});
```

- [ ] **Step 2: Rodar os testes e confirmar falha**

```bash
deno test supabase/functions/sync-ad-metrics/handle-matcher_test.ts
```
Expected: erro `SyntaxError` ou `TypeError` porque `extractProductName` ainda não existe no módulo.

- [ ] **Step 3: Implementar `extractProductName` em `handle-matcher.ts`**

Substituir o conteúdo completo de `supabase/functions/sync-ad-metrics/handle-matcher.ts` por:

```typescript
import type { CreatorBrand } from "./types.ts";

export function matchCreatorBrand(
  adName: string,
  creatorBrands: CreatorBrand[],
): number | null {
  const lower = adName.toLowerCase();
  for (const cb of creatorBrands) {
    for (const handle of cb.handles) {
      if (lower.includes(handle.toLowerCase())) {
        return cb.id;
      }
    }
  }
  return null;
}

export function extractGuidelineNumber(adName: string): number | null {
  const match = adName.match(/\bpauta\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export function extractProductName(adName: string): string | null {
  const match = adName.match(/produto\s+([^-]+?)\s*(?:-|$)/i);
  return match ? match[1].trim() : null;
}
```

- [ ] **Step 4: Rodar os testes e confirmar aprovação**

```bash
deno test supabase/functions/sync-ad-metrics/handle-matcher_test.ts
```
Expected:
```
running 6 tests from ./handle-matcher_test.ts
extractProductName: extrai nome do produto do ad_name completo ... ok
extractProductName: lida com variações de espaçamento antes do hífen ... ok
extractProductName: captura produto ao final da string sem hífen ... ok
extractProductName: retorna null quando 'produto' não está presente ... ok
extractProductName: case insensitive ... ok
extractGuidelineNumber: ainda funciona corretamente após a mudança ... ok
ok | 6 passed | 0 failed
```

- [ ] **Step 5: Atualizar `index.ts` para incluir `product_name` no upsert**

No topo de `supabase/functions/sync-ad-metrics/index.ts`, atualizar o import (linha 3):

```typescript
import { matchCreatorBrand, extractGuidelineNumber, extractProductName } from "./handle-matcher.ts";
```

Na função `processAdAccount`, localizar o bloco `creativesToUpsert` (ao redor da linha 269) e atualizar para:

```typescript
const creativesToUpsert = Array.from(uniqueCreatives.entries()).map(
  ([metaAdId, { creatorBrandId, createdTime, adName }]) => ({
    creator_brand_id: creatorBrandId,
    ad_account_id: account.id,
    meta_ad_id: metaAdId,
    created_time: createdTime,
    ad_name: adName,
    guideline_number: extractGuidelineNumber(adName),
    product_name: extractProductName(adName),
  }),
);
```

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/sync-ad-metrics/handle-matcher.ts \
        supabase/functions/sync-ad-metrics/handle-matcher_test.ts \
        supabase/functions/sync-ad-metrics/index.ts
git commit -m "feat: extract product_name from ad_name in ETL sync"
```

---

## Task 3: Dashboard de Pautas — Adicionar coluna Produto

**Files:**
- Modify: `supabase/schemas/18_get_guideline_metrics.sql`
- Modify: `app/dashboard/pautas/actions.ts`
- Modify: `components/pautas-table.tsx`

- [ ] **Step 1: Atualizar `18_get_guideline_metrics.sql` para retornar `product_names`**

Substituir o conteúdo completo do arquivo por:

```sql
CREATE OR REPLACE FUNCTION get_guideline_metrics(p_brand_id bigint, p_month text DEFAULT NULL)
RETURNS TABLE (
  guideline_number integer,
  spend numeric,
  revenue numeric,
  roas numeric,
  ctr numeric,
  creator_count bigint,
  ad_count bigint,
  prev_roas numeric,
  prev_month text,
  product_names text
)
LANGUAGE sql STABLE
AS $$
  WITH monthly_roas AS (
    SELECT
      cr.guideline_number,
      to_char(am.date, 'YYYY-MM') AS month,
      CASE WHEN SUM(am.spend) > 0
        THEN ROUND(SUM(am.revenue) / SUM(am.spend), 2) ELSE 0
      END AS roas
    FROM ad_metrics am
    JOIN creatives cr ON cr.id = am.creative_id
    JOIN creator_brands cb ON cb.id = cr.creator_brand_id
    WHERE cb.brand_id = p_brand_id
      AND cr.guideline_number IS NOT NULL
    GROUP BY cr.guideline_number, to_char(am.date, 'YYYY-MM')
  ),
  prev_data AS (
    SELECT DISTINCT ON (mr.guideline_number)
      mr.guideline_number,
      mr.roas AS prev_roas,
      mr.month AS prev_month
    FROM monthly_roas mr
    WHERE p_month IS NOT NULL
      AND mr.month < p_month
    ORDER BY mr.guideline_number, mr.month DESC
  )
  SELECT
    cr.guideline_number,
    SUM(am.spend) AS spend,
    SUM(am.revenue) AS revenue,
    CASE WHEN SUM(am.spend) > 0
      THEN ROUND(SUM(am.revenue) / SUM(am.spend), 2) ELSE 0
    END AS roas,
    CASE WHEN SUM(am.impressions) > 0
      THEN ROUND(SUM(am.link_clicks)::numeric / SUM(am.impressions) * 100, 2) ELSE 0
    END AS ctr,
    COUNT(DISTINCT cb.creator_id) AS creator_count,
    COUNT(DISTINCT cr.meta_ad_id) AS ad_count,
    pd.prev_roas,
    pd.prev_month,
    STRING_AGG(DISTINCT cr.product_name, ', ') AS product_names
  FROM ad_metrics am
  JOIN creatives cr ON cr.id = am.creative_id
  JOIN creator_brands cb ON cb.id = cr.creator_brand_id
  LEFT JOIN prev_data pd ON pd.guideline_number = cr.guideline_number
  WHERE cb.brand_id = p_brand_id
    AND cr.guideline_number IS NOT NULL
    AND (p_month IS NULL OR to_char(am.date, 'YYYY-MM') = p_month)
  GROUP BY cr.guideline_number, pd.prev_roas, pd.prev_month
  ORDER BY roas DESC;
$$;

CREATE OR REPLACE FUNCTION get_guideline_available_months(p_brand_id bigint)
RETURNS TABLE (month text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT to_char(am.date, 'YYYY-MM') AS month
  FROM ad_metrics am
  JOIN creatives cr ON cr.id = am.creative_id
  JOIN creator_brands cb ON cb.id = cr.creator_brand_id
  WHERE cb.brand_id = p_brand_id
    AND cr.guideline_number IS NOT NULL
  ORDER BY month DESC;
$$;
```

- [ ] **Step 2: Gerar e aplicar migration**

```bash
supabase db diff -f update_guideline_metrics_product_names
supabase migration up
```
Expected: migration criada com `CREATE OR REPLACE FUNCTION get_guideline_metrics(...)` incluindo `product_names text` no RETURNS TABLE; aplicada sem erros.

- [ ] **Step 3: Atualizar tipo `GuidelineMetric` em `app/dashboard/pautas/actions.ts`**

Substituir a definição do tipo (mantendo as funções intactas):

```typescript
export type GuidelineMetric = {
  guideline_number: number;
  spend: number;
  revenue: number;
  roas: number;
  ctr: number;
  creator_count: number;
  ad_count: number;
  prev_roas: number | null;
  prev_month: string | null;
  product_names: string | null;
};
```

- [ ] **Step 4: Adicionar coluna Produto em `components/pautas-table.tsx`**

Atualizar o tipo `SortKey` para adicionar suporte a colunas não ordenáveis. Substituir a definição de `columns` (ao redor da linha 198):

```typescript
const columns: { key: SortKey; label: string; align?: string; sortable?: boolean }[] = [
  { key: "guideline_number", label: "Pauta" },
  { key: "spend", label: "Gasto", align: "text-right" },
  { key: "revenue", label: "Revenue", align: "text-right" },
  { key: "roas", label: "ROAS", align: "text-right" },
  { key: "ctr", label: "CTR", align: "text-right" },
  { key: "ad_count", label: "Anúncios", align: "text-center" },
  { key: "creator_count", label: "Creators", align: "text-center" },
  { key: "product_names", label: "Produto", sortable: false },
  { key: "trend", label: "Tendência", align: "text-right" },
];
```

Adicionar o case `product_names` em `formatCell` (ao redor da linha 209):

```typescript
function formatCell(row: GuidelineMetric, key: SortKey) {
  switch (key) {
    case "guideline_number":
      return `#${row.guideline_number}`;
    case "spend":
      return formatCurrency(row.spend);
    case "revenue":
      return formatCurrency(row.revenue);
    case "roas":
      return formatRoas(row.roas);
    case "ctr":
      return formatCtr(row.ctr);
    case "ad_count":
      return String(row.ad_count);
    case "creator_count":
      return String(row.creator_count);
    case "product_names":
      return row.product_names ?? "Não informado";
    case "trend":
      return null;
    default:
      return "";
  }
}
```

Atualizar o `TableHead` no JSX para colunas não ordenáveis (ao redor da linha 340):

```tsx
{columns.map((col) => (
  <TableHead
    key={col.key}
    className={`${col.sortable === false ? "" : "cursor-pointer"} select-none whitespace-nowrap ${col.align ?? ""}`}
    onClick={() => { if (col.sortable !== false) handleSort(col.key); }}
  >
    {col.label}
    {col.sortable !== false && <SortIcon column={col.key} />}
  </TableHead>
))}
```

- [ ] **Step 5: Verificar localmente**

```bash
npm run dev
```
Navegar para `http://localhost:3000/dashboard/pautas`. Selecionar uma marca. Confirmar:
- Coluna "Produto" aparece entre "Creators" e "Tendência"
- Linhas com dados mostram nome(s) do produto; sem dados mostram "Não informado"
- As demais colunas e ordenação seguem funcionando

- [ ] **Step 6: Commit**

```bash
git add supabase/schemas/18_get_guideline_metrics.sql \
        supabase/migrations/ \
        app/dashboard/pautas/actions.ts \
        components/pautas-table.tsx
git commit -m "feat: add product_names column to pautas dashboard"
```

---

## Task 4: Tabela Mensal (Creators) — Adicionar coluna Produto

**Files:**
- Modify: `supabase/schemas/15_get_creator_metrics.sql`
- Modify: `app/dashboard/creators/actions.ts`
- Modify: `components/creators-table.tsx`

- [ ] **Step 1: Atualizar `15_get_creator_metrics.sql` para retornar `product_names`**

Substituir o conteúdo completo do arquivo por:

```sql
CREATE OR REPLACE FUNCTION get_creator_metrics(p_brand_id bigint)
RETURNS TABLE (
  creator text,
  creator_brand_id bigint,
  month timestamptz,
  spend_total numeric,
  roas_total numeric,
  ctr_total numeric,
  spend_recentes numeric,
  roas_recentes numeric,
  ctr_recentes numeric,
  cost numeric,
  yearly_spend numeric,
  product_names text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    c.full_name AS creator,
    cb.id AS creator_brand_id,
    date_trunc('month', am.date) AS month,
    SUM(am.spend) AS spend_total,
    CASE WHEN SUM(am.spend) > 0
      THEN ROUND(SUM(am.revenue) / SUM(am.spend), 2) ELSE 0
    END AS roas_total,
    CASE WHEN SUM(am.impressions) > 0
      THEN ROUND(SUM(am.link_clicks)::numeric / SUM(am.impressions) * 100, 2) ELSE 0
    END AS ctr_total,
    SUM(am.spend) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
      AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month') AS spend_recentes,
    CASE WHEN SUM(am.spend) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
      AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month') > 0
      THEN ROUND(
        SUM(am.revenue) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month')
        / SUM(am.spend) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month'), 2)
      ELSE 0
    END AS roas_recentes,
    CASE WHEN SUM(am.impressions) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
      AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month') > 0
      THEN ROUND(
        (SUM(am.link_clicks) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month'))::numeric
        / SUM(am.impressions) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month') * 100, 2)
      ELSE 0
    END AS ctr_recentes,
    cc.cost AS cost,
    SUM(SUM(am.spend)) OVER (
      PARTITION BY cb.id, EXTRACT(YEAR FROM date_trunc('month', am.date))
      ORDER BY date_trunc('month', am.date)
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS yearly_spend,
    STRING_AGG(DISTINCT cr.product_name, ', ') AS product_names
  FROM ad_metrics am
  JOIN creatives cr ON cr.id = am.creative_id
  JOIN creator_brands cb ON cb.id = cr.creator_brand_id
  JOIN creators c ON c.id = cb.creator_id
  LEFT JOIN creator_costs cc
    ON cc.creator_brand_id = cb.id
    AND cc.month = date_trunc('month', am.date)::date
  WHERE cb.brand_id = p_brand_id
  GROUP BY c.full_name, cb.id, date_trunc('month', am.date), cc.cost
  ORDER BY c.full_name, month DESC;
$$;
```

- [ ] **Step 2: Gerar e aplicar migration**

```bash
supabase db diff -f update_creator_metrics_product_names
supabase migration up
```
Expected: migration criada com `CREATE OR REPLACE FUNCTION get_creator_metrics(...)` com `product_names text` no RETURNS TABLE; aplicada sem erros.

- [ ] **Step 3: Atualizar tipo `CreatorMetric` em `app/dashboard/creators/actions.ts`**

Substituir a definição do tipo `CreatorMetric`:

```typescript
export type CreatorMetric = {
  creator: string;
  creator_brand_id: number;
  month: string;
  group_id: number | null;
  spend_total: number;
  roas_total: number;
  ctr_total: number;
  spend_recentes: number;
  roas_recentes: number;
  ctr_recentes: number;
  cost: number | null;
  yearly_spend: number;
  product_names: string | null;
};
```

- [ ] **Step 4: Adicionar coluna Produto em `components/creators-table.tsx`**

Atualizar a definição de `columns` (ao redor da linha 151) para inserir Produto imediatamente após Creator:

```typescript
const columns: { key: SortKey; label: string; sortable?: boolean }[] = [
  { key: "month", label: "Mês/Ano" },
  { key: "creator", label: "Creator" },
  { key: "product_names", label: "Produto", sortable: false },
  { key: "cost", label: "Custo" },
  { key: "yearly_spend", label: "Investimento Ano" },
  { key: "spend_total", label: "Gasto" },
  { key: "roas_total", label: "ROAS" },
  { key: "ctr_total", label: "CTR" },
  { key: "spend_recentes", label: "Gasto Recentes" },
  { key: "roas_recentes", label: "ROAS Recentes" },
  { key: "ctr_recentes", label: "CTR Recentes" },
];
```

Atualizar `formatCell` para tratar o novo campo (ao redor da linha 164):

```typescript
function formatCell(row: CreatorMetric, key: SortKey) {
  switch (key) {
    case "month":
      return formatMonth(row.month);
    case "creator":
      return row.creator;
    case "product_names":
      return row.product_names ?? "Não informado";
    case "spend_total":
    case "spend_recentes":
    case "yearly_spend":
      return formatCurrency(row[key] as number);
    case "roas_total":
    case "roas_recentes":
      return formatRoas(row[key] as number);
    case "ctr_total":
    case "ctr_recentes":
      return formatCtr(row[key] as number);
    default:
      return String(row[key] ?? "");
  }
}
```

Atualizar o `TableHead` no JSX para colunas não ordenáveis (ao redor da linha 255):

```tsx
{columns.map((col) => (
  <TableHead
    key={col.key}
    className={`${col.sortable === false ? "" : "cursor-pointer"} select-none whitespace-nowrap`}
    onClick={() => { if (col.sortable !== false) handleSort(col.key); }}
  >
    {col.label}
    {col.sortable !== false && <SortIcon column={col.key} />}
  </TableHead>
))}
```

- [ ] **Step 5: Verificar localmente**

Navegar para `http://localhost:3000/dashboard/creators`. Selecionar uma marca. Confirmar:
- Coluna "Produto" aparece imediatamente após "Creator"
- Dados de produto exibidos corretamente; "Não informado" para linhas sem produto
- Colunas custo, investimento, gasto e métricas continuam funcionando normalmente

- [ ] **Step 6: Commit**

```bash
git add supabase/schemas/15_get_creator_metrics.sql \
        supabase/migrations/ \
        app/dashboard/creators/actions.ts \
        components/creators-table.tsx
git commit -m "feat: add product_names column to creators monthly table"
```

---

## Task 5: Filtro de Produto nas Visões Mensal e Diária

**Files:**
- Create: `supabase/schemas/19_get_distinct_products.sql`
- Modify: `supabase/schemas/11_get_monthly_spend_view.sql`
- Modify: `supabase/schemas/12_get_daily_spend_view.sql`
- Create: `lib/queries/products.ts`
- Modify: `app/dashboard/monthly-view/actions.ts`
- Modify: `app/dashboard/daily-view/actions.ts`
- Modify: `components/monthly-view-charts.tsx`
- Modify: `components/daily-view-charts.tsx`

- [ ] **Step 1: Criar `19_get_distinct_products.sql`**

```sql
CREATE OR REPLACE FUNCTION get_distinct_products(p_brand_id bigint)
RETURNS TABLE (product_name text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT cr.product_name
  FROM creatives cr
  JOIN creator_brands cb ON cb.id = cr.creator_brand_id
  WHERE cb.brand_id = p_brand_id
    AND cr.product_name IS NOT NULL
  ORDER BY cr.product_name;
$$;
```

- [ ] **Step 2: Atualizar `11_get_monthly_spend_view.sql` para aceitar filtro de produto**

Substituir o conteúdo completo do arquivo por:

```sql
CREATE OR REPLACE FUNCTION get_monthly_spend_view(
  p_brand_id bigint,
  p_creator_ids bigint[] DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_product_names text[] DEFAULT NULL
)
RETURNS TABLE (
  month date,
  spend_total numeric,
  spend_recentes numeric,
  brand_total_spend numeric
)
LANGUAGE sql STABLE
AS $$
  WITH creator_spend AS (
    SELECT
      date_trunc('month', am.date)::date AS month,
      COALESCE(SUM(am.spend), 0) AS spend_total,
      COALESCE(SUM(am.spend) FILTER (
        WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month'
      ), 0) AS spend_recentes
    FROM ad_metrics am
    JOIN creatives cr ON cr.id = am.creative_id
    JOIN creator_brands cb ON cb.id = cr.creator_brand_id
    JOIN creators c ON c.id = cb.creator_id
    WHERE cb.brand_id = p_brand_id
      AND (p_creator_ids IS NULL OR c.id = ANY(p_creator_ids))
      AND (p_start_date IS NULL OR am.date >= p_start_date)
      AND (p_end_date IS NULL OR am.date <= p_end_date)
      AND (p_product_names IS NULL OR cr.product_name = ANY(p_product_names))
    GROUP BY date_trunc('month', am.date)::date
  ),
  brand_spend AS (
    SELECT
      date_trunc('month', ds.date)::date AS month,
      COALESCE(SUM(ds.spend), 0) AS brand_total_spend
    FROM ad_account_daily_spend ds
    JOIN ad_accounts aa ON aa.id = ds.ad_account_id
    WHERE aa.brand_id = p_brand_id
      AND (p_start_date IS NULL OR ds.date >= p_start_date)
      AND (p_end_date IS NULL OR ds.date <= p_end_date)
    GROUP BY date_trunc('month', ds.date)::date
  )
  SELECT
    COALESCE(cs.month, bs.month) AS month,
    COALESCE(cs.spend_total, 0) AS spend_total,
    COALESCE(cs.spend_recentes, 0) AS spend_recentes,
    COALESCE(bs.brand_total_spend, 0) AS brand_total_spend
  FROM creator_spend cs
  FULL OUTER JOIN brand_spend bs ON cs.month = bs.month
  ORDER BY month;
$$;
```

Nota: `brand_total_spend` não é filtrado por produto intencionalmente — representa o gasto total da marca (denominador do share%), garantindo que o share% reflita a participação do produto no total da marca.

- [ ] **Step 3: Atualizar `12_get_daily_spend_view.sql` para aceitar filtro de produto**

Substituir o conteúdo completo do arquivo por:

```sql
CREATE OR REPLACE FUNCTION get_daily_spend_view(
  p_brand_id bigint,
  p_creator_ids bigint[] DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_product_names text[] DEFAULT NULL
)
RETURNS TABLE (
  day date,
  spend_total numeric,
  spend_recentes numeric,
  brand_total_spend numeric
)
LANGUAGE sql STABLE
AS $$
  WITH creator_spend AS (
    SELECT
      am.date AS day,
      COALESCE(SUM(am.spend), 0) AS spend_total,
      COALESCE(SUM(am.spend) FILTER (
        WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month'
      ), 0) AS spend_recentes
    FROM ad_metrics am
    JOIN creatives cr ON cr.id = am.creative_id
    JOIN creator_brands cb ON cb.id = cr.creator_brand_id
    JOIN creators c ON c.id = cb.creator_id
    WHERE cb.brand_id = p_brand_id
      AND (p_creator_ids IS NULL OR c.id = ANY(p_creator_ids))
      AND (p_start_date IS NULL OR am.date >= p_start_date)
      AND (p_end_date IS NULL OR am.date <= p_end_date)
      AND (p_product_names IS NULL OR cr.product_name = ANY(p_product_names))
    GROUP BY am.date
  ),
  brand_spend AS (
    SELECT
      ds.date AS day,
      COALESCE(SUM(ds.spend), 0) AS brand_total_spend
    FROM ad_account_daily_spend ds
    JOIN ad_accounts aa ON aa.id = ds.ad_account_id
    WHERE aa.brand_id = p_brand_id
      AND (p_start_date IS NULL OR ds.date >= p_start_date)
      AND (p_end_date IS NULL OR ds.date <= p_end_date)
    GROUP BY ds.date
  )
  SELECT
    COALESCE(cs.day, bs.day) AS day,
    COALESCE(cs.spend_total, 0) AS spend_total,
    COALESCE(cs.spend_recentes, 0) AS spend_recentes,
    COALESCE(bs.brand_total_spend, 0) AS brand_total_spend
  FROM creator_spend cs
  FULL OUTER JOIN brand_spend bs ON cs.day = bs.day
  ORDER BY day;
$$;
```

- [ ] **Step 4: Gerar e aplicar migration**

```bash
supabase db diff -f add_product_filter_to_spend_views
supabase migration up
```
Expected: migration criada contendo `get_distinct_products`, `get_monthly_spend_view` e `get_daily_spend_view` atualizadas; aplicada sem erros.

- [ ] **Step 5: Criar `lib/queries/products.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

export async function getDistinctProducts(brandId: number): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_distinct_products", {
    p_brand_id: brandId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { product_name: string }) => row.product_name);
}
```

- [ ] **Step 6: Atualizar `app/dashboard/monthly-view/actions.ts`**

Substituir o conteúdo completo do arquivo por:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { spendViewFiltersSchema } from "@/lib/schemas/spend-view";
import { getCreatorsByBrand as _getCreatorsByBrand } from "@/lib/queries/creators";
import { getDistinctProducts as _getDistinctProducts } from "@/lib/queries/products";

export async function getCreatorsByBrand(brandId: number) {
  return _getCreatorsByBrand(brandId);
}

export type GroupOption = {
  id: number;
  name: string;
};

export async function getGroupsByBrand(brandId: number): Promise<GroupOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_groups")
    .select("id, name")
    .eq("brand_id", brandId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCreatorsByBrandAndGroup(
  brandId: number,
  groupId: number | null,
): Promise<{ id: number; full_name: string }[]> {
  const supabase = await createClient();

  let query = supabase
    .from("creator_brands")
    .select("creators(id, full_name)")
    .eq("brand_id", brandId);

  if (groupId === 0) {
    query = query.is("group_id", null);
  } else if (groupId !== null) {
    query = query.eq("group_id", groupId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const creatorsMap = new Map<number, string>();
  for (const row of data ?? []) {
    const creator = row.creators as unknown as { id: number; full_name: string };
    if (creator && !creatorsMap.has(creator.id)) {
      creatorsMap.set(creator.id, creator.full_name);
    }
  }

  return Array.from(creatorsMap.entries()).map(([id, full_name]) => ({
    id,
    full_name,
  }));
}

export type MonthlySpendRow = {
  month: string;
  spend_total: number;
  spend_recentes: number;
  brand_total_spend: number;
};

export async function getMonthlySpendView(params: {
  brandId: number;
  creatorIds?: number[];
  startDate: string;
  endDate: string;
  productNames?: string[];
}): Promise<MonthlySpendRow[]> {
  const parsed = spendViewFiltersSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_monthly_spend_view", {
    p_brand_id: parsed.data.brandId,
    p_creator_ids: parsed.data.creatorIds ?? null,
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
    p_product_names: params.productNames && params.productNames.length > 0
      ? params.productNames
      : null,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getDistinctProducts(brandId: number): Promise<string[]> {
  return _getDistinctProducts(brandId);
}
```

- [ ] **Step 7: Atualizar `app/dashboard/daily-view/actions.ts`**

Substituir o conteúdo completo do arquivo por:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { spendViewFiltersSchema } from "@/lib/schemas/spend-view";
import { getCreatorsByBrand as _getCreatorsByBrand } from "@/lib/queries/creators";
import { getDistinctProducts as _getDistinctProducts } from "@/lib/queries/products";

export async function getCreatorsByBrand(brandId: number) {
  return _getCreatorsByBrand(brandId);
}

export type GroupOption = {
  id: number;
  name: string;
};

export async function getGroupsByBrand(brandId: number): Promise<GroupOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_groups")
    .select("id, name")
    .eq("brand_id", brandId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCreatorsByBrandAndGroup(
  brandId: number,
  groupId: number | null,
): Promise<{ id: number; full_name: string }[]> {
  const supabase = await createClient();

  let query = supabase
    .from("creator_brands")
    .select("creators(id, full_name)")
    .eq("brand_id", brandId);

  if (groupId === 0) {
    query = query.is("group_id", null);
  } else if (groupId !== null) {
    query = query.eq("group_id", groupId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const creatorsMap = new Map<number, string>();
  for (const row of data ?? []) {
    const creator = row.creators as unknown as { id: number; full_name: string };
    if (creator && !creatorsMap.has(creator.id)) {
      creatorsMap.set(creator.id, creator.full_name);
    }
  }

  return Array.from(creatorsMap.entries()).map(([id, full_name]) => ({
    id,
    full_name,
  }));
}

export type DailySpendRow = {
  day: string;
  spend_total: number;
  spend_recentes: number;
  brand_total_spend: number;
};

export async function getDailySpendView(params: {
  brandId: number;
  creatorIds?: number[];
  startDate: string;
  endDate: string;
  productNames?: string[];
}): Promise<DailySpendRow[]> {
  const parsed = spendViewFiltersSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_spend_view", {
    p_brand_id: parsed.data.brandId,
    p_creator_ids: parsed.data.creatorIds ?? null,
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
    p_product_names: params.productNames && params.productNames.length > 0
      ? params.productNames
      : null,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getDistinctProducts(brandId: number): Promise<string[]> {
  return _getDistinctProducts(brandId);
}
```

- [ ] **Step 8: Adicionar filtro de produto em `components/monthly-view-charts.tsx`**

Adicionar import de `getDistinctProducts`:

```typescript
import { getMonthlySpendView, getCreatorsByBrand, getGroupsByBrand, getCreatorsByBrandAndGroup, getDistinctProducts, type MonthlySpendRow, type GroupOption } from "@/app/dashboard/monthly-view/actions";
```

Adicionar estado `products`, `selectedProduct` e `selectedProductNames` após os estados existentes (após linha ~114):

```typescript
const [products, setProducts] = useState<string[]>([]);
const [selectedProduct, setSelectedProduct] = useState<string>("all");
```

Adicionar carregamento de produtos no `useEffect` e no `handleBrandChange`. No `useEffect` existente (linha ~117):

```typescript
useEffect(() => {
  if (selectedBrandId) {
    getGroupsByBrand(selectedBrandId).then(setGroups);
    getDistinctProducts(selectedBrandId).then(setProducts);
  } else {
    setGroups([]);
    setProducts([]);
  }
}, [selectedBrandId]);
```

Atualizar `fetchData` para incluir `productNames`:

```typescript
const fetchData = useCallback(
  (brandId: number, creatorIds: number[], range: { from: Date; to: Date }, product: string) => {
    startTransition(async () => {
      const allSelected = creatorIds.length === 0;
      const productNames = product === "all" ? undefined : [product];
      const [rows, brandGoals] = await Promise.all([
        getMonthlySpendView({
          brandId,
          creatorIds: allSelected ? undefined : creatorIds,
          startDate: format(range.from, "yyyy-MM-dd"),
          endDate: format(range.to, "yyyy-MM-dd"),
          productNames,
        }),
        getGoalsForBrand(
          brandId,
          format(range.from, "yyyy-MM-01"),
          format(range.to, "yyyy-MM-01"),
        ),
      ]);
      setData(rows);
      setGoals(brandGoals);
    });
  },
  [],
);
```

Adicionar handler `handleProductChange`:

```typescript
function handleProductChange(value: string) {
  setSelectedProduct(value);
  if (selectedBrandId) {
    fetchData(selectedBrandId, selectedCreatorIds, dateRange, value);
  }
}
```

Atualizar chamadas existentes de `fetchData` para incluir o produto selecionado. Na função `handleCreatorChange`:

```typescript
function handleCreatorChange(ids: number[]) {
  setSelectedCreatorIds(ids);
  if (selectedBrandId) {
    fetchData(selectedBrandId, ids, dateRange, selectedProduct);
  }
}
```

Na função `handleDateChange`:

```typescript
function handleDateChange(range: { from: Date; to: Date }) {
  setDateRange(range);
  if (selectedBrandId) {
    fetchData(selectedBrandId, selectedCreatorIds, range, selectedProduct);
  }
}
```

No `handleBrandChange`, após buscar os novos creators e fazer `setData` e `setGoals`, adicionar busca de produtos e reset do filtro:

```typescript
function handleBrandChange(value: string) {
  const brandId = Number(value);
  setSelectedBrandId(brandId);
  setSelectedGroupId("all");
  setSelectedProduct("all");
  router.push(`/dashboard/monthly-view?brand=${brandId}`);
  startTransition(async () => {
    const [newCreators, newProducts] = await Promise.all([
      getCreatorsByBrand(brandId),
      getDistinctProducts(brandId),
    ]);
    setCreators(newCreators);
    setProducts(newProducts);
    const allIds = newCreators.map((c) => c.id);
    setSelectedCreatorIds(allIds);
    const [rows, brandGoals] = await Promise.all([
      getMonthlySpendView({
        brandId,
        startDate: format(dateRange.from, "yyyy-MM-dd"),
        endDate: format(dateRange.to, "yyyy-MM-dd"),
      }),
      getGoalsForBrand(
        brandId,
        format(dateRange.from, "yyyy-MM-01"),
        format(dateRange.to, "yyyy-MM-01"),
      ),
    ]);
    setData(rows);
    setGoals(brandGoals);
  });
}
```

Adicionar o `Select` de produto no JSX, após o `CreatorMultiSelect` e antes do `DatePeriodSelector`:

```tsx
{products.length > 0 && (
  <Select value={selectedProduct} onValueChange={handleProductChange}>
    <SelectTrigger className="w-[200px]">
      <SelectValue placeholder="Todos os produtos" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos os produtos</SelectItem>
      {products.map((p) => (
        <SelectItem key={p} value={p}>
          {p}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)}
```

- [ ] **Step 9: Adicionar filtro de produto em `components/daily-view-charts.tsx`**

Aplicar o mesmo padrão do Step 8, trocando os imports para `daily-view/actions` e `getDailySpendView`. As mudanças de estado, handlers e JSX são idênticas — substituir referências a `getMonthlySpendView` por `getDailySpendView`, `MonthlySpendRow` por `DailySpendRow`, e o router.push para `/dashboard/daily-view`.

Adicionar import de `getDistinctProducts`:

```typescript
import { getDailySpendView, getCreatorsByBrand, getGroupsByBrand, getCreatorsByBrandAndGroup, getDistinctProducts, type DailySpendRow, type GroupOption } from "@/app/dashboard/daily-view/actions";
```

Adicionar os estados (após linha ~125):

```typescript
const [products, setProducts] = useState<string[]>([]);
const [selectedProduct, setSelectedProduct] = useState<string>("all");
```

Atualizar `useEffect` para carregar produtos:

```typescript
useEffect(() => {
  if (selectedBrandId) {
    getGroupsByBrand(selectedBrandId).then(setGroups);
    getDistinctProducts(selectedBrandId).then(setProducts);
  } else {
    setGroups([]);
    setProducts([]);
  }
}, [selectedBrandId]);
```

Atualizar `fetchData` assinatura e corpo:

```typescript
const fetchData = useCallback(
  (brandId: number, creatorIds: number[], range: { from: Date; to: Date }, product: string) => {
    startTransition(async () => {
      const allSelected = creatorIds.length === 0;
      const productNames = product === "all" ? undefined : [product];
      const [rows, brandGoals] = await Promise.all([
        getDailySpendView({
          brandId,
          creatorIds: allSelected ? undefined : creatorIds,
          startDate: format(range.from, "yyyy-MM-dd"),
          endDate: format(range.to, "yyyy-MM-dd"),
          productNames,
        }),
        getGoalsForBrand(
          brandId,
          format(range.from, "yyyy-MM-01"),
          format(range.to, "yyyy-MM-01"),
        ),
      ]);
      setData(rows);
      setGoals(brandGoals);
    });
  },
  [],
);
```

Adicionar `handleProductChange`:

```typescript
function handleProductChange(value: string) {
  setSelectedProduct(value);
  if (selectedBrandId) {
    fetchData(selectedBrandId, selectedCreatorIds, dateRange, value);
  }
}
```

Atualizar `handleCreatorChange` e `handleDateChange` para passar `selectedProduct`:

```typescript
function handleCreatorChange(ids: number[]) {
  setSelectedCreatorIds(ids);
  if (selectedBrandId) {
    fetchData(selectedBrandId, ids, dateRange, selectedProduct);
  }
}

function handleDateChange(range: { from: Date; to: Date }) {
  setDateRange(range);
  if (selectedBrandId) {
    fetchData(selectedBrandId, selectedCreatorIds, range, selectedProduct);
  }
}
```

Atualizar `handleBrandChange` para resetar produtos e filtro:

```typescript
function handleBrandChange(value: string) {
  const brandId = Number(value);
  setSelectedBrandId(brandId);
  setSelectedGroupId("all");
  setSelectedProduct("all");
  router.push(`/dashboard/daily-view?brand=${brandId}`);
  startTransition(async () => {
    const [newCreators, newProducts] = await Promise.all([
      getCreatorsByBrand(brandId),
      getDistinctProducts(brandId),
    ]);
    setCreators(newCreators);
    setProducts(newProducts);
    const allIds = newCreators.map((c) => c.id);
    setSelectedCreatorIds(allIds);
    const [rows, brandGoals] = await Promise.all([
      getDailySpendView({
        brandId,
        startDate: format(dateRange.from, "yyyy-MM-dd"),
        endDate: format(dateRange.to, "yyyy-MM-dd"),
      }),
      getGoalsForBrand(
        brandId,
        format(dateRange.from, "yyyy-MM-01"),
        format(dateRange.to, "yyyy-MM-01"),
      ),
    ]);
    setData(rows);
    setGoals(brandGoals);
  });
}
```

Adicionar o `Select` de produto no JSX, após `CreatorMultiSelect`:

```tsx
{products.length > 0 && (
  <Select value={selectedProduct} onValueChange={handleProductChange}>
    <SelectTrigger className="w-[200px]">
      <SelectValue placeholder="Todos os produtos" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Todos os produtos</SelectItem>
      {products.map((p) => (
        <SelectItem key={p} value={p}>
          {p}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)}
```

- [ ] **Step 10: Verificar localmente — Visão Mensal**

Navegar para `http://localhost:3000/dashboard/monthly-view`. Selecionar uma marca. Confirmar:
- Dropdown "Produto" aparece na barra de filtros (visível apenas quando há produtos cadastrados)
- Selecionar um produto re-renderiza os gráficos mostrando apenas dados daquele produto
- Voltar para "Todos os produtos" restaura a visão completa
- O share% reflete a participação do produto selecionado no gasto total da marca

- [ ] **Step 11: Verificar localmente — Visão Diária**

Navegar para `http://localhost:3000/dashboard/daily-view`. Repetir a validação do Step 10 para a visão diária.

- [ ] **Step 12: Rodar lint**

```bash
npm run lint
```
Expected: sem erros. Se houver warnings de tipo TypeScript, corrigir antes de commitar.

- [ ] **Step 13: Commit**

```bash
git add supabase/schemas/19_get_distinct_products.sql \
        supabase/schemas/11_get_monthly_spend_view.sql \
        supabase/schemas/12_get_daily_spend_view.sql \
        supabase/migrations/ \
        lib/queries/products.ts \
        app/dashboard/monthly-view/actions.ts \
        app/dashboard/daily-view/actions.ts \
        components/monthly-view-charts.tsx \
        components/daily-view-charts.tsx
git commit -m "feat: add product filter to monthly and daily chart views"
```

---

## Checklist de Revisão Spec vs. Plano

| Critério de aceitação | Task que implementa |
|-----------------------|---------------------|
| ETL lê `ad_name` e extrai `product_name` via Regex | Task 2 |
| Dados de produto persistidos em `creatives.product_name` | Task 1 + Task 2 |
| Dashboard de Pautas exibe coluna "Produto" | Task 3 |
| Dashboard Tabela Mensal exibe "Produto" ao lado de Creator | Task 4 |
| Visão Mensal tem filtro de Produto | Task 5 |
| Visão Diária tem filtro de Produto | Task 5 |
| Ao filtrar por produto, gasto/share refletem exclusivamente o produto | Task 5 (p_product_names no SQL) |
| Regex tolera variações de espaçamento | Task 2 (`extractProductName` com `\s+` e `\s*`) |
| Anúncios sem padrão → `null` / "Não informado" | Task 2 (retorna null) + Tasks 3/4 (display "Não informado") |

---

## Nota sobre dados históricos

Após o deploy em produção, os criativos existentes terão `product_name = NULL` até a próxima sincronização do ETL. Para popular retroativamente, executar um sync de backfill via:

```bash
supabase functions invoke sync-ad-metrics --body '{"trigger":"backfill"}'
```

Ou via interface de sync em `/dashboard/sync`.
