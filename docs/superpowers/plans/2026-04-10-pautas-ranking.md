# Pautas Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a "Pautas" screen that ranks content briefings by ad performance, with guideline number extraction in the ETL and aggregated metrics displayed in a sortable table.

**Architecture:** Add `guideline_number` column to `creatives`, extract it in the ETL via regex, create an RPC function for aggregated metrics by guideline, and build a new frontend page following the existing creators-table pattern.

**Tech Stack:** Next.js 14 (App Router), Supabase (PostgreSQL + Edge Functions/Deno), shadcn/ui, Tailwind CSS v4, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-10-pautas-ranking-design.md`

---

## File Structure

### Modified files
- `supabase/schemas/06_creatives.sql` — add `guideline_number` column
- `supabase/functions/sync-ad-metrics/handle-matcher.ts` — add `extractGuidelineNumber()` function
- `supabase/functions/sync-ad-metrics/index.ts` — include `guideline_number` in creatives upsert
- `components/app-sidebar.tsx` — add "Pautas" nav item to Dashboards group

### New files
- `supabase/schemas/18_get_guideline_metrics.sql` — RPC function for aggregated guideline metrics
- `app/dashboard/pautas/actions.ts` — server actions (getGuidelineMetrics, getAvailableMonths)
- `app/dashboard/pautas/page.tsx` — server page component
- `app/dashboard/pautas/loading.tsx` — loading skeleton
- `components/pautas-table.tsx` — client table component with filters and sorting

---

### Task 1: Schema — Add `guideline_number` to `creatives`

**Files:**
- Modify: `supabase/schemas/06_creatives.sql`

- [ ] **Step 1: Add `guideline_number` column to the declarative schema**

In `supabase/schemas/06_creatives.sql`, add the column before the constraints block:

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

  constraint "creatives_pkey" primary key ("id"),
  constraint "creatives_meta_ad_id_key" unique ("meta_ad_id"),
  constraint "creatives_creator_brand_id_fkey" foreign key ("creator_brand_id") references "public"."creator_brands" ("id") on delete cascade,
  constraint "creatives_ad_account_id_fkey" foreign key ("ad_account_id") references "public"."ad_accounts" ("id") on delete cascade
);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schemas/06_creatives.sql
git commit -m "feat(schema): add guideline_number column to creatives table"
```

---

### Task 2: ETL — Extract guideline number from ad name

**Files:**
- Modify: `supabase/functions/sync-ad-metrics/handle-matcher.ts`
- Modify: `supabase/functions/sync-ad-metrics/index.ts`

- [ ] **Step 1: Add `extractGuidelineNumber` function to `handle-matcher.ts`**

Append after the existing `matchCreatorBrand` function:

```typescript
export function extractGuidelineNumber(adName: string): number | null {
  const match = adName.match(/- pauta (\d+) -/i);
  return match ? parseInt(match[1], 10) : null;
}
```

- [ ] **Step 2: Import and use `extractGuidelineNumber` in `index.ts`**

In `supabase/functions/sync-ad-metrics/index.ts`, update the import at line 3:

```typescript
import { matchCreatorBrand, extractGuidelineNumber } from "./handle-matcher.ts";
```

Then in the `processAdAccount` function, update the creatives upsert construction (around line 269-277). Change from:

```typescript
  const creativesToUpsert = Array.from(uniqueCreatives.entries()).map(
    ([metaAdId, { creatorBrandId, createdTime, adName }]) => ({
      creator_brand_id: creatorBrandId,
      ad_account_id: account.id,
      meta_ad_id: metaAdId,
      created_time: createdTime,
      ad_name: adName,
    }),
  );
```

To:

```typescript
  const creativesToUpsert = Array.from(uniqueCreatives.entries()).map(
    ([metaAdId, { creatorBrandId, createdTime, adName }]) => ({
      creator_brand_id: creatorBrandId,
      ad_account_id: account.id,
      meta_ad_id: metaAdId,
      created_time: createdTime,
      ad_name: adName,
      guideline_number: extractGuidelineNumber(adName),
    }),
  );
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/sync-ad-metrics/handle-matcher.ts supabase/functions/sync-ad-metrics/index.ts
git commit -m "feat(etl): extract guideline_number from ad name during sync"
```

---

### Task 3: RPC — Create `get_guideline_metrics` function

**Files:**
- Create: `supabase/schemas/18_get_guideline_metrics.sql`

- [ ] **Step 1: Write the RPC function**

Create `supabase/schemas/18_get_guideline_metrics.sql`:

