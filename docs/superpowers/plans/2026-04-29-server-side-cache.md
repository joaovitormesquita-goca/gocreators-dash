# Server-Side Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache all Supabase read queries using Next.js `unstable_cache` with tag-based invalidation, eliminating repeated database hits on every page load while keeping data fresh after mutations and ETL syncs.

**Architecture:** Every read function is wrapped with `unstable_cache` using a cookie-free Supabase client (safe because no per-user RLS exists). Mutations call `revalidateTag` (Data Cache) + `revalidatePath` (Router Cache). A protected POST route at `/api/revalidate` lets the scheduled ETL Edge Function invalidate the cache via HTTP webhook after it completes. Manual sync is handled directly in the Server Action.

**Tech Stack:** Next.js 14 `unstable_cache`, `revalidateTag`, `revalidatePath` from `next/cache`; `@supabase/supabase-js` (cookie-free client for cached functions); Deno `fetch` in Edge Function.

---

## File Map

**New files:**
- `lib/cache-tags.ts` — Cache tag constants shared across all files
- `lib/supabase/static.ts` — Cookie-free Supabase client for `unstable_cache` contexts
- `app/api/revalidate/route.ts` — Protected POST route that calls `revalidateTag` on demand

**Modified files:**
- `lib/queries/brands.ts` — Wrap `getBrands` with `unstable_cache`
- `lib/queries/creators.ts` — Wrap `getCreatorsByBrand` with `unstable_cache`
- `lib/queries/products.ts` — Wrap `getDistinctProducts` with `unstable_cache`
- `app/dashboard/overview/actions.ts` — Wrap `getOverviewData`
- `app/dashboard/sync/actions.ts` — Wrap `getSyncLogs`; add `revalidateTag` to `syncAdMetrics`
- `app/dashboard/creators/actions.ts` — Wrap reads; add `revalidateTag` to cost mutations
- `app/dashboard/creators/list/actions.ts` — Wrap reads; add `revalidateTag` to creator mutations
- `app/dashboard/brands/actions.ts` — Wrap reads; add `revalidateTag` to all mutations; add `revalidateTag` to `startBackfillChunk`
- `app/dashboard/costs/actions.ts` — Wrap reads; add `revalidateTag` to cost mutations
- `app/dashboard/daily-view/actions.ts` — Wrap `getDailySpendView`, `getGroupsByBrand`, `getCreatorsByBrandAndGroup`
- `app/dashboard/monthly-view/actions.ts` — Wrap `getMonthlySpendView`, `getGroupsByBrand`, `getCreatorsByBrandAndGroup`
- `app/dashboard/pautas/actions.ts` — Wrap `getGuidelineMetrics`, `getAvailableMonths`
- `supabase/functions/sync-ad-metrics/index.ts` — Call `/api/revalidate` after scheduled sync
- `.env.local` — Add `REVALIDATE_SECRET`
- `supabase/.env` — Add `REVALIDATE_SECRET` and `NEXT_APP_URL`

---

## Cache Tag Strategy

| Tag | Caches | Invalidated by |
|---|---|---|
| `"brands"` | getBrands, getBrandsWithAdAccounts, getCreatorsByBrand, getCreatorsWithBrands, getGroupsByBrand, getCreatorBrandsForBrand, getBrandsForSelect, getCreatorsForBrand, getCreatorsByBrandAndGroup, getBrandGoals, getGoalsForBrand | brand/ad_account/group/creator CRUD |
| `"metrics"` | getOverviewData, getCreatorMetrics, getDailySpendView, getMonthlySpendView, getGuidelineMetrics, getAvailableMonths | ETL sync, creator mutations (handles change → different ad matches), cost mutations (creator metrics include costs) |
| `"costs"` | getCostMatrix | cost mutations |
| `"products"` | getDistinctProducts | ETL sync (new ads may introduce new product names) |
| `"sync-logs"` | getSyncLogs | any sync (manual, scheduled, backfill) |

> **Note on dev mode:** `unstable_cache` is disabled in `next dev` — all caching only applies to production builds (`next build && next start`). Manual validation must be done in production mode.

---

## Task 1: Create cache infrastructure

**Files:**
- Create: `lib/cache-tags.ts`
- Create: `lib/supabase/static.ts`

- [ ] **Step 1: Create `lib/cache-tags.ts`**

```typescript
export const CACHE_TAGS = {
  BRANDS: "brands",
  METRICS: "metrics",
  COSTS: "costs",
  PRODUCTS: "products",
  SYNC_LOGS: "sync-logs",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
```

- [ ] **Step 2: Create `lib/supabase/static.ts`**

`unstable_cache` runs outside the request context, so the cookie-based `createClient` from `lib/supabase/server.ts` cannot be used inside cached functions. This cookie-free client uses the same public key (already exposed client-side) and works because no RLS policies exist in this project.

```typescript
import { createClient } from "@supabase/supabase-js";

export function createStaticClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/cache-tags.ts lib/supabase/static.ts
git commit -m "feat(cache): add cache tag constants and static supabase client"
```

---

## Task 2: Create the revalidate API route

**Files:**
- Create: `app/api/revalidate/route.ts`

This route accepts a POST request with an `x-revalidate-secret` header and a `{ tags: string[] }` body. It calls `revalidateTag` for each tag. Used by the scheduled ETL Edge Function to invalidate the cache after sync.

- [ ] **Step 1: Create `app/api/revalidate/route.ts`**

```typescript
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tags?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tags = Array.isArray(body.tags) ? (body.tags as string[]) : ["metrics"];
  for (const tag of tags) {
    revalidateTag(tag);
  }

  return NextResponse.json({ revalidated: true, tags });
}
```

- [ ] **Step 2: Manually test the route**

Start the dev server (`npm run dev`), then:

```bash
# Should return 401
curl -X POST http://localhost:3000/api/revalidate \
  -H "Content-Type: application/json" \
  -d '{"tags":["metrics"]}'

# Should return 401 (wrong secret)
curl -X POST http://localhost:3000/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: wrongsecret" \
  -d '{"tags":["metrics"]}'
```

