# Brand Goals — Design Spec

**Issue:** #24 — Linhas de meta nos gráficos
**Date:** 2026-04-08
**Status:** Approved

## Summary

Allow traffic managers to set monthly share goals per brand and display them as dashed reference lines on the monthly and daily view charts.

## Definitions

- **Share Total Creators** = creator-attributed spend / brand total Facebook Ads spend
- **Share Creators Recent Content** = same logic, only creatives with `created_time` in current or previous month

## Data Model

New table `brand_goals` (declarative schema: `supabase/schemas/17_brand_goals.sql`):

```sql
CREATE TABLE brand_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id bigint NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  metric text NOT NULL CHECK (metric IN ('share_total', 'share_recent')),
  month date NOT NULL,
  value numeric NOT NULL CHECK (value >= 0 AND value <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, metric, month)
);
```

- `brand_id` — references `brands(id)`, cascade on delete
- `metric` — constrained to `'share_total'` or `'share_recent'`
- `month` — first day of the month (e.g., `2026-04-01`)
- `value` — percentage between 0 and 100
- Unique constraint on `(brand_id, metric, month)` — one goal per brand/metric/month

## UI: Goals Management (Brands Page)

A new **"Metas"** section on the brands page (`/dashboard/brands`), below the existing brands table.

### Form (cascade selection)

Four fields + action button in a single row:
1. **Marca** — dropdown with brands from the database
2. **Mês** — month selector
3. **Métrica** — "Share Total" or "Share Recente"
4. **Meta (%)** — numeric input (percentage)
5. **Salvar** button (changes to "Atualizar" when editing existing goal)

### Auto-load behavior

When the user selects a brand + month + metric combination that already has a goal:
- The value field loads the existing goal value
- The button label changes from "Salvar" to "Atualizar"

### Summary table

Below the form, a table shows all goals for the selected brand:

| Mês | Métrica | Meta | Ações |
|-----|---------|------|-------|
| Abr/2026 | Share Total | 40.0% | Edit / Delete |

- Sorted by month descending (most recent first)
- **Edit (pencil icon):** populates the form with the row's values
- **Delete (trash icon):** confirmation dialog, then removes the goal

### Component: `components/brand-goals-section.tsx`

Client component (`"use client"`) using `useTransition` + `toast` pattern.

## UI: Goal Lines on Charts

### SpendShareChart changes

Add optional `goalValue` prop to `SpendShareChart`:

```typescript
interface SpendShareChartProps {
  data: SpendShareDataPoint[];
  title: string;
  goalValue?: number; // percentage (e.g., 40.0)
}
```

When `goalValue` is defined, render a Recharts `ReferenceLine`:
- `yAxisId="right"` (share % axis)
- Dashed stroke: `strokeDasharray="6 4"`
- Color: `#ef4444` (red)
- `strokeWidth={2}`
- Label: `"Meta: X%"` positioned at the right end of the line
- Legend entry: dashed red line icon + "Meta"

### Monthly view

- Each chart ("Gasto total em creators" and "Gasto em conteúdo recente") receives its own `goalValue`
- The goal corresponds to the metric: `share_total` for the total chart, `share_recent` for the recent chart
- When the period spans multiple months with different goals, use the most recent month's goal value as the reference line
- No goal = no line

### Daily view

- Same behavior: each chart receives `goalValue` from the goal of the month matching the selected period
- If the period spans two months (e.g., "last 30 days" crossing a month boundary), use the most recent month's goal
- Since daily view typically covers a single month, the line is a fixed horizontal reference

### Multi-brand view

- When multi-brand is implemented (#23), each brand renders its own goal line (if set)
- Goal lines use the same red dashed style regardless of brand

## Data Flow

### Goals CRUD (Brands page)

```
BrandGoalsSection (client component)
  → upsertBrandGoal / deleteBrandGoal (server actions)
  → Supabase upsert/delete on brand_goals
  → revalidatePath("/dashboard/brands")
```

### Goals display (Charts)

```
MonthlyViewCharts / DailyViewCharts
  → getBrandGoalsByMonth(brandId, months[]) (server action)
  → Returns { share_total?: number, share_recent?: number } per month
  → Passes goalValue to each SpendShareChart instance
```

## Server Actions

All in `app/dashboard/brands/actions.ts`:

- `upsertBrandGoal(input: UpsertBrandGoalInput)` — uses `ON CONFLICT (brand_id, metric, month) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`
- `deleteBrandGoal(goalId: string)` — deletes by UUID
- `getBrandGoals(brandId: number)` — lists all goals for a brand (for summary table)

Fetch actions for charts in their respective action files:

- `app/dashboard/monthly-view/actions.ts` → `getBrandGoalsByMonth(brandId, months[])`
- `app/dashboard/daily-view/actions.ts` → `getBrandGoalsByMonth(brandId, months[])`

## Zod Schemas

Added to `lib/schemas/brand.ts`:

```typescript
export const upsertBrandGoalSchema = z.object({
  brandId: z.number(),
  metric: z.enum(["share_total", "share_recent"]),
  month: z.string(), // "YYYY-MM-DD" format, first day of month
  value: z.number().min(0, "Meta deve ser >= 0").max(100, "Meta deve ser <= 100"),
});

export type UpsertBrandGoalInput = z.infer<typeof upsertBrandGoalSchema>;
```

## Files Changed/Created

| File | Action | Description |
|------|--------|-------------|
| `supabase/schemas/17_brand_goals.sql` | Create | Declarative schema for brand_goals table |
| `lib/schemas/brand.ts` | Edit | Add goal Zod schemas |
| `app/dashboard/brands/actions.ts` | Edit | Add goal CRUD server actions |
| `app/dashboard/brands/page.tsx` | Edit | Include BrandGoalsSection |
| `components/brand-goals-section.tsx` | Create | Goals form + summary table |
| `components/spend-share-chart.tsx` | Edit | Add goalValue prop + ReferenceLine |
| `app/dashboard/monthly-view/actions.ts` | Edit | Add getBrandGoalsByMonth action |
| `app/dashboard/daily-view/actions.ts` | Edit | Add getBrandGoalsByMonth action |
| `components/monthly-view-charts.tsx` | Edit | Fetch goals + pass to charts |
| `components/daily-view-charts.tsx` | Edit | Fetch goals + pass to charts |

## Out of Scope

- Goals for metrics other than share (ROAS, CTR, etc.)
- Alerts/notifications when goals are not met
- Goal change history/audit log
- Multi-brand goal lines (depends on #23 — will work when that's implemented)