```sql
CREATE OR REPLACE FUNCTION get_guideline_metrics(p_brand_id bigint, p_month text DEFAULT NULL)
RETURNS TABLE (
  guideline_number integer,
  spend numeric,
  roas numeric,
  ctr numeric,
  creator_count bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    cr.guideline_number,
    SUM(am.spend) AS spend,
    CASE WHEN SUM(am.spend) > 0
      THEN ROUND(SUM(am.revenue) / SUM(am.spend), 2) ELSE 0
    END AS roas,
    CASE WHEN SUM(am.impressions) > 0
      THEN ROUND(SUM(am.link_clicks)::numeric / SUM(am.impressions) * 100, 2) ELSE 0
    END AS ctr,
    COUNT(DISTINCT cb.creator_id) AS creator_count
  FROM ad_metrics am
  JOIN creatives cr ON cr.id = am.creative_id
  JOIN creator_brands cb ON cb.id = cr.creator_brand_id
  WHERE cb.brand_id = p_brand_id
    AND cr.guideline_number IS NOT NULL
    AND (p_month IS NULL OR to_char(am.date, 'YYYY-MM') = p_month)
  GROUP BY cr.guideline_number
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

- [ ] **Step 2: Commit**

```bash
git add supabase/schemas/18_get_guideline_metrics.sql
git commit -m "feat(schema): add get_guideline_metrics RPC function"
```

---

### Task 4: Server Actions — `getGuidelineMetrics` and `getAvailableMonths`

**Files:**
- Create: `app/dashboard/pautas/actions.ts`

- [ ] **Step 1: Create the server actions file**

Create `app/dashboard/pautas/actions.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getBrands as _getBrands } from "@/lib/queries/brands";

export async function getBrands() {
  return _getBrands();
}

export type GuidelineMetric = {
  guideline_number: number;
  spend: number;
  roas: number;
  ctr: number;
  creator_count: number;
};

export async function getGuidelineMetrics(
  brandId: number,
  month?: string,
): Promise<GuidelineMetric[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_guideline_metrics", {
    p_brand_id: brandId,
    p_month: month ?? null,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAvailableMonths(brandId: number): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_guideline_available_months", {
    p_brand_id: brandId,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { month: string }) => row.month);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/pautas/actions.ts
git commit -m "feat(pautas): add server actions for guideline metrics"
```

---

### Task 5: Frontend — Pautas table component

**Files:**
- Create: `components/pautas-table.tsx`

- [ ] **Step 1: Create the pautas table component**

Create `components/pautas-table.tsx`:

```typescript
"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getGuidelineMetrics,
  getAvailableMonths,
  type GuidelineMetric,
} from "@/app/dashboard/pautas/actions";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type Brand = { id: number; name: string };
type SortKey = keyof GuidelineMetric;
type SortDir = "asc" | "desc";