Add a temporary `REVALIDATE_SECRET=testsecret` to `.env.local` and run:

```bash
# Should return {"revalidated":true,"tags":["metrics"]}
curl -X POST http://localhost:3000/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: testsecret" \
  -d '{"tags":["metrics"]}'
```

Expected: `{"revalidated":true,"tags":["metrics"]}`

- [ ] **Step 3: Commit**

```bash
git add app/api/revalidate/route.ts
git commit -m "feat(cache): add protected revalidate API route"
```

---

## Task 3: Wrap lib/queries/ with unstable_cache

**Files:**
- Modify: `lib/queries/brands.ts`
- Modify: `lib/queries/creators.ts`
- Modify: `lib/queries/products.ts`

- [ ] **Step 1: Update `lib/queries/brands.ts`**

Replace the entire file:

```typescript
import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const getBrands = unstable_cache(
  async () => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("brands")
      .select("id, name")
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  },
  ["brands-list"],
  { tags: [CACHE_TAGS.BRANDS] },
);
```

- [ ] **Step 2: Update `lib/queries/creators.ts`**

Replace the entire file:

```typescript
import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const getCreatorsByBrand = unstable_cache(
  async (brandId: number) => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_brands")
      .select("creators(id, full_name)")
      .eq("brand_id", brandId);

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
  },
  ["creators-by-brand"],
  { tags: [CACHE_TAGS.BRANDS] },
);
```

- [ ] **Step 3: Update `lib/queries/products.ts`**

Replace the entire file:

```typescript
import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const getDistinctProducts = unstable_cache(
  async (brandId: number): Promise<string[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_distinct_products", {
      p_brand_id: brandId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: { product_name: string }) => row.product_name);
  },
  ["distinct-products"],
  { tags: [CACHE_TAGS.PRODUCTS] },
);
```

- [ ] **Step 4: Build to check for type errors**

```bash
npm run build
```

