# Pautas Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Revenue, Ad Count, and ROAS Trend columns to the existing Pautas ranking table.

**Architecture:** Expand the `get_guideline_metrics` RPC to return new aggregations (revenue, ad_count) and trend data (prev_roas, prev_month) using CTEs. Update the TypeScript type, table component, and mock data accordingly. No new files — only modifications to 4 existing files.

**Tech Stack:** PostgreSQL (Supabase RPC), Next.js 14, TypeScript, shadcn/ui, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-14-pautas-enhancements-design.md`

**IMPORTANT:** Do NOT modify the remote/production database. Only edit local schema files.

---

## File Structure

### Modified files
- `supabase/schemas/18_get_guideline_metrics.sql` — expand RPC with revenue, ad_count, prev_roas, prev_month
- `app/dashboard/pautas/actions.ts` — update GuidelineMetric type with new fields
- `components/pautas-table.tsx` — add Revenue, Anúncios, Tendência columns + trend rendering
- `app/dashboard/pautas/page.tsx` — update mock data with new fields

---

### Task 1: RPC — Add revenue, ad_count, and trend data

**Files:**
- Modify: `supabase/schemas/18_get_guideline_metrics.sql`

- [ ] **Step 1: Replace `get_guideline_metrics` function with expanded version**

Replace the entire `get_guideline_metrics` function in `supabase/schemas/18_get_guideline_metrics.sql` (lines 1-29) with:

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
  prev_month text
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
    pd.prev_month
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
```

The `get_guideline_available_months` function (lines 31-42) stays unchanged.

- [ ] **Step 2: Commit**

```bash
git add supabase/schemas/18_get_guideline_metrics.sql
git commit -m "feat(pautas): add revenue, ad_count, and trend data to guideline metrics RPC"
```

---

### Task 2: Server Actions — Update GuidelineMetric type

**Files:**
- Modify: `app/dashboard/pautas/actions.ts`

- [ ] **Step 1: Update the GuidelineMetric type**

In `app/dashboard/pautas/actions.ts`, replace the type definition (lines 10-16) from:

```typescript
export type GuidelineMetric = {
  guideline_number: number;
  spend: number;
  roas: number;
  ctr: number;
  creator_count: number;
};
```

To:

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
};
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/pautas/actions.ts
git commit -m "feat(pautas): add revenue, ad_count, trend fields to GuidelineMetric type"
```

---

### Task 3: Frontend — Add new columns and trend indicator

**Files:**
- Modify: `components/pautas-table.tsx`

- [ ] **Step 1: Update the SortKey type and add trend helpers**

The current `SortKey` is `keyof GuidelineMetric`. Since `prev_roas` and `prev_month` are not columns we display directly, and we need a custom "trend" sort key, change the type and add helper functions.

Replace the type definitions and helpers section (lines 28-61) with:

```typescript
type Brand = { id: number; name: string };
type SortKey = keyof GuidelineMetric | "trend";
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

function formatMonthShort(ym: string) {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

function trendVariation(roas: number, prevRoas: number | null): number | null {
  if (prevRoas == null) return null;
  if (prevRoas === 0) return roas > 0 ? Infinity : 0;
  return Math.round(((roas - prevRoas) / prevRoas) * 100);
}

function formatTrend(row: GuidelineMetric): { text: string; color: string } {
  const variation = trendVariation(row.roas, row.prev_roas);
  if (variation == null) return { text: "—", color: "text-muted-foreground" };
  if (variation === Infinity) return { text: `↑ novo vs ${formatMonthShort(row.prev_month!)}`, color: "text-green-500" };

  const monthRef = formatMonthShort(row.prev_month!);
  if (variation > 0) return { text: `↑ ${variation}% vs ${monthRef}`, color: "text-green-500" };
  if (variation < 0) return { text: `↓ ${Math.abs(variation)}% vs ${monthRef}`, color: "text-red-500" };
  return { text: `→ 0% vs ${monthRef}`, color: "text-muted-foreground" };
}
```

- [ ] **Step 2: Update the columns array**

Replace the columns definition (lines 141-147) with:

```typescript
  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: "guideline_number", label: "Pauta" },
    { key: "spend", label: "Gasto", align: "text-right" },
    { key: "revenue", label: "Revenue", align: "text-right" },
    { key: "roas", label: "ROAS", align: "text-right" },
    { key: "ctr", label: "CTR", align: "text-right" },
    { key: "ad_count", label: "Anúncios", align: "text-center" },
    { key: "creator_count", label: "Creators", align: "text-center" },
    { key: "trend", label: "Tendência", align: "text-right" },
  ];
```

- [ ] **Step 3: Update the formatCell function**

Replace the `formatCell` function (lines 149-164) with:

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
      case "trend":
        return null; // handled separately in JSX
      default:
        return "";
    }
  }
```

