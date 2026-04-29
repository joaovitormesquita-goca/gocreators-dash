# Pautas Ranking — Design Spec

**Issue:** [#28 — Tela de ranking de pautas](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/28)
**Date:** 2026-04-10
**Branch:** `feat/pautas`

## Summary

New "Pautas" screen that ranks content briefings (pautas) by ad performance metrics. The guideline number is extracted from the ad name via regex during ETL and stored on the `creatives` table. A new RPC function aggregates metrics by guideline number per brand, and a new frontend page displays the ranking with brand and month filters.

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| Period filter | Month dropdown (like creators) | Consistency with existing UI |
| Columns | Pauta #, Gasto, ROAS, CTR, Creators | Issue scope — no product column |
| Default sort | ROAS descending | Shows best-performing pautas first |
| Nav placement | Dashboards group in sidebar | Pautas is an analysis/ranking view |
| Data extraction | Column in ETL (Approach A) | Performant, indexable, issue-recommended |
| Remote DB | No changes — local schema files only | User will test and PR manually |

## 1. Data Model

### Change: `creatives` table

Add column to `supabase/schemas/06_creatives.sql`:

```sql
guideline_number integer  -- extracted from ad_name by ETL, nullable
```

- `NULL` when ad name doesn't match the pauta regex — these rows are excluded from the pautas screen
- No FK, no separate `guidelines` table — grouping is by `guideline_number` + `brand_id`
- No index needed for MVP volume; can add later if queries slow down

### Backfill strategy

Existing creatives need `guideline_number` populated. Options (executed by user, not automated):

1. Re-run ETL sync (recommended) — the updated ETL will populate the field on re-sync
2. Manual SQL: `UPDATE creatives SET guideline_number = substring(ad_name from '(?i)- pauta (\d+) -')::integer WHERE guideline_number IS NULL`

## 2. ETL Changes

### File: `supabase/functions/sync-ad-metrics/handle-matcher.ts`

Add function:

```typescript
export function extractGuidelineNumber(adName: string): number | null {
  const match = adName.match(/- pauta (\d+) -/i);
  return match ? parseInt(match[1], 10) : null;
}
```

### File: `supabase/functions/sync-ad-metrics/index.ts`

In the creatives upsert step, call `extractGuidelineNumber(row.ad_name)` and include `guideline_number` in the upsert payload. The existing upsert on `meta_ad_id` conflict will update the field for existing records too.

## 3. RPC Function

### New file: `supabase/schemas/16_get_guideline_metrics.sql`

Function signature:

```sql
CREATE OR REPLACE FUNCTION get_guideline_metrics(p_brand_id bigint, p_month text DEFAULT NULL)
RETURNS TABLE (
  guideline_number integer,
  spend numeric,
  roas numeric,
  ctr numeric,
  creator_count bigint
)
```

Parameters:
- `p_brand_id` — required, filters by brand
- `p_month` — optional, format `'YYYY-MM'`. When NULL, aggregates across all dates ("Todos"). When provided, filters `ad_metrics.date` to that month only.

Logic:
- JOIN: `ad_metrics` → `creatives` → `creator_brands`
- FILTER: `creator_brands.brand_id = p_brand_id` AND `creatives.guideline_number IS NOT NULL` AND (when `p_month` is not NULL) `to_char(am.date, 'YYYY-MM') = p_month`
- GROUP BY: `creatives.guideline_number`
- AGGREGATIONS:
  - `spend` = `SUM(am.spend)`
  - `roas` = `ROUND(SUM(am.revenue) / NULLIF(SUM(am.spend), 0), 2)`
  - `ctr` = `ROUND(SUM(am.link_clicks)::numeric / NULLIF(SUM(am.impressions), 0) * 100, 2)`
  - `creator_count` = `COUNT(DISTINCT cb.creator_id)`

The month filter is handled server-side (not client-side) because `creator_count` requires `COUNT(DISTINCT)` which can't be correctly re-aggregated across months on the client.

Follows the same pattern as `15_get_creator_metrics.sql`.

### Available months — `get_guideline_available_months(p_brand_id bigint)`

Same schema file. Returns distinct months (`YYYY-MM` text) that have guideline data for a brand, ordered descending. Used to populate the month dropdown.

```sql
CREATE OR REPLACE FUNCTION get_guideline_available_months(p_brand_id bigint)
RETURNS TABLE (month text)
```

## 4. Frontend

### New route: `app/dashboard/pautas/`

Files:
- `page.tsx` — Server component, fetches brands and initial guideline metrics
- `actions.ts` — Server action `getGuidelineMetrics(brandId)` calling the RPC
- `loading.tsx` — Skeleton matching the table layout

### New component: `components/pautas-table.tsx`

Client component following the `creators-table.tsx` pattern:

**Props:**
- `brands: Brand[]` — for the brand filter dropdown
- `initialData: GuidelineMetric[]` — server-fetched initial data
- `initialBrandId: string` — pre-selected brand (first brand, from URL param)

**Filters:**
- Brand dropdown (required, pre-selects first brand) — `handleBrandChange()` updates URL param and refetches via server action
- Month dropdown — populated from available months in data, with "Todos" option for cumulative view

**Table columns (all sortable):**
| Column | Format | Alignment |
|---|---|---|
| Pauta | `#1311` | Left |
| Gasto | `R$ 4.230,50` | Right |
| ROAS | `3.42` (colored: green >2, yellow 1-2, red <1) | Right |
| CTR | `2.18%` | Right |
| Creators | `5` | Center |

**Default sort:** ROAS descending

**Month filtering:** Client-side from the full dataset (same as creators table — RPC returns all months, client filters by selected month or shows "Todos" aggregate)

### Navigation: `components/app-sidebar.tsx`

Add "Pautas" item to the "Dashboards" group with an appropriate Lucide icon (e.g., `FileText` or `ClipboardList`), linking to `/dashboard/pautas`.

## 5. Out of Scope

- Manual pauta registration
- Per-creator breakdown within a pauta
- Product extraction from ad name
- Non-creator ad sources
- Remote database changes (user handles deploy)