Expected: build completes with no TypeScript errors. (Ignore warnings about `unstable_cache` being unstable — it's stable enough for production use.)

- [ ] **Step 5: Commit**

```bash
git add lib/queries/brands.ts lib/queries/creators.ts lib/queries/products.ts
git commit -m "feat(cache): wrap lib/queries with unstable_cache"
```

---

## Task 4: Cache overview and sync read functions

**Files:**
- Modify: `app/dashboard/overview/actions.ts`
- Modify: `app/dashboard/sync/actions.ts`

- [ ] **Step 1: Update `app/dashboard/overview/actions.ts`**

Replace the entire file:

```typescript
"use server";

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type OverviewRow = {
  month: string;
  brand_id: number;
  brand_name: string;
  spend_total: number;
  spend_recentes: number;
  brand_total_spend: number;
};

const _getOverviewDataCached = unstable_cache(
  async (startDate: string | null, endDate: string | null): Promise<OverviewRow[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_overview_data", {
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["overview-data"],
  { tags: [CACHE_TAGS.METRICS] },
);

export async function getOverviewData(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<OverviewRow[]> {
  return _getOverviewDataCached(params?.startDate ?? null, params?.endDate ?? null);
}
```

- [ ] **Step 2: Update `app/dashboard/sync/actions.ts`**

Replace the entire file (reads are cached; `syncAdMetrics` is still in `creators/actions.ts` — this file only has the read function):

```typescript
"use server";

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type SyncLog = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  trigger: "manual" | "scheduled";
  creatives_upserted: number;
  metrics_upserted: number;
  unmatched_ads: number;
  account_spend_upserted: number;
  error_message: string | null;
};

export const getSyncLogs = unstable_cache(
  async (): Promise<SyncLog[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("sync_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["sync-logs"],
  { tags: [CACHE_TAGS.SYNC_LOGS] },
);
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/overview/actions.ts app/dashboard/sync/actions.ts
git commit -m "feat(cache): cache overview and sync log reads"
```

---

## Task 5: Cache creators/actions.ts reads + migrate mutations

**Files:**
- Modify: `app/dashboard/creators/actions.ts`

This file has both reads and mutations. Reads are wrapped with `unstable_cache`. Mutations replace `revalidatePath` with `revalidateTag` + `revalidatePath`.

- [ ] **Step 1: Update `app/dashboard/creators/actions.ts`**

Replace the entire file:

```typescript
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getBrands as _getBrands } from "@/lib/queries/brands";
import {
  bulkCostImportSchema,
  upsertCreatorCostSchema,
  type BulkCostImportInput,
  type BulkCostImportResult,
  type UpsertCreatorCostInput,
  type UpsertCreatorCostResult,
} from "@/lib/schemas/creator-cost";

export async function getBrands() {
  return _getBrands();
}

export type CreatorViewMode = "creator" | "product" | "granular";

export type CreatorMetric = {
  creator: string | null;
  creator_brand_id: number | null;
  product_name: string | null;
  month: string;
  group_id: number | null;
  spend_total: number;
  roas_total: number;
  ctr_total: number;
  spend_recentes: number;
  roas_recentes: number;
  ctr_recentes: number;
  cost: number | null;
  yearly_spend: number | null;
};

export type GroupOption = {
  id: number;
  name: string;
};

const _getGroupsByBrandCached = unstable_cache(
  async (brandId: number): Promise<GroupOption[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_groups")
      .select("id, name")
      .eq("brand_id", brandId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["groups-by-brand"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getGroupsByBrand(brandId: number): Promise<GroupOption[]> {
  return _getGroupsByBrandCached(brandId);
}

const _getCreatorBrandsForBrandCached = unstable_cache(
  async (brandId: number): Promise<{ creatorBrandId: number; creatorName: string; brandName: string }[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_brands")
      .select("id, creators(full_name), brands(name)")
      .eq("brand_id", brandId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((cb) => ({
      creatorBrandId: cb.id,
      creatorName:
        (cb.creators as unknown as { full_name: string })?.full_name ?? "",
      brandName: (cb.brands as unknown as { name: string })?.name ?? "",
    }));
  },
  ["creator-brands-for-brand"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getCreatorBrandsForBrand(
  brandId: number,
): Promise<{ creatorBrandId: number; creatorName: string; brandName: string }[]> {
  return _getCreatorBrandsForBrandCached(brandId);
}

const _getCreatorMetricsCached = unstable_cache(
  async (brandId: number, viewMode: CreatorViewMode): Promise<CreatorMetric[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_creator_metrics", {
      p_brand_id: brandId,
      p_view_mode: viewMode,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["creator-metrics"],
  { tags: [CACHE_TAGS.METRICS, CACHE_TAGS.COSTS] },
);

export async function getCreatorMetrics(
  brandId: number,
  viewMode: CreatorViewMode = "creator",
): Promise<CreatorMetric[]> {
  return _getCreatorMetricsCached(brandId, viewMode);
}

export async function syncAdMetrics() {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("sync-ad-metrics", {
    body: { trigger: "manual" },
  });

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidateTag(CACHE_TAGS.METRICS);
  revalidateTag(CACHE_TAGS.SYNC_LOGS);
  revalidatePath("/dashboard/sync");
  return { success: true as const, results: data };
}

export async function exportCostCsvBase(
  brandId: number,
  month: string,
): Promise<{ success: true; csv: string } | { success: false; error: string }> {
  const supabase = await createClient();

  const { data: brandData } = await supabase
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .single();

  if (!brandData) return { success: false, error: "Brand não encontrada" };

  const { data: creators, error } = await supabase
    .from("creator_brands")
    .select("id, creators(full_name)")
    .eq("brand_id", brandId);

  if (error) return { success: false, error: error.message };
  if (!creators || creators.length === 0) {
    return { success: false, error: "Nenhum creator vinculado a esta brand" };
  }

  const creatorBrandIds = creators.map((cb) => cb.id);
  const { data: existingCosts } = await supabase
    .from("creator_costs")
    .select("creator_brand_id, cost")
    .eq("month", month)
    .in("creator_brand_id", creatorBrandIds);

  const costMap = new Map(
    (existingCosts ?? []).map((c) => [c.creator_brand_id, c.cost]),
  );

  const rows = creators.map((cb) => {
    const creatorName =
      (cb.creators as unknown as { full_name: string })?.full_name ?? "";
    const existing = costMap.get(cb.id);
    return `"${creatorName}","${brandData.name}","${existing ?? ""}"`;
  });

  const csv = ["creator_name,brand_name,cost", ...rows].join("\n");
  return { success: true, csv };
}

export async function importCreatorCosts(
  input: BulkCostImportInput,
): Promise<BulkCostImportResult> {
  const parsed = bulkCostImportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { month, costs } = parsed.data;
  const supabase = await createClient();

  const rows = costs.map((c) => ({
    creator_brand_id: c.creatorBrandId,
    month,
    cost: c.cost,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("creator_costs").upsert(rows, {
    onConflict: "creator_brand_id,month",
  });

  if (error) return { success: false, error: error.message };

  revalidateTag(CACHE_TAGS.COSTS);
  revalidateTag(CACHE_TAGS.METRICS);
  revalidatePath("/dashboard/creators");
  return { success: true, importedCount: rows.length };
}

export async function upsertCreatorCost(
  input: UpsertCreatorCostInput,
): Promise<UpsertCreatorCostResult> {
  const parsed = upsertCreatorCostSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { creatorBrandId, month, cost } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("creator_costs").upsert(
    {
      creator_brand_id: creatorBrandId,
      month,
      cost,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "creator_brand_id,month" },
  );

  if (error) return { success: false, error: error.message };

  revalidateTag(CACHE_TAGS.COSTS);
  revalidateTag(CACHE_TAGS.METRICS);
  revalidatePath("/dashboard/creators");
  return { success: true };
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/creators/actions.ts
git commit -m "feat(cache): cache creator reads and add revalidateTag to mutations"
```

---

## Task 6: Cache creators/list/actions.ts reads + migrate mutations

**Files:**
- Modify: `app/dashboard/creators/list/actions.ts`

- [ ] **Step 1: Update `app/dashboard/creators/list/actions.ts`**

Replace the entire file (only the read functions and mutation tags change — the mutation logic itself is unchanged):

```typescript
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  createCreatorSchema,
  editCreatorSchema,
  type CreateCreatorInput,
  type EditCreatorInput,
} from "@/lib/schemas/creator";
import {
  bulkImportSchema,
  type BulkImportInput,
  type BulkImportResult,
} from "@/lib/schemas/csv-import";
import {
  bulkAssignGroupSchema,
  type BulkAssignGroupInput,
} from "@/lib/schemas/creator";

function splitHandles(raw: string): string[] {
  return raw
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

export type CreatorBrand = {
  id: number;
  assignmentId: number;
  name: string;
  handles: string[];
  start_date: string | null;
  group_id: number | null;
};

export type CreatorWithBrands = {
  id: number;
  full_name: string;
  email: string | null;
  brands: CreatorBrand[];
};

export const getCreatorsWithBrands = unstable_cache(
  async (): Promise<CreatorWithBrands[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creators")
      .select(
        `
        id,
        full_name,
        email,
        creator_brands (
          id,
          brand_id,
          handles,
          start_date,
          group_id,
          brands ( id, name )
        )
      `,
      )
      .order("full_name");

    if (error) throw new Error(error.message);

    return (data ?? []).map((creator) => ({
      id: creator.id,
      full_name: creator.full_name,
      email: creator.email,
      brands: (creator.creator_brands ?? []).map((cb: Record<string, unknown>) => {
        const brand = cb.brands as { id: number; name: string } | null;
        return {
          id: brand?.id ?? 0,
          assignmentId: cb.id as number,
          name: brand?.name ?? "",
          handles: (cb.handles as string[]) ?? [],
          start_date: cb.start_date as string | null,
          group_id: (cb.group_id as number | null) ?? null,
        };
      }),
    }));
  },
  ["creators-with-brands"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export const getBrandsForSelect = unstable_cache(
  async () => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("brands")
      .select("id, name")
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  },
  ["brands-for-select"],
  { tags: [CACHE_TAGS.BRANDS] },
);

const _getGroupsByBrandCached = unstable_cache(
  async (brandId: number): Promise<{ id: number; name: string }[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_groups")
      .select("id, name")
      .eq("brand_id", brandId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["groups-by-brand-list"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export type GroupOption = {
  id: number;
  name: string;
};

export async function getGroupsByBrand(brandId: number): Promise<GroupOption[]> {
  return _getGroupsByBrandCached(brandId);
}

type ActionResult =
  | { success: true; creatorId: number }
  | { success: false; error: string };

type UpdateResult =
  | { success: true }
  | { success: false; error: string };

export async function createCreatorWithBrands(
  input: CreateCreatorInput,
): Promise<ActionResult> {
  const parsed = createCreatorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { fullName, email, brandAssignments } = parsed.data;
  const supabase = await createClient();

  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .insert({
      full_name: fullName,
      email: email || null,
    })
    .select("id")
    .single();

  if (creatorError) {
    return { success: false, error: creatorError.message };
  }

  const creatorBrandsRows = brandAssignments.map((ba) => ({
    creator_id: creator.id,
    brand_id: Number(ba.brandId),
    handles: splitHandles(ba.handles),
    start_date: ba.startDate.toISOString().split("T")[0],
    group_id: ba.groupId ? Number(ba.groupId) : null,
  }));

  const { error: brandsError } = await supabase
    .from("creator_brands")
    .insert(creatorBrandsRows);

  if (brandsError) {
    return { success: false, error: brandsError.message };
  }

  revalidateTag(CACHE_TAGS.BRANDS);
  revalidateTag(CACHE_TAGS.METRICS);
  revalidatePath("/dashboard/creators/list");
  return { success: true, creatorId: creator.id };
}

export async function updateCreator(
  input: EditCreatorInput,
): Promise<UpdateResult> {
  const parsed = editCreatorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { creatorId, fullName, email, brandAssignments } = parsed.data;
  const supabase = await createClient();

  const { error: creatorError } = await supabase
    .from("creators")
    .update({ full_name: fullName, email: email || null })
    .eq("id", creatorId);

  if (creatorError) {
    return { success: false, error: creatorError.message };
  }

  const { data: currentAssignments, error: fetchError } = await supabase
    .from("creator_brands")
    .select("id")
    .eq("creator_id", creatorId);

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const currentIds = new Set((currentAssignments ?? []).map((a) => a.id));
  const submittedIds = new Set(
    brandAssignments
      .filter((ba) => ba.assignmentId !== undefined)
      .map((ba) => ba.assignmentId!),
  );

  const toDelete = [...currentIds].filter((id) => !submittedIds.has(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("creator_brands")
      .delete()
      .in("id", toDelete);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }
  }

  for (const ba of brandAssignments.filter((ba) => ba.assignmentId !== undefined)) {
    const { error: updateError } = await supabase
      .from("creator_brands")
      .update({
        handles: splitHandles(ba.handles),
        start_date: ba.startDate.toISOString().split("T")[0],
        group_id: ba.groupId ? Number(ba.groupId) : null,
      })
      .eq("id", ba.assignmentId!);

    if (updateError) {
      return { success: false, error: updateError.message };
    }
  }

  const toInsert = brandAssignments
    .filter((ba) => ba.assignmentId === undefined)
    .map((ba) => ({
      creator_id: creatorId,
      brand_id: Number(ba.brandId),
      handles: ba.handles.split(",").map((h) => h.trim()).filter(Boolean),
      start_date: ba.startDate.toISOString().split("T")[0],
      group_id: ba.groupId ? Number(ba.groupId) : null,
    }));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("creator_brands")
      .insert(toInsert);

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  revalidateTag(CACHE_TAGS.BRANDS);
  revalidateTag(CACHE_TAGS.METRICS);
  revalidatePath("/dashboard/creators/list");
  return { success: true };
}

export async function bulkImportCreators(
  input: BulkImportInput,
): Promise<BulkImportResult> {
  const parsed = bulkImportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { brandId, newCreators, existingCreatorLinks } = parsed.data;
  const supabase = await createClient();
  const errors: Array<{ name: string; error: string }> = [];
  let createdCount = 0;
  let linkedCount = 0;
  let handleAddedCount = 0;

  if (newCreators.length > 0) {
    const { data: insertedCreators, error: creatorsError } = await supabase
      .from("creators")
      .insert(
        newCreators.map((c) => ({
          full_name: c.fullName,
          email: c.email || null,
        })),
      )
      .select("id, full_name");

    if (creatorsError) {
      return { success: false, error: creatorsError.message };
    }

    const brandRows = (insertedCreators ?? []).map((creator, i) => ({
      creator_id: creator.id,
      brand_id: brandId,
      handles: splitHandles(newCreators[i].handle),
      start_date: newCreators[i].startDate,
    }));

    const { error: brandsError } = await supabase
      .from("creator_brands")
      .insert(brandRows);

    if (brandsError) {
      return { success: false, error: brandsError.message };
    }

    createdCount = insertedCreators?.length ?? 0;
  }

  for (const link of existingCreatorLinks) {
    if (link.existingAssignmentId) {
      const { data: current, error: fetchErr } = await supabase
        .from("creator_brands")
        .select("handles")
        .eq("id", link.existingAssignmentId)
        .single();

      if (fetchErr) {
        errors.push({ name: `Creator #${link.creatorId}`, error: fetchErr.message });
        continue;
      }

      const currentHandles = (current?.handles as string[]) ?? [];
      const newHandles = splitHandles(link.handle);
      const merged = [...new Set([...currentHandles, ...newHandles])];
      if (merged.length > currentHandles.length) {
        const { error: updateErr } = await supabase
          .from("creator_brands")
          .update({ handles: merged })
          .eq("id", link.existingAssignmentId);

        if (updateErr) {
          errors.push({ name: `Creator #${link.creatorId}`, error: updateErr.message });
          continue;
        }
        handleAddedCount++;
      }
    } else {
      const { error: insertErr } = await supabase
        .from("creator_brands")
        .insert({
          creator_id: link.creatorId,
          brand_id: brandId,
          handles: splitHandles(link.handle),
          start_date: link.startDate,
        });

      if (insertErr) {
        errors.push({ name: `Creator #${link.creatorId}`, error: insertErr.message });
        continue;
      }
      linkedCount++;
    }
  }

  revalidateTag(CACHE_TAGS.BRANDS);
  revalidateTag(CACHE_TAGS.METRICS);
  revalidatePath("/dashboard/creators/list");
  return { success: true, createdCount, linkedCount, handleAddedCount, errors };
}