function formatCurrency(value: number | null) {
  if (value == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatRoas(value: number | null) {
  if (value == null) return "0.00x";
  return `${Number(value).toFixed(2)}x`;
}

function formatCtr(value: number | null) {
  if (value == null) return "0.00%";
  return `${Number(value).toFixed(2)}%`;
}

function roasColor(value: number | null) {
  if (value == null) return "";
  if (value >= 2) return "text-green-500";
  if (value >= 1) return "text-yellow-500";
  return "text-red-500";
}

function formatMonthLabel(ym: string) {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export function PautasTable({
  brands,
  initialBrandId,
  initialData,
  initialMonths,
}: {
  brands: Brand[];
  initialBrandId: number | null;
  initialData: GuidelineMetric[];
  initialMonths: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [metrics, setMetrics] = useState(initialData);
  const [availableMonths, setAvailableMonths] = useState(initialMonths);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>("roas");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const selectedBrandId = searchParams.get("brand")
    ? Number(searchParams.get("brand"))
    : initialBrandId;

  function handleBrandChange(value: string) {
    router.push(`/dashboard/pautas?brand=${value}`);
    setSelectedMonth("all");
    startTransition(async () => {
      const brandId = Number(value);
      const [data, months] = await Promise.all([
        getGuidelineMetrics(brandId),
        getAvailableMonths(brandId),
      ]);
      setMetrics(data);
      setAvailableMonths(months);
    });
  }

  function handleMonthChange(value: string) {
    setSelectedMonth(value);
    if (!selectedBrandId) return;
    startTransition(async () => {
      const month = value === "all" ? undefined : value;
      const data = await getGuidelineMetrics(selectedBrandId, month);
      setMetrics(data);
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "guideline_number" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    return [...metrics].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [metrics, sortKey, sortDir]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "guideline_number", label: "Pauta" },
    { key: "spend", label: "Gasto" },
    { key: "roas", label: "ROAS" },
    { key: "ctr", label: "CTR" },
    { key: "creator_count", label: "Creators" },
  ];

  function formatCell(row: GuidelineMetric, key: SortKey) {
    switch (key) {
      case "guideline_number":
        return `#${row.guideline_number}`;
      case "spend":
        return formatCurrency(row.spend);
      case "roas":
        return formatRoas(row.roas);
      case "ctr":
        return formatCtr(row.ctr);
      case "creator_count":
        return String(row.creator_count);
      default:
        return String(row[key] ?? "");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column)
      return <ArrowUpDown className="ml-1 h-3 w-3 inline" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-muted-foreground">
          Marca:
        </label>
        <Select
          value={selectedBrandId?.toString() ?? ""}
          onValueChange={handleBrandChange}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Selecione uma marca" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id.toString()}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="text-sm font-medium text-muted-foreground">
          Mês:
        </label>
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os meses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {brands.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma marca cadastrada.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className="cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortIcon column={col.key} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nenhuma pauta encontrada para esta marca.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row) => (
                  <TableRow key={row.guideline_number}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`whitespace-nowrap ${col.key === "roas" ? roasColor(row.roas) : ""}`}
                      >
                        {formatCell(row, col.key)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/pautas-table.tsx
git commit -m "feat(pautas): add pautas table component with filters and sorting"
```

---

### Task 6: Frontend — Pautas page and loading skeleton

**Files:**
- Create: `app/dashboard/pautas/page.tsx`
- Create: `app/dashboard/pautas/loading.tsx`

- [ ] **Step 1: Create the page component**

Create `app/dashboard/pautas/page.tsx`:

```typescript
import { getBrands, getGuidelineMetrics, getAvailableMonths } from "./actions";
import { PautasTable } from "@/components/pautas-table";

export default async function PautasPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const brands = await getBrands();
  const params = await searchParams;
  const selectedBrandId = params.brand
    ? Number(params.brand)
    : brands[0]?.id ?? null;

  const [metrics, months] = selectedBrandId
    ? await Promise.all([
        getGuidelineMetrics(selectedBrandId),
        getAvailableMonths(selectedBrandId),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Pautas</h1>
      </div>
      <PautasTable
        brands={brands}
        initialBrandId={selectedBrandId}
        initialData={metrics}
        initialMonths={months}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the loading skeleton**

Create `app/dashboard/pautas/loading.tsx`:

```typescript
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/skeleton-table";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-[240px]" />
        <Skeleton className="h-10 w-[180px]" />
      </div>
      <SkeletonTable rows={5} cols={5} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/pautas/page.tsx app/dashboard/pautas/loading.tsx
git commit -m "feat(pautas): add pautas page and loading skeleton"
```

---

### Task 7: Navigation — Add "Pautas" to sidebar

**Files:**
- Modify: `components/app-sidebar.tsx`

- [ ] **Step 1: Add the Pautas nav item**

In `components/app-sidebar.tsx`, update the import to include `ClipboardList`:

```typescript
import { LayoutDashboard, TableProperties, BarChart3, CalendarDays, UserPlus, Building2, History, DollarSign, ClipboardList } from "lucide-react";
```

Then add the "Pautas" item to the Dashboards section, after the "Visão Diária" entry:

```typescript
      {
        title: "Pautas",
        href: "/dashboard/pautas",
        icon: ClipboardList,
      },
```

The full Dashboards items array becomes:

```typescript
    items: [
      {
        title: "Visão Geral",
        href: "/dashboard/overview",
        icon: LayoutDashboard,
      },
      {
        title: "Tabela Mensal",
        href: "/dashboard/creators",
        icon: TableProperties,
      },
      {
        title: "Visão Mensal",
        href: "/dashboard/monthly-view",
        icon: BarChart3,
      },
      {
        title: "Visão Diária",
        href: "/dashboard/daily-view",
        icon: CalendarDays,
      },
      {
        title: "Pautas",
        href: "/dashboard/pautas",
        icon: ClipboardList,
      },
    ],
```

- [ ] **Step 2: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "feat(nav): add Pautas link to sidebar dashboards section"
```

---

### Task 8: Build verification

- [ ] **Step 1: Run the build to verify no TypeScript or compilation errors**

Run: `npm run build`

Expected: Build succeeds with no errors. The new page should be listed in the build output under `/dashboard/pautas`.

- [ ] **Step 2: If build fails, fix any issues and commit the fixes**

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: No lint errors.

- [ ] **Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: resolve build/lint issues for pautas feature"
```