- [ ] **Step 4: Update the sort logic to handle the "trend" key**

Replace the `sorted` useMemo (lines 129-139) with:

```typescript
  const sorted = useMemo(() => {
    return [...metrics].sort((a, b) => {
      if (sortKey === "trend") {
        const aVar = trendVariation(a.roas, a.prev_roas);
        const bVar = trendVariation(b.roas, b.prev_roas);
        if (aVar == null && bVar == null) return 0;
        if (aVar == null) return 1;
        if (bVar == null) return -1;
        const cmp = aVar < bVar ? -1 : aVar > bVar ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      }
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [metrics, sortKey, sortDir]);
```

- [ ] **Step 5: Update the table cell rendering for trend column**

Replace the data row rendering (lines 258-269) with:

```typescript
                sorted.map((row) => (
                  <TableRow key={row.guideline_number}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`whitespace-nowrap ${col.align ?? ""} ${col.key === "roas" ? roasColor(row.roas) : ""}`}
                      >
                        {col.key === "trend" ? (
                          <span className={formatTrend(row).color}>
                            {formatTrend(row).text}
                          </span>
                        ) : (
                          formatCell(row, col.key)
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
```

- [ ] **Step 6: Commit**

```bash
git add components/pautas-table.tsx
git commit -m "feat(pautas): add revenue, ad count, and trend columns to table"
```

---

### Task 4: Mock Data — Update for local preview

**Files:**
- Modify: `app/dashboard/pautas/page.tsx`

- [ ] **Step 1: Update mock data with new fields**

In `app/dashboard/pautas/page.tsx`, replace the mock data block (lines 26-36) with:

```typescript
      metrics = [
        { guideline_number: 1311, spend: 4230.5, revenue: 14468.31, roas: 3.42, ctr: 2.18, creator_count: 5, ad_count: 12, prev_roas: 2.85, prev_month: "2026-02" },
        { guideline_number: 1298, spend: 8120.0, revenue: 23304.4, roas: 2.87, ctr: 1.94, creator_count: 8, ad_count: 21, prev_roas: 3.1, prev_month: "2026-02" },
        { guideline_number: 1305, spend: 2650.8, revenue: 4029.22, roas: 1.52, ctr: 1.65, creator_count: 3, ad_count: 6, prev_roas: 1.2, prev_month: "2026-02" },
        { guideline_number: 1320, spend: 5410.3, revenue: 11632.15, roas: 2.15, ctr: 2.05, creator_count: 6, ad_count: 15, prev_roas: 2.15, prev_month: "2026-02" },
        { guideline_number: 1290, spend: 6980.2, revenue: 5933.17, roas: 0.85, ctr: 0.92, creator_count: 4, ad_count: 9, prev_roas: 1.4, prev_month: "2026-01" },
        { guideline_number: 1275, spend: 1440.3, revenue: 907.39, roas: 0.63, ctr: 0.78, creator_count: 2, ad_count: 3, prev_roas: 0.9, prev_month: "2026-01" },
        { guideline_number: 1330, spend: 3200.0, revenue: 13120.0, roas: 4.1, ctr: 3.12, creator_count: 7, ad_count: 18, prev_roas: null, prev_month: null },
        { guideline_number: 1315, spend: 950.6, revenue: 950.6, roas: 1.0, ctr: 1.2, creator_count: 1, ad_count: 2, prev_roas: 0, prev_month: "2026-02" },
      ];
```

This mock data covers all trend scenarios:
- `#1311`: ROAS up (3.42 vs 2.85 in feb) → green `↑ 20% vs fev`
- `#1298`: ROAS down (2.87 vs 3.1 in feb) → red `↓ 7% vs fev`
- `#1305`: ROAS up (1.52 vs 1.2 in feb) → green `↑ 27% vs fev`
- `#1320`: No change (2.15 vs 2.15 in feb) → neutral `→ 0% vs fev`
- `#1290`: ROAS down (0.85 vs 1.4 in jan) → red `↓ 39% vs jan` (gap month)
- `#1275`: ROAS down (0.63 vs 0.9 in jan) → red `↓ 30% vs jan` (gap month)
- `#1330`: No previous data → `—`
- `#1315`: Previous was 0, now 1.0 → green `↑ novo vs fev`

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/pautas/page.tsx
git commit -m "feat(pautas): update mock data with revenue, ad_count, and trend fields"
```

---

### Task 5: Build verification

- [ ] **Step 1: Run lint on changed files**

Run: `npx eslint supabase/schemas/18_get_guideline_metrics.sql app/dashboard/pautas/actions.ts components/pautas-table.tsx app/dashboard/pautas/page.tsx`

Expected: No errors.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: Build succeeds, `/dashboard/pautas` listed in output.

- [ ] **Step 3: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: resolve build/lint issues for pautas enhancements"
```