export async function bulkUpdateCreatorBrandGroup(
  input: BulkAssignGroupInput,
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const parsed = bulkAssignGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("creator_brands")
    .update({ group_id: parsed.data.groupId })
    .in("id", parsed.data.creatorBrandIds);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateTag(CACHE_TAGS.BRANDS);
  revalidatePath("/dashboard/creators/list");
  return { success: true, count: parsed.data.creatorBrandIds.length };
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/creators/list/actions.ts
git commit -m "feat(cache): cache creator list reads and add revalidateTag to mutations"
```

---

## Task 7: Cache brands/actions.ts reads + migrate mutations

**Files:**
- Modify: `app/dashboard/brands/actions.ts`

- [ ] **Step 1: Update the read functions in `app/dashboard/brands/actions.ts`**

Add imports at the top of the file and wrap each read function. Replace the **imports and read functions** section (everything before `createBrand`):

Old imports:
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createBrandSchema,
  // ... rest of schema imports
} from "@/lib/schemas/brand";
import {
  backfillChunkSchema,
  // ...
} from "@/lib/schemas/backfill";
```

New imports + wrapped reads:
```typescript
"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  createBrandSchema,
  editBrandSchema,
  createAdAccountSchema,
  editAdAccountSchema,
  createGroupSchema,
  editGroupSchema,
  upsertBrandGoalSchema,
  deleteBrandGoalSchema,
  type CreateBrandInput,
  type EditBrandInput,
  type CreateAdAccountInput,
  type EditAdAccountInput,
  type CreateGroupInput,
  type EditGroupInput,
  type UpsertBrandGoalInput,
  type DeleteBrandGoalInput,
} from "@/lib/schemas/brand";
import {
  backfillChunkSchema,
  type BackfillChunkInput,
  type BackfillChunkResult,
} from "@/lib/schemas/backfill";

export type AdAccount = {
  id: number;
  name: string;
  meta_account_id: string;
};

export type CreatorGroup = {
  id: number;
  name: string;
};

export type BrandWithAdAccounts = {
  id: number;
  name: string;
  ad_accounts: AdAccount[];
  groups: CreatorGroup[];
};

export type BrandGoal = {
  id: string;
  brand_id: number;
  metric: "share_total" | "share_recent";
  month: string;
  value: number;
};

type ActionResult =
  | { success: true }
  | { success: false; error: string };

export const getBrandsWithAdAccounts = unstable_cache(
  async (): Promise<BrandWithAdAccounts[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("brands")
      .select(
        `
        id,
        name,
        ad_accounts (
          id,
          name,
          meta_account_id
        ),
        creator_groups (
          id,
          name
        )
      `,
      )
      .order("name");

    if (error) throw new Error(error.message);

    return (data ?? []).map((brand) => ({
      id: brand.id,
      name: brand.name,
      ad_accounts: (brand.ad_accounts ?? []).map((aa: Record<string, unknown>) => ({
        id: aa.id as number,
        name: aa.name as string,
        meta_account_id: aa.meta_account_id as string,
      })),
      groups: (brand.creator_groups ?? []).map((g: Record<string, unknown>) => ({
        id: g.id as number,
        name: g.name as string,
      })),
    }));
  },
  ["brands-with-ad-accounts"],
  { tags: [CACHE_TAGS.BRANDS] },
);

const _getGoalsForBrandCached = unstable_cache(
  async (brandId: number, startDate: string, endDate: string): Promise<BrandGoalRow[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("brand_goals")
      .select("metric, month, value")
      .eq("brand_id", brandId)
      .gte("month", startDate)
      .lte("month", endDate);
    if (error) throw new Error(error.message);
    return (data ?? []) as BrandGoalRow[];
  },
  ["goals-for-brand"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export type BrandGoalRow = {
  metric: "share_total" | "share_recent";
  month: string;
  value: number;
};

export async function getGoalsForBrand(
  brandId: number,
  startDate: string,
  endDate: string,
): Promise<BrandGoalRow[]> {
  return _getGoalsForBrandCached(brandId, startDate, endDate);
}

const _getBrandGoalsCached = unstable_cache(
  async (brandId: number): Promise<BrandGoal[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("brand_goals")
      .select("id, brand_id, metric, month, value")
      .eq("brand_id", brandId)
      .order("month", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as BrandGoal[];
  },
  ["brand-goals"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getBrandGoals(brandId: number): Promise<BrandGoal[]> {
  return _getBrandGoalsCached(brandId);
}

const _getGroupsByBrandCached = unstable_cache(
  async (brandId: number): Promise<CreatorGroup[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_groups")
      .select("id, name")
      .eq("brand_id", brandId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["groups-by-brand-brands"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getGroupsByBrand(brandId: number): Promise<CreatorGroup[]> {
  return _getGroupsByBrandCached(brandId);
}
```

- [ ] **Step 2: Update all mutation functions in `app/dashboard/brands/actions.ts`**

Replace every `revalidatePath("/dashboard/brands")` call with:
```typescript
revalidateTag(CACHE_TAGS.BRANDS);
revalidatePath("/dashboard/brands");
```

Also update `startBackfillChunk` to invalidate metrics after a backfill:
```typescript
export async function startBackfillChunk(
  input: BackfillChunkInput,
): Promise<
  | { success: true; result: BackfillChunkResult }
  | { success: false; error: string }
> {
  const parsed = backfillChunkSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke("sync-ad-metrics", {
    body: {
      trigger: "backfill",
      ad_account_id: parsed.data.adAccountId,
      date_from: parsed.data.dateFrom,
      date_to: parsed.data.dateTo,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidateTag(CACHE_TAGS.METRICS);
  revalidateTag(CACHE_TAGS.SYNC_LOGS);

  const results = data?.results ?? [];
  const first = results[0];

  return {
    success: true,
    result: {
      adAccountId: parsed.data.adAccountId,
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
      status: first?.status === "error" ? "error" : "success",
      error: first?.error,
      creativesUpserted: first?.creatives_upserted ?? 0,
      metricsUpserted: first?.metrics_upserted ?? 0,
      accountSpendUpserted: first?.account_spend_upserted ?? 0,
    },
  };
}
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/brands/actions.ts
git commit -m "feat(cache): cache brand reads and add revalidateTag to mutations"
```

---

## Task 8: Cache costs/actions.ts reads + migrate mutations

**Files:**
- Modify: `app/dashboard/costs/actions.ts`

- [ ] **Step 1: Add imports to `app/dashboard/costs/actions.ts`**

Replace the top imports:
```typescript
"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getBrands as _getBrands } from "@/lib/queries/brands";
import {
  bulkCostImportWithMonthSchema,
  upsertCreatorCostSchema,
  type BulkCostImportWithMonthInput,
  type BulkCostImportResult,
  type UpsertCreatorCostInput,
  type UpsertCreatorCostResult,
} from "@/lib/schemas/creator-cost";
```

- [ ] **Step 2: Wrap `getCostMatrix` with `unstable_cache`**

Replace the existing `getCostMatrix` function:
```typescript
export type CostMatrixRow = {
  creator_name: string;
  brand_name: string;
  creator_brand_id: number;
  month: string;
  cost: number | null;
};

const _getCostMatrixCached = unstable_cache(
  async (brandId: number, monthFrom: string | null, monthTo: string | null): Promise<CostMatrixRow[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_cost_matrix", {
      p_brand_id: brandId,
      p_month_from: monthFrom,
      p_month_to: monthTo,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["cost-matrix"],
  { tags: [CACHE_TAGS.COSTS] },
);

export async function getCostMatrix(
  brandId: number,
  monthFrom?: string,
  monthTo?: string,
): Promise<CostMatrixRow[]> {
  return _getCostMatrixCached(brandId, monthFrom ?? null, monthTo ?? null);
}
```

- [ ] **Step 3: Wrap `getCreatorsForBrand` with `unstable_cache`**

Replace the existing `getCreatorsForBrand` function:
```typescript
export type CreatorForBrand = {
  creatorBrandId: number;
  creatorName: string;
  brandName: string;
  startDate: string;
  endDate: string | null;
};

const _getCreatorsForBrandCached = unstable_cache(
  async (brandId: number): Promise<CreatorForBrand[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_brands")
      .select("id, start_date, end_date, creators(full_name), brands(name)")
      .eq("brand_id", brandId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((cb) => ({
      creatorBrandId: cb.id,
      creatorName:
        (cb.creators as unknown as { full_name: string })?.full_name ?? "",
      brandName: (cb.brands as unknown as { name: string })?.name ?? "",
      startDate: cb.start_date,
      endDate: cb.end_date,
    }));
  },
  ["creators-for-brand"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getCreatorsForBrand(brandId: number): Promise<CreatorForBrand[]> {
  return _getCreatorsForBrandCached(brandId);
}
```

- [ ] **Step 4: Update mutations in `app/dashboard/costs/actions.ts`**

In `importCreatorCostsWithMonth`, replace:
```typescript
  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/creators");
```
With:
```typescript
  revalidateTag(CACHE_TAGS.COSTS);
  revalidateTag(CACHE_TAGS.METRICS);
  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/creators");
```

In `upsertCreatorCost`, replace:
```typescript
  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/creators");
```
With:
```typescript
  revalidateTag(CACHE_TAGS.COSTS);
  revalidateTag(CACHE_TAGS.METRICS);
  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/creators");
```

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/costs/actions.ts
git commit -m "feat(cache): cache cost matrix read and add revalidateTag to mutations"
```

---

## Task 9: Cache daily-view and monthly-view reads

**Files:**
- Modify: `app/dashboard/daily-view/actions.ts`
- Modify: `app/dashboard/monthly-view/actions.ts`

These files contain no mutations, only reads.

- [ ] **Step 1: Update `app/dashboard/daily-view/actions.ts`**

Replace the entire file:

```typescript
"use server";

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
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

const _getGroupsByBrandCached = unstable_cache(
  async (brandId: number): Promise<GroupOption[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_groups")
      .select("id, name")
      .eq("brand_id", brandId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["groups-by-brand-daily"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getGroupsByBrand(brandId: number): Promise<GroupOption[]> {
  return _getGroupsByBrandCached(brandId);
}

const _getCreatorsByBrandAndGroupCached = unstable_cache(
  async (brandId: number, groupId: number | null): Promise<{ id: number; full_name: string }[]> => {
    const supabase = createStaticClient();
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
  },
  ["creators-by-brand-and-group-daily"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getCreatorsByBrandAndGroup(
  brandId: number,
  groupId: number | null,
): Promise<{ id: number; full_name: string }[]> {
  return _getCreatorsByBrandAndGroupCached(brandId, groupId);
}

export type DailySpendRow = {
  day: string;
  spend_total: number;
  spend_recentes: number;
  brand_total_spend: number;
};

const _getDailySpendViewCached = unstable_cache(
  async (
    brandId: number,
    creatorIds: number[] | null,
    startDate: string,
    endDate: string,
    productNames: string[] | null,
  ): Promise<DailySpendRow[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_daily_spend_view", {
      p_brand_id: brandId,
      p_creator_ids: creatorIds,
      p_start_date: startDate,
      p_end_date: endDate,
      p_product_names: productNames,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["daily-spend-view"],
  { tags: [CACHE_TAGS.METRICS] },
);

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
  return _getDailySpendViewCached(
    parsed.data.brandId,
    parsed.data.creatorIds && parsed.data.creatorIds.length > 0 ? parsed.data.creatorIds : null,
    parsed.data.startDate,
    parsed.data.endDate,
    parsed.data.productNames && parsed.data.productNames.length > 0 ? parsed.data.productNames : null,
  );
}

export async function getDistinctProducts(brandId: number): Promise<string[]> {
  return _getDistinctProducts(brandId);
}
```

- [ ] **Step 2: Update `app/dashboard/monthly-view/actions.ts`**

Replace the entire file:

```typescript
"use server";

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
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

const _getGroupsByBrandCached = unstable_cache(
  async (brandId: number): Promise<GroupOption[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_groups")
      .select("id, name")
      .eq("brand_id", brandId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["groups-by-brand-monthly"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getGroupsByBrand(brandId: number): Promise<GroupOption[]> {
  return _getGroupsByBrandCached(brandId);
}

const _getCreatorsByBrandAndGroupCached = unstable_cache(
  async (brandId: number, groupId: number | null): Promise<{ id: number; full_name: string }[]> => {
    const supabase = createStaticClient();
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
  },
  ["creators-by-brand-and-group-monthly"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getCreatorsByBrandAndGroup(
  brandId: number,
  groupId: number | null,
): Promise<{ id: number; full_name: string }[]> {
  return _getCreatorsByBrandAndGroupCached(brandId, groupId);
}

export type MonthlySpendRow = {
  month: string;
  spend_total: number;
  spend_recentes: number;
  brand_total_spend: number;
};

const _getMonthlySpendViewCached = unstable_cache(
  async (
    brandId: number,
    creatorIds: number[] | null,
    startDate: string,
    endDate: string,
    productNames: string[] | null,
  ): Promise<MonthlySpendRow[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_monthly_spend_view", {
      p_brand_id: brandId,
      p_creator_ids: creatorIds,
      p_start_date: startDate,
      p_end_date: endDate,
      p_product_names: productNames,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["monthly-spend-view"],
  { tags: [CACHE_TAGS.METRICS] },
);

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
  return _getMonthlySpendViewCached(
    parsed.data.brandId,
    parsed.data.creatorIds && parsed.data.creatorIds.length > 0 ? parsed.data.creatorIds : null,
    parsed.data.startDate,
    parsed.data.endDate,
    parsed.data.productNames && parsed.data.productNames.length > 0 ? parsed.data.productNames : null,
  );
}

export async function getDistinctProducts(brandId: number): Promise<string[]> {
  return _getDistinctProducts(brandId);
}
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/daily-view/actions.ts app/dashboard/monthly-view/actions.ts
git commit -m "feat(cache): cache daily and monthly spend view reads"
```

---

## Task 10: Cache pautas/actions.ts reads

**Files:**
- Modify: `app/dashboard/pautas/actions.ts`

- [ ] **Step 1: Update `app/dashboard/pautas/actions.ts`**

Replace the entire file:

```typescript
"use server";

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getBrands as _getBrands } from "@/lib/queries/brands";
import { getDistinctProducts as _getDistinctProducts } from "@/lib/queries/products";

export async function getBrands() {
  return _getBrands();
}

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

const _getGuidelineMetricsCached = unstable_cache(
  async (
    brandId: number,
    month: string | null,
    productNames: string[] | null,
  ): Promise<GuidelineMetric[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_guideline_metrics", {
      p_brand_id: brandId,
      p_month: month,
      p_product_names: productNames,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["guideline-metrics"],
  { tags: [CACHE_TAGS.METRICS] },
);

export async function getGuidelineMetrics(
  brandId: number,
  month?: string,
  productNames?: string[],
): Promise<GuidelineMetric[]> {
  return _getGuidelineMetricsCached(
    brandId,
    month ?? null,
    productNames && productNames.length > 0 ? productNames : null,
  );
}

const _getAvailableMonthsCached = unstable_cache(
  async (brandId: number): Promise<string[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_guideline_available_months", {
      p_brand_id: brandId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: { month: string }) => row.month);
  },
  ["guideline-available-months"],
  { tags: [CACHE_TAGS.METRICS] },
);

export async function getAvailableMonths(brandId: number): Promise<string[]> {
  return _getAvailableMonthsCached(brandId);
}

export async function getDistinctProducts(brandId: number): Promise<string[]> {
  return _getDistinctProducts(brandId);
}
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/pautas/actions.ts
git commit -m "feat(cache): cache guideline metrics and available months reads"
```

---

## Task 11: Update Edge Function to call revalidate after scheduled sync

**Files:**
- Modify: `supabase/functions/sync-ad-metrics/index.ts`
- Modify: `supabase/.env`

The Edge Function is triggered by cron (scheduled). Manual and backfill syncs are handled by their respective Server Actions. This task adds a webhook call only for `trigger === "scheduled"`.

- [ ] **Step 1: Add env vars to `supabase/.env`**

Add these two lines to `supabase/.env`:
```
REVALIDATE_SECRET=<same value as in .env.local>
NEXT_APP_URL=http://localhost:3000
```

For production, `NEXT_APP_URL` should be the deployed app URL (e.g., `https://your-app.vercel.app`). Update via Supabase Dashboard → Edge Functions → Secrets when deploying.

- [ ] **Step 2: Add revalidation call to Edge Function**

In `supabase/functions/sync-ad-metrics/index.ts`, locate the successful response block (around line 179):

```typescript
    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });
```

Replace that block with:

```typescript
    // Notify Next.js to revalidate cache after scheduled ETL sync.
    // Manual and backfill syncs are handled by their Server Actions directly.
    if (trigger === "scheduled") {
      const nextAppUrl = Deno.env.get("NEXT_APP_URL");
      const revalidateSecret = Deno.env.get("REVALIDATE_SECRET");
      if (nextAppUrl && revalidateSecret) {
        try {
          await fetch(`${nextAppUrl}/api/revalidate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-revalidate-secret": revalidateSecret,
            },
            body: JSON.stringify({ tags: ["metrics", "sync-logs", "products"] }),
          });
        } catch (e) {
          console.error("Failed to revalidate Next.js cache:", e);
          // Non-fatal — sync data was written correctly even if cache invalidation fails
        }
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });
```

- [ ] **Step 3: Test the Edge Function locally**

```bash
supabase functions serve --no-verify-jwt
```

In a separate terminal, trigger a manual sync (which will NOT call the revalidate route — correct):
```bash
curl -X POST http://localhost:54321/functions/v1/sync-ad-metrics \
  -H "Content-Type: application/json" \
  -d '{"trigger":"manual"}'
```

Then trigger a simulated scheduled sync (which WILL attempt to call the revalidate route):
```bash
curl -X POST http://localhost:54321/functions/v1/sync-ad-metrics \
  -H "Content-Type: application/json" \
  -d '{"trigger":"scheduled"}'
```

Expected log: `Failed to revalidate Next.js cache: ...` (because localhost:3000 may not be running, but the sync itself succeeds). Verify the function doesn't crash.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/sync-ad-metrics/index.ts
git commit -m "feat(cache): call revalidate webhook from scheduled ETL sync"
```

---

## Task 12: Add env vars and do end-to-end validation

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Generate a secret and add to `.env.local`**

```bash
# Generate a random 32-character hex secret
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Add to `.env.local`:
```
REVALIDATE_SECRET=<output from above>
```

- [ ] **Step 2: Build for production and start server**

```bash
npm run build && npm start
```

Expected: server starts at http://localhost:3000.

- [ ] **Step 3: Validate cache behavior**

Open the browser at `http://localhost:3000/auth/login`, log in as `teste@gocreators.com` / `teste123456`.

Navigate to `/dashboard/overview`. Check the terminal — you should see a Supabase query executing (first load, cache miss).

Navigate away and back to `/dashboard/overview`. The second load should return instantly with **no new Supabase query** in the terminal (cache hit).

- [ ] **Step 4: Validate mutation invalidation**

Navigate to `/dashboard/brands`. Note the list of brands.

In a second browser tab, add a new brand via the UI. Go back to the overview tab and navigate to `/dashboard/brands` — the new brand should appear immediately (cache was invalidated by `revalidateTag`).

- [ ] **Step 5: Validate the revalidate webhook**

Run this curl command with the secret from `.env.local`:
```bash
curl -X POST http://localhost:3000/api/revalidate \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: <your-secret>" \
  -d '{"tags":["metrics","sync-logs","products"]}'
```

Expected: `{"revalidated":true,"tags":["metrics","sync-logs","products"]}`

Navigate to a metrics page — first load after invalidation will make a fresh Supabase query (cache miss), confirming the webhook works.

- [ ] **Step 6: Final build and lint**

```bash
npm run build
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 7: Commit**

```bash
git add .env.local
git commit -m "feat(cache): add REVALIDATE_SECRET to env"
```

Note: `.env.local` is gitignored. Document the new variable in your team's onboarding docs or `.env.example` if one exists.

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|---|---|
| Skeletons de 5-10s em cada acesso → cache eliminando queries ao Supabase | Tasks 3-10 |
| Cache transparente — mesmos dados, mesma experiência | All tasks (no API surface changes) |
| `unstable_cache` com tags semânticas | Tasks 1, 3-10 |
| Route handler de revalidação protegido por secret | Task 2 |
| ETL agendado chama revalidação ao finalizar | Task 11 |
| Mutações manuais já chamam `revalidatePath` — ampliar com `revalidateTag` | Tasks 5, 6, 7, 8 |

### Placeholder Scan

No placeholders found — all code blocks are complete.

### Type Consistency

- `CACHE_TAGS` constants defined in Task 1, used identically in all subsequent tasks
- `createStaticClient()` defined in Task 1, signature `() => SupabaseClient`, called consistently
- Cache key prefixes are unique per cached function (e.g., `"groups-by-brand"` vs `"groups-by-brand-daily"` vs `"groups-by-brand-monthly"` vs `"groups-by-brand-brands"`) to avoid cross-page cache collisions

---

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| `unstable_cache` disabled in `next dev` | Document clearly; test in `next start` (production mode) |
| Stale cache if a mutation invalidates wrong tags | Tag mapping table above is conservative (cost mutations also invalidate `"metrics"`) |
| Webhook fails during scheduled sync | Catch block logs error without crashing the sync; data is safe |
| `createStaticClient` uses anon key — could expose data if RLS is added later | If RLS is ever introduced, this approach must be revisited — add a comment in `static.ts` |
| Double-invalidation for manual sync (Server Action + potential Edge Function call) | Edge Function only calls webhook for `trigger === "scheduled"`, not "manual" or "backfill" |
| Cache key collisions between pages for `getGroupsByBrand` | Unique key prefixes per page (`"groups-by-brand-daily"`, `"groups-by-brand-monthly"`, etc.) |

---

## Estimativa de Complexidade

**Média** — Sem mudanças de banco, sem novos componentes de UI, sem lógica de negócio nova. A maioria das mudanças é mecânica (trocar `createClient` por `createStaticClient` + envolver com `unstable_cache`). O único risco técnico relevante é o cliente estático e a validação em produção.
