# Pautas Enhancements — Design Spec

**Extends:** [2026-04-10-pautas-ranking-design.md](2026-04-10-pautas-ranking-design.md)
**Date:** 2026-04-14
**Branch:** `feat/pautas`

## Summary

Add three enhancements to the existing Pautas ranking table: Revenue column, Ad Count column, and a ROAS trend indicator comparing with the last month that had data for each guideline.

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Trend comparison | vs last month with data (not calendar previous) | Handles intermittent pautas correctly |
| Trend when "Todos" | Hidden (show `—`) | No single month to compare against |
| Trend reference | Show compared month (e.g., `↑ 15% vs fev`) | User needs to know the reference point |
| Calculation location | All in RPC (Approach A) | Keeps frontend simple, COUNT DISTINCT stays server-side |
| Remote DB | No changes — local schema files only | User handles deploy |

## 1. RPC Changes

### Modified: `supabase/schemas/18_get_guideline_metrics.sql`

Expand `get_guideline_metrics` return type with new columns:

```sql
RETURNS TABLE (
  guideline_number integer,
  spend numeric,
  revenue numeric,        -- NEW: SUM(am.revenue)
  roas numeric,
  ctr numeric,
  creator_count bigint,
  ad_count bigint,        -- NEW: COUNT(DISTINCT cr.meta_ad_id)
  prev_roas numeric,      -- NEW: ROAS from last month with data (NULL if none or p_month is NULL)
  prev_month text         -- NEW: which month is being compared, format 'YYYY-MM' (NULL if none)
)
```

### Trend logic

When `p_month` is provided:
1. CTE `monthly_roas` computes ROAS per `guideline_number` per month (for the given brand), filtering where `guideline_number IS NOT NULL`
2. CTE `prev_data` finds, for each guideline, the row from `monthly_roas` where `month < p_month` with `MAX(month)` — this is the "last month with data" before the selected month
3. Main query LEFT JOINs `prev_data` to attach `prev_roas` and `prev_month` per guideline

When `p_month` is NULL ("Todos"):
- `prev_roas = NULL`, `prev_month = NULL` — no comparison possible

### New aggregations in the main query

- `revenue` = `SUM(am.revenue)`
- `ad_count` = `COUNT(DISTINCT cr.meta_ad_id)`

## 2. Frontend Changes

### Modified: `app/dashboard/pautas/actions.ts`

Update `GuidelineMetric` type to include new fields:

```typescript
export type GuidelineMetric = {
  guideline_number: number;
  spend: number;
  revenue: number;       // NEW
  roas: number;
  ctr: number;
  creator_count: number;
  ad_count: number;      // NEW
  prev_roas: number | null;   // NEW
  prev_month: string | null;  // NEW
};
```

### Modified: `components/pautas-table.tsx`

**New columns (all sortable):**

| Column | Key | Format | Alignment |
|---|---|---|---|
| Pauta | `guideline_number` | `#1311` | Left |
| Gasto | `spend` | `R$ 4.230,50` | Right |
| Revenue | `revenue` | `R$ 14.468,31` | Right |
| ROAS | `roas` | `3.42x` (colored: green >=2, yellow 1-2, red <1) | Right |
| CTR | `ctr` | `2.18%` | Right |
| Anúncios | `ad_count` | `15` | Center |
| Creators | `creator_count` | `5` | Center |
| Tendência | (derived) | `↑ 15% vs fev` | Right |

**Trend column rendering:**
- `prev_roas` is not null and `roas > prev_roas` → green text, `↑ X% vs <month_abbr>`
- `prev_roas` is not null and `roas < prev_roas` → red text, `↓ X% vs <month_abbr>`
- `prev_roas` is not null and `roas == prev_roas` → neutral text, `→ 0% vs <month_abbr>`
- `prev_roas` is null → `—`

Variation percentage: `ROUND(((roas - prev_roas) / prev_roas) * 100)`. When `prev_roas` is 0 and `roas > 0`, show `↑ ∞` (or just `↑ novo`).

Month abbreviation: convert `prev_month` ("2026-02") to locale short month ("fev").

**Trend sorting:** Sort by variation percentage (computed client-side from `roas` and `prev_roas`). Rows with no trend data sort to the bottom.

### Modified: `app/dashboard/pautas/page.tsx`

Update mock data to include new fields for local preview.

## 3. Out of Scope

- Trend sparkline/chart (future)
- Summary/totals row (future)
- Changes to remote/production database
