# Briefings Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize pauta (briefing) management in the Gocreators Supabase, replacing the Google Sheets intermediary, while keeping the existing application 100% unchanged. Adds a new `/dashboard/briefings` route for allocation + status tracking, an Edge Function for Apps Script ingestion from Google Docs, and a backfill tool for active in-flight pautas.

**Architecture:** Apps Script in Google Docs POSTs parsed pautas to a Supabase Edge Function, which idempotently upserts them into a new `briefings` table. Allocation (creator + variante) lives in `briefing_assignments`, with status tracked per allocation and aggregated via the `briefing_with_status` view. The Next.js dashboard page reads via cached Server Actions (using `unstable_cache` + a new `briefings` cache tag) and mutates via standard Server Actions. Cache invalidation flows through the existing `/api/revalidate` endpoint.

**Tech Stack:** Next.js 15 App Router, Supabase (Postgres + Edge Functions Deno runtime), TypeScript, Tailwind v4 + shadcn/ui, Zod, react-hook-form, sonner (toasts), papaparse (backfill CSV).

**Spec:** [docs/superpowers/specs/2026-05-06-gestao-pautas-design.md](../specs/2026-05-06-gestao-pautas-design.md)

---

## File Structure

### New files
```
supabase/schemas/20_briefings.sql                # table briefings
supabase/schemas/21_briefing_assignments.sql     # table briefing_assignments
supabase/schemas/22_briefing_with_status.sql     # view briefing_with_status

supabase/functions/ingest-briefing/index.ts      # Edge Function HTTP endpoint
supabase/functions/ingest-briefing/types.ts      # request/response types

lib/schemas/briefing.ts                          # Zod schemas + TS types
lib/queries/briefings.ts                         # cached read queries

app/dashboard/briefings/page.tsx                 # main page (Server Component)
app/dashboard/briefings/loading.tsx              # skeleton
app/dashboard/briefings/actions.ts               # Server Actions

components/briefing-management-table.tsx        # filterable, sortable table
components/briefing-detail-sheet.tsx            # right-side drawer with details
components/briefing-allocation-form.tsx         # multi-creator combobox
components/briefing-assignment-row.tsx          # editable assignment row
components/briefing-status-badge.tsx            # status pill

scripts/backfill-briefings.ts                    # CSV → DB import (Node, run with tsx)
scripts/sync-briefings-gocreators.gs             # Apps Script reference (Docs → Edge Function)
```

### Modified files
```
lib/cache-tags.ts                                # add BRIEFINGS
components/app-sidebar.tsx                       # add new entry "Pautas (Gestão)" in Gestão group
```

---

## Task 1: Create branch & wire cache tag

**Files:**
- Modify: `lib/cache-tags.ts`

- [ ] **Step 1: Create feature branch from main**

```bash
git checkout main
git pull
git checkout -b feat/briefings-management
```

- [ ] **Step 2: Add BRIEFINGS cache tag**

Edit `lib/cache-tags.ts`:

```typescript
export const CACHE_TAGS = {
  BRANDS: "brands",
  METRICS: "metrics",
  COSTS: "costs",
  PRODUCTS: "products",
  SYNC_LOGS: "sync-logs",
  BRIEFINGS: "briefings",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
```

- [ ] **Step 3: Verify build still passes**

Run: `npm run build`
Expected: Build succeeds without TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add lib/cache-tags.ts
git commit -m "feat(cache): add BRIEFINGS tag for upcoming briefings feature"
```

---

## Task 2: Database schema — `briefings` table

**Files:**
- Create: `supabase/schemas/20_briefings.sql`

- [ ] **Step 1: Write the schema file**

Create `supabase/schemas/20_briefings.sql`:

```sql
create table if not exists "public"."briefings" (
  "id" bigint generated always as identity not null,
  "brand_id" bigint not null,
  "briefing_number" integer not null,
  "semana" integer,
  "mes" integer,
  "ano" integer,
  "ref_url" text,
  "take_inicial" text,
  "fala_inicial" text,
  "conceito" text,
  "produtos" text[] not null default '{}',
  "source" text not null default 'docs',
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

- [ ] **Step 2: Commit**

```bash
git add supabase/schemas/20_briefings.sql
git commit -m "feat(schema): add briefings table"
```

---

## Task 3: Database schema — `briefing_assignments` table

**Files:**
- Create: `supabase/schemas/21_briefing_assignments.sql`

- [ ] **Step 1: Write the schema file**

Create `supabase/schemas/21_briefing_assignments.sql`:

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

- [ ] **Step 2: Commit**

```bash
git add supabase/schemas/21_briefing_assignments.sql
git commit -m "feat(schema): add briefing_assignments table"
```

---

## Task 4: Database view — `briefing_with_status`

**Files:**
- Create: `supabase/schemas/22_briefing_with_status.sql`

- [ ] **Step 1: Write the view**

Create `supabase/schemas/22_briefing_with_status.sql`:

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

- [ ] **Step 2: Commit**

```bash
git add supabase/schemas/22_briefing_with_status.sql
git commit -m "feat(schema): add briefing_with_status view"
```

---

## Task 5: Generate migration & apply locally

**Files:**
- Create: `supabase/migrations/<timestamp>_add_briefings_tables.sql` (auto-generated)

- [ ] **Step 1: Make sure local Supabase is running**

Run: `supabase status`
Expected: Lists running services. If not running: `supabase start`.

- [ ] **Step 2: Generate the migration from declarative schemas**

Run: `supabase db diff -f add_briefings_tables`
Expected: Creates a new file `supabase/migrations/<timestamp>_add_briefings_tables.sql` containing only the new tables, indexes, and view. No `ALTER` statements on existing tables.

- [ ] **Step 3: Review the generated migration**

Open the new migration file and verify:
- Only `CREATE TABLE briefings`, `CREATE TABLE briefing_assignments`, `CREATE VIEW briefing_with_status`
- All `ALTER TABLE … ADD CONSTRAINT` statements refer only to the new tables
- No drops or alters of existing tables

If the migration includes anything unexpected (e.g., reorderings of existing tables), STOP and investigate before applying.

- [ ] **Step 4: Apply migration locally**

Run: `supabase migration up`
Expected: Migration applies successfully. The local DB now has the new tables and view.

- [ ] **Step 5: Verify in local DB**

Run:
```bash
supabase db dump --local --schema public --data-only=false | grep -E "briefings|briefing_assignments|briefing_with_status"
```
Expected: Lines mentioning the three new objects.

- [ ] **Step 6: Verify existing app still works**

Start dev server in a separate terminal: `npm run dev`. Open `http://localhost:3000/dashboard/pautas` (login with `teste@gocreators.com` / `teste123456`). Confirm the existing analytics page renders unchanged. Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(schema): generate migration for briefings tables"
```

---

## Task 6: Zod schemas & TypeScript types

**Files:**
- Create: `lib/schemas/briefing.ts`

- [ ] **Step 1: Write the Zod schemas**

Create `lib/schemas/briefing.ts`:

```typescript
import { z } from "zod";

export const BRIEFING_STATUSES = [
  "pendente",
  "em_andamento",
  "concluido",
  "cancelado",
] as const;

export const BRIEFING_AGGREGATE_STATUSES = [
  "nao_alocada",
  "pendente",
  "em_andamento",
  "parcialmente_concluida",
  "concluida",
  "cancelada",
] as const;

export type BriefingStatus = (typeof BRIEFING_STATUSES)[number];
export type BriefingAggregateStatus = (typeof BRIEFING_AGGREGATE_STATUSES)[number];

export type Briefing = {
  id: number;
  brand_id: number;
  briefing_number: number;
  semana: number | null;
  mes: number | null;
  ano: number | null;
  ref_url: string | null;
  take_inicial: string | null;
  fala_inicial: string | null;
  conceito: string | null;
  produtos: string[];
  source: "docs" | "native";
  source_doc_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BriefingWithStatus = Briefing & {
  assignment_count: number;
  pending_count: number;
  in_progress_count: number;
  completed_count: number;
  cancelled_count: number;
  aggregate_status: BriefingAggregateStatus;
};

export type BriefingAssignment = {
  id: number;
  briefing_id: number;
  creator_id: number;
  variante: string | null;
  status: BriefingStatus;
  delivered_url: string | null;
  assigned_at: string;
  assigned_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type BriefingAssignmentWithCreator = BriefingAssignment & {
  creator_name: string;
};

export const assignCreatorsSchema = z.object({
  briefingId: z.number().int().positive(),
  creators: z
    .array(
      z.object({
        creatorId: z.number().int().positive(),
        variante: z.string().max(200).nullable().optional(),
      }),
    )
    .min(1, "Selecione ao menos um creator"),
});
export type AssignCreatorsInput = z.infer<typeof assignCreatorsSchema>;

export const updateAssignmentStatusSchema = z
  .object({
    assignmentId: z.number().int().positive(),
    status: z.enum(BRIEFING_STATUSES),
    deliveredUrl: z.string().url("URL inválida").nullable().optional(),
  })
  .refine(
    (data) =>
      data.status !== "concluido" ||
      (data.deliveredUrl != null && data.deliveredUrl.length > 0),
    {
      message: "URL da entrega é obrigatória ao marcar como Concluído",
      path: ["deliveredUrl"],
    },
  );
export type UpdateAssignmentStatusInput = z.infer<typeof updateAssignmentStatusSchema>;

export const removeAssignmentSchema = z.object({
  assignmentId: z.number().int().positive(),
});
export type RemoveAssignmentInput = z.infer<typeof removeAssignmentSchema>;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/briefing.ts
git commit -m "feat(schemas): add Zod schemas and types for briefings"
```

---

## Task 7: Cached read queries

**Files:**
- Create: `lib/queries/briefings.ts`

- [ ] **Step 1: Write the queries module**

Create `lib/queries/briefings.ts`:

```typescript
import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type {
  BriefingWithStatus,
  BriefingAssignmentWithCreator,
} from "@/lib/schemas/briefing";

export type BriefingFilters = {
  status?: string[];        // aggregate_status values
  mes?: number | null;
  ano?: number | null;
  q?: string | null;        // search across briefing_number, take_inicial, fala_inicial
};

const _getBriefingsCached = unstable_cache(
  async (
    brandId: number,
    statuses: string[] | null,
    mes: number | null,
    ano: number | null,
    q: string | null,
  ): Promise<BriefingWithStatus[]> => {
    const supabase = createStaticClient();
    let query = supabase
      .from("briefing_with_status")
      .select("*")
      .eq("brand_id", brandId);

    if (statuses && statuses.length > 0) {
      query = query.in("aggregate_status", statuses);
    }
    if (typeof mes === "number") {
      query = query.eq("mes", mes);
    }
    if (typeof ano === "number") {
      query = query.eq("ano", ano);
    }
    if (q && q.length > 0) {
      const numeric = Number(q);
      if (Number.isInteger(numeric) && numeric > 0) {
        query = query.eq("briefing_number", numeric);
      } else {
        query = query.or(
          `take_inicial.ilike.%${q}%,fala_inicial.ilike.%${q}%`,
        );
      }
    }

    const { data, error } = await query.order("briefing_number", {
      ascending: false,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as BriefingWithStatus[];
  },
  ["briefings-list"],
  { tags: [CACHE_TAGS.BRIEFINGS, CACHE_TAGS.BRANDS] },
);

export async function getBriefings(
  brandId: number,
  filters: BriefingFilters = {},
): Promise<BriefingWithStatus[]> {
  return _getBriefingsCached(
    brandId,
    filters.status && filters.status.length > 0 ? filters.status : null,
    typeof filters.mes === "number" ? filters.mes : null,
    typeof filters.ano === "number" ? filters.ano : null,
    filters.q ?? null,
  );
}

const _getBriefingDetailCached = unstable_cache(
  async (
    briefingId: number,
  ): Promise<{
    briefing: BriefingWithStatus;
    assignments: BriefingAssignmentWithCreator[];
  } | null> => {
    const supabase = createStaticClient();

    const { data: briefing, error: briefingError } = await supabase
      .from("briefing_with_status")
      .select("*")
      .eq("id", briefingId)
      .maybeSingle();
    if (briefingError) throw new Error(briefingError.message);
    if (!briefing) return null;

    const { data: assignments, error: assignmentsError } = await supabase
      .from("briefing_assignments")
      .select("*, creators(full_name)")
      .eq("briefing_id", briefingId)
      .order("assigned_at", { ascending: true });
    if (assignmentsError) throw new Error(assignmentsError.message);

    const mapped: BriefingAssignmentWithCreator[] = (assignments ?? []).map(
      (a) => ({
        id: a.id,
        briefing_id: a.briefing_id,
        creator_id: a.creator_id,
        variante: a.variante,
        status: a.status,
        delivered_url: a.delivered_url,
        assigned_at: a.assigned_at,
        assigned_by: a.assigned_by,
        updated_at: a.updated_at,
        updated_by: a.updated_by,
        creator_name:
          (a.creators as unknown as { full_name: string } | null)?.full_name ??
          "",
      }),
    );

    return {
      briefing: briefing as BriefingWithStatus,
      assignments: mapped,
    };
  },
  ["briefing-detail"],
  { tags: [CACHE_TAGS.BRIEFINGS] },
);

export async function getBriefingDetail(briefingId: number) {
  return _getBriefingDetailCached(briefingId);
}

const _getAllocatableCreatorsCached = unstable_cache(
  async (
    brandId: number,
  ): Promise<{ creatorId: number; creatorName: string }[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_brands")
      .select("creator_id, creators(full_name)")
      .eq("brand_id", brandId)
      .order("creator_id");
    if (error) throw new Error(error.message);
    const seen = new Set<number>();
    const out: { creatorId: number; creatorName: string }[] = [];
    for (const row of data ?? []) {
      if (seen.has(row.creator_id)) continue;
      seen.add(row.creator_id);
      out.push({
        creatorId: row.creator_id,
        creatorName:
          (row.creators as unknown as { full_name: string } | null)
            ?.full_name ?? "",
      });
    }
    return out.sort((a, b) => a.creatorName.localeCompare(b.creatorName));
  },
  ["briefings-allocatable-creators"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getAllocatableCreators(brandId: number) {
  return _getAllocatableCreatorsCached(brandId);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/briefings.ts
git commit -m "feat(queries): add cached read queries for briefings"
```

---

## Task 8: Edge Function — `ingest-briefing`

**Files:**
- Create: `supabase/functions/ingest-briefing/types.ts`
- Create: `supabase/functions/ingest-briefing/index.ts`

- [ ] **Step 1: Write the types**

Create `supabase/functions/ingest-briefing/types.ts`:

```typescript
export type IngestBriefingPayload = {
  brand_id: number;
  source_doc_id?: string | null;
  briefings: IncomingBriefing[];
};

export type IncomingBriefing = {
  briefing_number: number;
  semana?: number | null;
  mes?: number | null;
  ano?: number | null;
  ref_url?: string | null;
  take_inicial?: string | null;
  fala_inicial?: string | null;
  conceito?: string | null;
  produtos?: string[] | null;
};

export type IngestError = {
  briefing_number: number | null;
  reason: string;
};

export type IngestResponse = {
  received: number;
  inserted: number;
  updated: number;
  errors: IngestError[];
};
```

- [ ] **Step 2: Write the Edge Function**

Create `supabase/functions/ingest-briefing/index.ts`:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
  IngestBriefingPayload,
  IncomingBriefing,
  IngestError,
  IngestResponse,
} from "./types.ts";

const MAX_BATCH = 500;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("INGEST_BRIEFING_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!expectedSecret || !supabaseUrl || !supabaseServiceRoleKey) {
    return json({ error: "Server is misconfigured" }, 500);
  }

  const providedSecret = req.headers.get("x-ingest-secret");
  if (!providedSecret || providedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: IngestBriefingPayload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Body must be an object" }, 400);
  }

  if (typeof body.brand_id !== "number" || !Number.isInteger(body.brand_id)) {
    return json({ error: "brand_id must be an integer" }, 400);
  }

  if (!Array.isArray(body.briefings)) {
    return json({ error: "briefings must be an array" }, 400);
  }

  if (body.briefings.length > MAX_BATCH) {
    return json(
      { error: `Batch too large (max ${MAX_BATCH})` },
      400,
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data: brandRow } = await supabase
    .from("brands")
    .select("id")
    .eq("id", body.brand_id)
    .maybeSingle();

  if (!brandRow) {
    return json({ error: `Brand ${body.brand_id} not found` }, 400);
  }

  const errors: IngestError[] = [];
  const validRows: ReturnType<typeof toRow>[] = [];

  for (const incoming of body.briefings) {
    const validation = validateBriefing(incoming);
    if (validation.error) {
      errors.push({
        briefing_number:
          typeof incoming?.briefing_number === "number"
            ? incoming.briefing_number
            : null,
        reason: validation.error,
      });
      continue;
    }
    validRows.push(toRow(body.brand_id, body.source_doc_id ?? null, incoming));
  }

  let inserted = 0;
  let updated = 0;

  if (validRows.length > 0) {
    const numbers = validRows.map((r) => r.briefing_number);

    const { data: existing } = await supabase
      .from("briefings")
      .select("briefing_number")
      .eq("brand_id", body.brand_id)
      .in("briefing_number", numbers);

    const existingSet = new Set(
      (existing ?? []).map((row) => row.briefing_number),
    );

    const { error: upsertError } = await supabase
      .from("briefings")
      .upsert(validRows, { onConflict: "brand_id,briefing_number" });

    if (upsertError) {
      return json(
        { error: `Database error: ${upsertError.message}` },
        500,
      );
    }

    for (const row of validRows) {
      if (existingSet.has(row.briefing_number)) {
        updated++;
      } else {
        inserted++;
      }
    }
  }

  // Fire-and-forget cache invalidation. Failures are non-fatal.
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
        body: JSON.stringify({ tags: ["briefings"] }),
      });
    } catch (e) {
      console.error("Failed to revalidate Next.js cache:", e);
    }
  }

  const response: IngestResponse = {
    received: body.briefings.length,
    inserted,
    updated,
    errors,
  };
  return json(response, 200);
});

function validateBriefing(b: IncomingBriefing | null | undefined): {
  error: string | null;
} {
  if (!b || typeof b !== "object") return { error: "Briefing not an object" };
  if (typeof b.briefing_number !== "number" || !Number.isInteger(b.briefing_number) || b.briefing_number < 1) {
    return { error: "briefing_number must be a positive integer" };
  }
  if (b.mes != null && (typeof b.mes !== "number" || b.mes < 1 || b.mes > 12)) {
    return { error: "mes must be between 1 and 12" };
  }
  if (b.semana != null && (typeof b.semana !== "number" || !Number.isInteger(b.semana))) {
    return { error: "semana must be an integer" };
  }
  if (b.ano != null && (typeof b.ano !== "number" || !Number.isInteger(b.ano))) {
    return { error: "ano must be an integer" };
  }
  if (b.produtos != null && !Array.isArray(b.produtos)) {
    return { error: "produtos must be an array of strings" };
  }
  return { error: null };
}

function toRow(brandId: number, sourceDocId: string | null, b: IncomingBriefing) {
  return {
    brand_id: brandId,
    briefing_number: b.briefing_number,
    semana: b.semana ?? null,
    mes: b.mes ?? null,
    ano: b.ano ?? null,
    ref_url: b.ref_url ?? null,
    take_inicial: b.take_inicial ?? null,
    fala_inicial: b.fala_inicial ?? null,
    conceito: b.conceito ?? null,
    produtos: b.produtos ?? [],
    source: "docs",
    source_doc_id: sourceDocId,
    updated_at: new Date().toISOString(),
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ingest-briefing/
git commit -m "feat(edge): add ingest-briefing function"
```

---

## Task 9: Smoke-test the Edge Function locally

**Files:** None modified. Verification only.

- [ ] **Step 1: Add INGEST_BRIEFING_SECRET to local env**

Edit `supabase/.env` and add (replace the value with anything; this is local-only):

```
INGEST_BRIEFING_SECRET=local-test-secret-please-rotate-in-prod
NEXT_APP_URL=http://localhost:3000
```

(`REVALIDATE_SECRET` should already be set per existing patterns.)

- [ ] **Step 2: Serve functions locally**

Run in a separate terminal: `supabase functions serve --no-verify-jwt`
Expected: Reports the function URL `http://localhost:54321/functions/v1/ingest-briefing`.

- [ ] **Step 3: Send a happy-path request**

Replace `<BRAND_ID>` with a real brand id from your local DB (find one via `supabase db query "select id, name from brands limit 5"` or just query the dashboard UI).

Run:
```bash
curl -i -X POST http://localhost:54321/functions/v1/ingest-briefing \
  -H "Content-Type: application/json" \
  -H "x-ingest-secret: local-test-secret-please-rotate-in-prod" \
  -d '{
    "brand_id": <BRAND_ID>,
    "source_doc_id": "test-doc-id",
    "briefings": [
      {
        "briefing_number": 9001,
        "semana": 1,
        "mes": 5,
        "ano": 2026,
        "ref_url": "https://example.com/ref",
        "take_inicial": "Test take",
        "fala_inicial": "Test fala",
        "conceito": "Test conceito",
        "produtos": ["Livre"]
      }
    ]
  }'
```

Expected: `HTTP/1.1 200 OK` and JSON body `{"received":1,"inserted":1,"updated":0,"errors":[]}`.

- [ ] **Step 4: Send the same request again (idempotency)**

Re-run the same curl command.
Expected: Body becomes `{"received":1,"inserted":0,"updated":1,"errors":[]}`.

- [ ] **Step 5: Send invalid request (missing secret)**

```bash
curl -i -X POST http://localhost:54321/functions/v1/ingest-briefing \
  -H "Content-Type: application/json" \
  -d '{"brand_id":1,"briefings":[]}'
```

Expected: `HTTP/1.1 401 Unauthorized`.

- [ ] **Step 6: Send invalid briefing (bad month)**

```bash
curl -s -X POST http://localhost:54321/functions/v1/ingest-briefing \
  -H "Content-Type: application/json" \
  -H "x-ingest-secret: local-test-secret-please-rotate-in-prod" \
  -d '{
    "brand_id": <BRAND_ID>,
    "briefings": [
      { "briefing_number": 9002, "mes": 13 }
    ]
  }'
```

Expected: 200 OK with `{"received":1,"inserted":0,"updated":0,"errors":[{"briefing_number":9002,"reason":"mes must be between 1 and 12"}]}`.

- [ ] **Step 7: Clean up the test row before committing (optional)**

```bash
supabase db query "delete from briefings where source_doc_id = 'test-doc-id'"
```

- [ ] **Step 8: Stop the functions server**

In the functions-serve terminal, press Ctrl+C.

(Nothing to commit in this task — it's verification only.)

---

## Task 10: Server Action — list, detail, allocatable creators

**Files:**
- Create: `app/dashboard/briefings/actions.ts`

- [ ] **Step 1: Write read-side server actions**

Create `app/dashboard/briefings/actions.ts`:

```typescript
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getBrands as _getBrands } from "@/lib/queries/brands";
import {
  getBriefings as _getBriefings,
  getBriefingDetail as _getBriefingDetail,
  getAllocatableCreators as _getAllocatableCreators,
  type BriefingFilters,
} from "@/lib/queries/briefings";
import {
  assignCreatorsSchema,
  updateAssignmentStatusSchema,
  removeAssignmentSchema,
  type AssignCreatorsInput,
  type UpdateAssignmentStatusInput,
  type RemoveAssignmentInput,
} from "@/lib/schemas/briefing";

// ============ READS ============

export async function getBrands() {
  return _getBrands();
}

export async function getBriefings(
  brandId: number,
  filters: BriefingFilters = {},
) {
  return _getBriefings(brandId, filters);
}

export async function getBriefingDetail(briefingId: number) {
  return _getBriefingDetail(briefingId);
}

export async function getAllocatableCreators(brandId: number) {
  return _getAllocatableCreators(brandId);
}

// ============ MUTATIONS ============

export async function assignCreatorsToBriefing(
  input: AssignCreatorsInput,
): Promise<{ success: true; createdCount: number } | { success: false; error: string }> {
  const parsed = assignCreatorsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const nowIso = new Date().toISOString();
  const rows = parsed.data.creators.map((c) => ({
    briefing_id: parsed.data.briefingId,
    creator_id: c.creatorId,
    variante: c.variante ?? null,
    status: "pendente" as const,
    assigned_at: nowIso,
    assigned_by: user.id,
    updated_at: nowIso,
    updated_by: user.id,
  }));

  const { data, error } = await supabase
    .from("briefing_assignments")
    .upsert(rows, {
      onConflict: "briefing_id,creator_id",
      ignoreDuplicates: false,
    })
    .select("id");

  if (error) return { success: false, error: error.message };

  revalidateTag(CACHE_TAGS.BRIEFINGS);
  revalidatePath("/dashboard/briefings");
  return { success: true, createdCount: data?.length ?? 0 };
}

export async function updateAssignmentStatus(
  input: UpdateAssignmentStatusInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = updateAssignmentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("briefing_assignments")
    .update({
      status: parsed.data.status,
      delivered_url:
        parsed.data.status === "concluido"
          ? parsed.data.deliveredUrl ?? null
          : null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", parsed.data.assignmentId);

  if (error) return { success: false, error: error.message };

  revalidateTag(CACHE_TAGS.BRIEFINGS);
  revalidatePath("/dashboard/briefings");
  return { success: true };
}

export async function removeAssignment(
  input: RemoveAssignmentInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = removeAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("briefing_assignments")
    .select("status")
    .eq("id", parsed.data.assignmentId)
    .maybeSingle();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!existing) return { success: false, error: "Alocação não encontrada" };

  if (existing.status !== "pendente" && existing.status !== "cancelado") {
    return {
      success: false,
      error:
        "Para remover, primeiro mude o status para Cancelado (em andamento e concluídas preservam histórico)",
    };
  }

  const { error: deleteError } = await supabase
    .from("briefing_assignments")
    .delete()
    .eq("id", parsed.data.assignmentId);

  if (deleteError) return { success: false, error: deleteError.message };

  revalidateTag(CACHE_TAGS.BRIEFINGS);
  revalidatePath("/dashboard/briefings");
  return { success: true };
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/briefings/actions.ts
git commit -m "feat(actions): add briefings server actions (read + mutations)"
```

---

## Task 11: Status badge component

**Files:**
- Create: `components/briefing-status-badge.tsx`

- [ ] **Step 1: Write the badge**

Create `components/briefing-status-badge.tsx`:

```typescript
import { Badge } from "@/components/ui/badge";
import type {
  BriefingAggregateStatus,
  BriefingStatus,
} from "@/lib/schemas/briefing";

const AGG_LABELS: Record<BriefingAggregateStatus, string> = {
  nao_alocada: "Não alocada",
  pendente: "Pendente",
  em_andamento: "Em andamento",
  parcialmente_concluida: "Parcial",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const AGG_VARIANTS: Record<BriefingAggregateStatus, "default" | "secondary" | "destructive" | "outline"> = {
  nao_alocada: "outline",
  pendente: "secondary",
  em_andamento: "default",
  parcialmente_concluida: "default",
  concluida: "default",
  cancelada: "destructive",
};

const ASSIGNMENT_LABELS: Record<BriefingStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const ASSIGNMENT_VARIANTS: Record<BriefingStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pendente: "secondary",
  em_andamento: "default",
  concluido: "default",
  cancelado: "destructive",
};

export function BriefingAggregateBadge({ status }: { status: BriefingAggregateStatus }) {
  return <Badge variant={AGG_VARIANTS[status]}>{AGG_LABELS[status]}</Badge>;
}

export function BriefingAssignmentBadge({ status }: { status: BriefingStatus }) {
  return <Badge variant={ASSIGNMENT_VARIANTS[status]}>{ASSIGNMENT_LABELS[status]}</Badge>;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/briefing-status-badge.tsx
git commit -m "feat(ui): add briefing status badge components"
```

---

## Task 12: Page skeleton, loading, and management table

**Files:**
- Create: `app/dashboard/briefings/loading.tsx`
- Create: `app/dashboard/briefings/page.tsx`
- Create: `components/briefing-management-table.tsx`

- [ ] **Step 1: Write loading skeleton**

Create `app/dashboard/briefings/loading.tsx`:

```typescript
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-[480px] w-full" />
    </div>
  );
}
```

- [ ] **Step 2: Write the management table component**

Create `components/briefing-management-table.tsx`:

```typescript
"use client";

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BriefingAggregateBadge } from "@/components/briefing-status-badge";
import { BriefingDetailSheet } from "@/components/briefing-detail-sheet";
import type { BriefingWithStatus } from "@/lib/schemas/briefing";

type Brand = { id: number; name: string };

const STATUS_OPTIONS: {
  value: string;
  label: string;
  group: "ativo" | "concluido";
}[] = [
  { value: "nao_alocada", label: "Não alocada", group: "ativo" },
  { value: "pendente", label: "Pendente", group: "ativo" },
  { value: "em_andamento", label: "Em andamento", group: "ativo" },
  { value: "parcialmente_concluida", label: "Parcial", group: "ativo" },
  { value: "concluida", label: "Concluída", group: "concluido" },
  { value: "cancelada", label: "Cancelada", group: "concluido" },
];

export function BriefingManagementTable({
  brands,
  selectedBrandId,
  briefings,
}: {
  brands: Brand[];
  selectedBrandId: number | null;
  briefings: BriefingWithStatus[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = useState<number | null>(null);

  const currentStatusFilter = searchParams.get("status") ?? "ativos";
  const currentMes = searchParams.get("mes") ?? "";
  const currentAno = searchParams.get("ano") ?? "";
  const currentQ = searchParams.get("q") ?? "";

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
    router.push(`?${params.toString()}`);
  }

  const filteredBriefings = useMemo(() => briefings, [briefings]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedBrandId?.toString() ?? ""}
          onValueChange={(v) => updateParam("brand", v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Marca" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id.toString()}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={currentStatusFilter}
          onValueChange={(v) => updateParam("status", v === "ativos" ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos (default)</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="number"
          placeholder="Mês"
          className="w-[100px]"
          value={currentMes}
          onChange={(e) => updateParam("mes", e.target.value || null)}
          min={1}
          max={12}
        />
        <Input
          type="number"
          placeholder="Ano"
          className="w-[120px]"
          value={currentAno}
          onChange={(e) => updateParam("ano", e.target.value || null)}
        />
        <Input
          placeholder="Buscar (nº, take, fala)"
          className="w-[280px]"
          value={currentQ}
          onChange={(e) => updateParam("q", e.target.value || null)}
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Nº</TableHead>
            <TableHead>Take inicial</TableHead>
            <TableHead className="w-[160px]">Produto</TableHead>
            <TableHead className="w-[100px]">Sem/Mês</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[100px] text-right">Alocados</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredBriefings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma pauta encontrada para os filtros atuais.
              </TableCell>
            </TableRow>
          ) : (
            filteredBriefings.map((b) => {
              const completedFraction = b.assignment_count > 0
                ? `${b.completed_count}/${b.assignment_count}`
                : "—";
              const semMes = [b.semana, b.mes].filter((v) => v != null).join("/");
              return (
                <TableRow
                  key={b.id}
                  className="cursor-pointer"
                  onClick={() => setOpenId(b.id)}
                >
                  <TableCell className="font-mono">{b.briefing_number}</TableCell>
                  <TableCell className="max-w-[280px] truncate">
                    {b.take_inicial ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">
                    {b.produtos.length > 0 ? b.produtos.join(", ") : "—"}
                  </TableCell>
                  <TableCell>{semMes || "—"}</TableCell>
                  <TableCell>
                    <BriefingAggregateBadge status={b.aggregate_status} />
                  </TableCell>
                  <TableCell className="text-right">{completedFraction}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenId(b.id);
                      }}
                    >
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <BriefingDetailSheet
        briefingId={openId}
        brandId={selectedBrandId}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      />
    </div>
  );
}
```

- [ ] **Step 3: Write the page**

Create `app/dashboard/briefings/page.tsx`:

```typescript
import { getBrands, getBriefings } from "./actions";
import { BriefingManagementTable } from "@/components/briefing-management-table";
import type { BriefingFilters } from "@/lib/queries/briefings";

const ACTIVE_STATUSES = [
  "nao_alocada",
  "pendente",
  "em_andamento",
  "parcialmente_concluida",
];

export default async function BriefingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    brand?: string;
    status?: string;
    mes?: string;
    ano?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const brands = await getBrands();
  const selectedBrandId = params.brand
    ? Number(params.brand)
    : brands[0]?.id ?? null;

  let statuses: string[] | undefined;
  if (!params.status || params.status === "ativos") {
    statuses = ACTIVE_STATUSES;
  } else if (params.status === "todos") {
    statuses = undefined;
  } else {
    statuses = [params.status];
  }

  const filters: BriefingFilters = {
    status: statuses,
    mes: params.mes ? Number(params.mes) : null,
    ano: params.ano ? Number(params.ano) : null,
    q: params.q ?? null,
  };

  const briefings = selectedBrandId
    ? await getBriefings(selectedBrandId, filters).catch((err) => {
        console.error("Failed to load briefings:", err);
        return [];
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Pautas</h1>
      </div>
      <BriefingManagementTable
        brands={brands}
        selectedBrandId={selectedBrandId}
        briefings={briefings}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verify build (will fail until Task 13 — that's expected)**

Run: `npm run build`
Expected: Fails with `Cannot find module '@/components/briefing-detail-sheet'` — we wire that up next.

- [ ] **Step 5: Commit (WIP — page references missing component)**

```bash
git add app/dashboard/briefings/ components/briefing-management-table.tsx
git commit -m "feat(ui): add briefings page and management table (WIP)"
```

---

## Task 13: Detail sheet (drawer) component

**Files:**
- Create: `components/briefing-detail-sheet.tsx`

- [ ] **Step 1: Write the detail sheet**

Create `components/briefing-detail-sheet.tsx`:

```typescript
"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { BriefingAggregateBadge } from "@/components/briefing-status-badge";
import { BriefingAssignmentRow } from "@/components/briefing-assignment-row";
import { BriefingAllocationForm } from "@/components/briefing-allocation-form";
import {
  getBriefingDetail,
  getAllocatableCreators,
} from "@/app/dashboard/briefings/actions";
import type {
  BriefingAssignmentWithCreator,
  BriefingWithStatus,
} from "@/lib/schemas/briefing";

type DetailData = {
  briefing: BriefingWithStatus;
  assignments: BriefingAssignmentWithCreator[];
} | null;

export function BriefingDetailSheet({
  briefingId,
  brandId,
  onOpenChange,
}: {
  briefingId: number | null;
  brandId: number | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<DetailData>(null);
  const [creators, setCreators] = useState<
    { creatorId: number; creatorName: string }[]
  >([]);
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const open = briefingId != null;

  useEffect(() => {
    if (!open || !briefingId) {
      setData(null);
      return;
    }
    setLoading(true);
    Promise.all([
      getBriefingDetail(briefingId),
      brandId ? getAllocatableCreators(brandId) : Promise.resolve([]),
    ])
      .then(([detail, allocatable]) => {
        setData(detail);
        setCreators(allocatable);
      })
      .finally(() => setLoading(false));
  }, [open, briefingId, brandId]);

  function refresh() {
    if (!briefingId) return;
    startTransition(async () => {
      const detail = await getBriefingDetail(briefingId);
      setData(detail);
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {data ? `Pauta ${data.briefing.briefing_number}` : "Pauta"}
          </SheetTitle>
          <SheetDescription>
            {data ? (
              <span className="flex items-center gap-2">
                <BriefingAggregateBadge status={data.briefing.aggregate_status} />
                <span className="text-sm text-muted-foreground">
                  {data.briefing.completed_count}/{data.briefing.assignment_count} entregues
                </span>
              </span>
            ) : (
              "Carregando..."
            )}
          </SheetDescription>
        </SheetHeader>

        {loading || !data ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <DetailSection label="Take inicial" value={data.briefing.take_inicial} />
            <DetailSection label="Fala inicial" value={data.briefing.fala_inicial} />
            <DetailSection label="Conceito" value={data.briefing.conceito} />
            <DetailSection
              label="Produtos"
              value={data.briefing.produtos.join(", ") || null}
            />
            {data.briefing.ref_url ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Referência
                </div>
                <a
                  href={data.briefing.ref_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
                >
                  {data.briefing.ref_url}
                </a>
              </div>
            ) : null}

            <Separator />

            <div>
              <h3 className="text-sm font-semibold mb-3">Alocações</h3>
              {data.assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma creator alocada ainda.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.assignments.map((a) => (
                    <BriefingAssignmentRow
                      key={a.id}
                      assignment={a}
                      onChange={refresh}
                    />
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <BriefingAllocationForm
              briefingId={data.briefing.id}
              creators={creators}
              alreadyAllocatedCreatorIds={new Set(
                data.assignments.map((a) => a.creator_id),
              )}
              onSuccess={refresh}
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSection({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value || "—"}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/briefing-detail-sheet.tsx
git commit -m "feat(ui): add briefing detail sheet drawer"
```

---

## Task 14: Assignment row (status select + delivered URL + remove)

**Files:**
- Create: `components/briefing-assignment-row.tsx`

- [ ] **Step 1: Write the assignment row**

Create `components/briefing-assignment-row.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BriefingAssignmentBadge } from "@/components/briefing-status-badge";
import {
  updateAssignmentStatus,
  removeAssignment,
} from "@/app/dashboard/briefings/actions";
import {
  BRIEFING_STATUSES,
  type BriefingAssignmentWithCreator,
  type BriefingStatus,
} from "@/lib/schemas/briefing";

const STATUS_LABELS: Record<BriefingStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function BriefingAssignmentRow({
  assignment,
  onChange,
}: {
  assignment: BriefingAssignmentWithCreator;
  onChange: () => void;
}) {
  const [status, setStatus] = useState<BriefingStatus>(assignment.status);
  const [deliveredUrl, setDeliveredUrl] = useState(
    assignment.delivered_url ?? "",
  );
  const [editingUrl, setEditingUrl] = useState(false);
  const [isPending, startTransition] = useTransition();

  function commit(newStatus: BriefingStatus, urlValue: string) {
    startTransition(async () => {
      const result = await updateAssignmentStatus({
        assignmentId: assignment.id,
        status: newStatus,
        deliveredUrl: newStatus === "concluido" ? urlValue || null : null,
      });
      if (result.success) {
        toast.success("Status atualizado");
        setEditingUrl(false);
        onChange();
      } else {
        toast.error(result.error);
        setStatus(assignment.status);
      }
    });
  }

  function handleStatusChange(value: string) {
    const newStatus = value as BriefingStatus;
    setStatus(newStatus);
    if (newStatus === "concluido" && !deliveredUrl) {
      setEditingUrl(true);
      return;
    }
    commit(newStatus, deliveredUrl);
  }

  function handleRemove() {
    if (
      !confirm(
        `Remover alocação de ${assignment.creator_name}? Só funciona em pendente/cancelado.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await removeAssignment({ assignmentId: assignment.id });
      if (result.success) {
        toast.success("Alocação removida");
        onChange();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{assignment.creator_name}</span>
          {assignment.variante ? (
            <span className="text-xs text-muted-foreground truncate">
              ({assignment.variante})
            </span>
          ) : null}
        </div>
        <BriefingAssignmentBadge status={status} />
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={status}
          onValueChange={handleStatusChange}
          disabled={isPending}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRIEFING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {editingUrl || (status === "concluido" && deliveredUrl) ? (
          <Input
            placeholder="URL da entrega"
            className="flex-1"
            value={deliveredUrl}
            onChange={(e) => setDeliveredUrl(e.target.value)}
            onBlur={() => {
              if (status === "concluido") commit(status, deliveredUrl);
            }}
          />
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={isPending}
        >
          Remover
        </Button>
      </div>

      {status === "concluido" && deliveredUrl ? (
        <a
          href={deliveredUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 hover:underline truncate"
        >
          {deliveredUrl}
        </a>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/briefing-assignment-row.tsx
git commit -m "feat(ui): add briefing assignment row with inline editing"
```

---

## Task 15: Allocation form (multi-creator combobox)

**Files:**
- Create: `components/briefing-allocation-form.tsx`

- [ ] **Step 1: Write the allocation form**

Create `components/briefing-allocation-form.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { assignCreatorsToBriefing } from "@/app/dashboard/briefings/actions";

type CreatorOption = { creatorId: number; creatorName: string };

type Pending = { creatorId: number; creatorName: string; variante: string };

export function BriefingAllocationForm({
  briefingId,
  creators,
  alreadyAllocatedCreatorIds,
  onSuccess,
}: {
  briefingId: number;
  creators: CreatorOption[];
  alreadyAllocatedCreatorIds: Set<number>;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [isPending, startTransition] = useTransition();

  const available = creators.filter(
    (c) =>
      !alreadyAllocatedCreatorIds.has(c.creatorId) &&
      !pending.some((p) => p.creatorId === c.creatorId),
  );

  function add(c: CreatorOption) {
    setPending([...pending, { ...c, variante: "" }]);
    setOpen(false);
  }

  function remove(creatorId: number) {
    setPending(pending.filter((p) => p.creatorId !== creatorId));
  }

  function updateVariante(creatorId: number, variante: string) {
    setPending(
      pending.map((p) =>
        p.creatorId === creatorId ? { ...p, variante } : p,
      ),
    );
  }

  function submit() {
    if (pending.length === 0) return;
    startTransition(async () => {
      const result = await assignCreatorsToBriefing({
        briefingId,
        creators: pending.map((p) => ({
          creatorId: p.creatorId,
          variante: p.variante.trim() || null,
        })),
      });
      if (result.success) {
        toast.success(`${pending.length} alocaç${pending.length > 1 ? "ões" : "ão"} adicionada${pending.length > 1 ? "s" : ""}`);
        setPending([]);
        onSuccess();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Adicionar creators</h3>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between"
          >
            Selecionar creator...
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
          <Command>
            <CommandInput placeholder="Buscar creator..." />
            <CommandList>
              <CommandEmpty>Nenhuma creator disponível.</CommandEmpty>
              <CommandGroup>
                {available.map((c) => (
                  <CommandItem
                    key={c.creatorId}
                    onSelect={() => add(c)}
                  >
                    <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                    {c.creatorName}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {pending.length > 0 ? (
        <div className="space-y-2">
          {pending.map((p) => (
            <div
              key={p.creatorId}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <span className="text-sm font-medium flex-shrink-0">
                {p.creatorName}
              </span>
              <Input
                placeholder="Variante (opcional)"
                value={p.variante}
                onChange={(e) => updateVariante(p.creatorId, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(p.creatorId)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Salvando..." : `Alocar ${pending.length} creator${pending.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify build now succeeds**

Run: `npm run build`
Expected: Build succeeds — all imports resolve.

- [ ] **Step 3: Commit**

```bash
git add components/briefing-allocation-form.tsx
git commit -m "feat(ui): add multi-creator allocation form"
```

---

## Task 16: Sidebar entry

**Files:**
- Modify: `components/app-sidebar.tsx`

- [ ] **Step 1: Add the sidebar entry**

Open `components/app-sidebar.tsx` and locate the import line (around line 3):

```typescript
import { LayoutDashboard, TableProperties, BarChart3, CalendarDays, UserPlus, Building2, History, DollarSign, ClipboardList } from "lucide-react";
```

Add `ScrollText` to the import:

```typescript
import { LayoutDashboard, TableProperties, BarChart3, CalendarDays, UserPlus, Building2, History, DollarSign, ClipboardList, ScrollText } from "lucide-react";
```

In the `navSections` array, find the `Gestão` section (its `items` array starts with "Gerenciar Creators"). Add the new item **before** the existing entries (or wherever you prefer — the spec says "before Sincronização"):

```typescript
{
  title: "Pautas (Gestão)",
  href: "/dashboard/briefings",
  icon: ScrollText,
},
```

The full updated `Gestão` section should look like:

```typescript
{
  label: "Gestão",
  items: [
    {
      title: "Pautas (Gestão)",
      href: "/dashboard/briefings",
      icon: ScrollText,
    },
    {
      title: "Gerenciar Creators",
      href: "/dashboard/creators/list",
      icon: UserPlus,
    },
    {
      title: "Marcas",
      href: "/dashboard/brands",
      icon: Building2,
    },
    {
      title: "Central de Custos",
      href: "/dashboard/costs",
      icon: DollarSign,
    },
    {
      title: "Sincronização",
      href: "/dashboard/sync",
      icon: History,
    },
  ],
},
```

**Do NOT modify the existing `Pautas` entry in the `Dashboards` group.** It must stay exactly as-is.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "feat(ui): add Pautas (Gestão) entry to sidebar"
```

---

## Task 17: End-to-end browser walkthrough

**Files:** None modified. Verification only.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Server up at http://localhost:3000.

- [ ] **Step 2: Login**

Open `http://localhost:3000/auth/login`. Sign in with `teste@gocreators.com` / `teste123456`.

- [ ] **Step 3: Confirm existing /dashboard/pautas is unchanged**

Navigate to `http://localhost:3000/dashboard/pautas`. Verify the analytics page renders with brand selector, table of guideline_number metrics, monthly filter, etc. — exactly the same as before this branch.

- [ ] **Step 4: Navigate to the new /dashboard/briefings**

Click the new "Pautas (Gestão)" entry in the sidebar (Gestão group).
Expected: Page loads with the title "Gestão de Pautas", brand selector populated, status filter defaulting to "Ativos", and an empty table (no briefings yet).

- [ ] **Step 5: Insert a test briefing via SQL**

In a separate terminal:
```bash
supabase db query "insert into briefings (brand_id, briefing_number, semana, mes, ano, take_inicial, fala_inicial, ref_url, produtos, source, source_doc_id) values ((select id from brands order by id limit 1), 9999, 1, 5, 2026, 'Take de teste', 'Fala de teste', 'https://example.com/ref', '{Livre}', 'docs', 'manual-test') on conflict do nothing;"
```

- [ ] **Step 6: Refresh the page**

Refresh the dashboard. The briefing 9999 should appear as "Não alocada".

- [ ] **Step 7: Open detail and allocate**

Click the row. Sheet opens on the right with content. Click "Selecionar creator..." → pick one. Add a variante (optional). Click "Alocar 1 creator".
Expected: Toast "1 alocação adicionada". The Alocações section shows the new row with status "Pendente".

- [ ] **Step 8: Change status to "Em andamento"**

In the assignment row, change the status select to "Em andamento".
Expected: Toast "Status atualizado". Top of the sheet now shows "Em andamento" badge.

- [ ] **Step 9: Change status to "Concluído"**

Change to "Concluído". URL input appears. Type a URL like `https://example.com/video`. Blur the input.
Expected: Toast "Status atualizado". Aggregate badge shows "Concluída".

- [ ] **Step 10: Try to remove the assignment**

Click "Remover" on the row.
Expected: Confirmation dialog. Click OK. Toast "Para remover, primeiro mude o status para Cancelado..." (because we're on `concluido`, not pendente/cancelado).

- [ ] **Step 11: Cancel the assignment then remove**

Change status to "Cancelado". Then click "Remover" → OK.
Expected: Toast "Alocação removida". Row disappears.

- [ ] **Step 12: Test filter — "Concluídas"**

Close the sheet. Change the Status filter to "Concluída".
Expected: Empty table (we removed the only assignment).

Reset filter to "Ativos". Briefing 9999 should be back in the list as "Não alocada".

- [ ] **Step 13: Test search**

Type `9999` in the search box.
Expected: Only briefing 9999 shows.

Type `teste` in the search box.
Expected: Only briefings with "teste" in take_inicial or fala_inicial show (just our test row).

- [ ] **Step 14: Clean up the test row**

```bash
supabase db query "delete from briefings where source_doc_id = 'manual-test'"
```

- [ ] **Step 15: Stop the dev server**

Ctrl+C in the dev server terminal.

(Nothing to commit — verification only.)

---

## Task 18: Apps Script reference (for user to deploy)

**Files:**
- Create: `scripts/sync-briefings-gocreators.gs`

This task creates a reference Apps Script file in the repo for the user to copy into their Google Docs. The user has the original File 3 (truncated in the brainstorming session) — they will paste the full File 3 parsing logic into the `extractBriefingsFromDoc_` function.

- [ ] **Step 1: Write the Apps Script template**

Create `scripts/sync-briefings-gocreators.gs`:

```javascript
/**
 * Apice — Sincronizar Pautas (Docs → Gocreators Supabase)
 *
 * Substitui o File 3 antigo (Docs → "Apice - Pautas" sheet).
 * Agora envia direto para a Edge Function ingest-briefing.
 *
 * Configuração obrigatória (Project Settings > Script properties):
 *   BRAND_ID       — id numérico da brand (ex: 7)
 *   INGEST_URL     — https://<project>.supabase.co/functions/v1/ingest-briefing
 *   INGEST_SECRET  — mesmo valor de INGEST_BRIEFING_SECRET na Edge Function
 *
 * Uso: menu "Gocreators > Sincronizar Pautas" no Docs.
 */

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
    DocumentApp.getUi().alert(
      'Configuração faltando: BRAND_ID, INGEST_URL ou INGEST_SECRET nos Script Properties.'
    );
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
    payload: JSON.stringify({
      brand_id: brandId,
      source_doc_id: docId,
      briefings: briefings,
    }),
    muteHttpExceptions: true,
  });

  const status = response.getResponseCode();
  let body;
  try {
    body = JSON.parse(response.getContentText() || '{}');
  } catch (e) {
    body = { error: response.getContentText() };
  }

  if (status !== 200) {
    DocumentApp.getUi().alert(
      'Falha (' + status + '): ' + (body.error || response.getContentText())
    );
    return;
  }

  let msg =
    'Sincronização concluída.\n\n' +
    'Recebidas: ' + body.received + '\n' +
    'Novas: ' + body.inserted + '\n' +
    'Atualizadas: ' + body.updated + '\n' +
    'Erros: ' + (body.errors ? body.errors.length : 0);

  if (body.errors && body.errors.length > 0) {
    msg += '\n\nDetalhes dos erros:\n';
    body.errors.slice(0, 10).forEach(function (e) {
      msg += '  • Pauta ' + (e.briefing_number || '?') + ': ' + e.reason + '\n';
    });
  }

  DocumentApp.getUi().alert(msg);
}

/**
 * Parse pautas from the Google Docs and return an array of briefing objects.
 *
 * GAP: This function currently returns an empty array. The user must paste
 * the full parsing logic from their existing File 3 (the message in the
 * brainstorming session was truncated at `const DOC_ID = '1bQ8rABZWcyvTKix...`).
 *
 * Each returned object should match this shape:
 *   {
 *     briefing_number: number,        // required
 *     semana: number | null,
 *     mes: number | null,             // 1-12
 *     ano: number | null,
 *     ref_url: string | null,
 *     take_inicial: string | null,
 *     fala_inicial: string | null,
 *     conceito: string | null,
 *     produtos: string[]              // [] if none
 *   }
 */
function extractBriefingsFromDoc_(docId) {
  // TODO: Paste File 3 parsing logic here. The existing logic iterates over
  // "PAUTA N" sections, extracts Take inicial / Fala inicial / Conceito /
  // Referências / Produtos, and parses Semana, Mês, Ano from "Nomeie o video
  // com..." text. Return an array shaped as described above.
  return [];
}
```

- [ ] **Step 2: Add a README pointer**

Append to `scripts/sync-briefings-gocreators.gs` a small block at the end if you want, OR document this in the PR description. For now, the inline TODO comment is enough.

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-briefings-gocreators.gs
git commit -m "feat(scripts): add Apps Script template for Docs → ingest-briefing"
```

---

## Task 19: Backfill script for active in-flight pautas

**Files:**
- Create: `scripts/backfill-briefings.ts`

This is post-launch tooling. The script consumes 3 CSV exports per brand, resolves creator names via the "Legenda Creators - Handles" CSV, and posts the active pautas + assignments via the Supabase service role.

- [ ] **Step 1: Write the backfill script**

Create `scripts/backfill-briefings.ts`:

```typescript
/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";

type Args = {
  brand: string;
  inputDir: string;
  apiUrl?: string;
  serviceRoleKey?: string;
  revalidateUrl?: string;
  revalidateSecret?: string;
};

function parseCli(): Args {
  const { values } = parseArgs({
    options: {
      brand: { type: "string", short: "b" },
      "input-dir": { type: "string", short: "i" },
      "api-url": { type: "string" },
      "service-role-key": { type: "string" },
      "revalidate-url": { type: "string" },
      "revalidate-secret": { type: "string" },
    },
  });
  if (!values.brand) throw new Error("--brand=<id> is required");
  if (!values["input-dir"]) throw new Error("--input-dir=<path> is required");
  return {
    brand: values.brand as string,
    inputDir: values["input-dir"] as string,
    apiUrl: (values["api-url"] as string) ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey:
      (values["service-role-key"] as string) ??
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    revalidateUrl: (values["revalidate-url"] as string) ?? process.env.NEXT_APP_URL,
    revalidateSecret:
      (values["revalidate-secret"] as string) ?? process.env.REVALIDATE_SECRET,
  };
}

function readCsv<T>(filepath: string): T[] {
  const txt = fs.readFileSync(filepath, "utf8");
  const result = Papa.parse<T>(txt, { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    console.warn(`CSV parse warnings for ${filepath}:`, result.errors.slice(0, 3));
  }
  return result.data;
}

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^@/, "")
    .trim();
}

async function main() {
  const args = parseCli();
  if (!args.apiUrl || !args.serviceRoleKey) {
    throw new Error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env, or pass --api-url and --service-role-key.",
    );
  }
  const brandId = Number(args.brand);
  if (!Number.isInteger(brandId) || brandId < 1) {
    throw new Error("--brand must be a positive integer");
  }

  const pautasCsv = path.join(args.inputDir, "apice-pautas.csv");
  const porPautaCsv = path.join(args.inputDir, "apice-por-pauta.csv");
  const legendaCsv = path.join(args.inputDir, "legenda-handles.csv");

  for (const f of [pautasCsv, porPautaCsv, legendaCsv]) {
    if (!fs.existsSync(f)) throw new Error(`File not found: ${f}`);
  }

  type PautaRow = Record<string, string>;
  const pautasRows = readCsv<PautaRow>(pautasCsv);
  const porPautaRows = readCsv<PautaRow>(porPautaCsv);
  const legendaRows = readCsv<PautaRow>(legendaCsv);

  // Build canonical name map from Legenda
  const handleToCanonical = new Map<string, string>();
  for (const row of legendaRows) {
    const nameKey = Object.keys(row).find((k) => /nome/i.test(k) && !/handle/i.test(k));
    const handleKey = Object.keys(row).find((k) => /handle|@|user|instagram/i.test(k));
    if (!nameKey || !handleKey) continue;
    const name = row[nameKey];
    const handle = row[handleKey];
    if (handle) handleToCanonical.set(norm(handle), norm(name || handle));
  }

  // Load creators table
  const supabase = createClient(args.apiUrl, args.serviceRoleKey);
  const { data: creators, error: cErr } = await supabase
    .from("creators")
    .select("id, full_name");
  if (cErr) throw new Error(`Failed to load creators: ${cErr.message}`);
  const fullNameToId = new Map<string, number>();
  for (const c of creators ?? []) {
    fullNameToId.set(norm(c.full_name), c.id);
  }

  // Build briefing map from "Apice - Pautas"
  type Briefing = {
    briefing_number: number;
    semana: number | null;
    mes: number | null;
    ano: number | null;
    ref_url: string | null;
    take_inicial: string | null;
    fala_inicial: string | null;
    produtos: string[];
  };
  const briefingByNumber = new Map<number, Briefing>();
  for (const row of pautasRows) {
    const num = parseInt(row["Pauta"] ?? "", 10);
    if (!Number.isInteger(num) || num < 1) continue;
    briefingByNumber.set(num, {
      briefing_number: num,
      semana: parseIntOrNull(row["Semana"]),
      mes: parseIntOrNull(row["Mês"] ?? row["Mes"]),
      ano: parseIntOrNull(row["Ano"]),
      ref_url: row["Ref"]?.trim() || null,
      take_inicial: row["Take inicial"]?.trim() || null,
      fala_inicial: row["Fala inicial"]?.trim() || null,
      produtos: row["Produto"]
        ? [row["Produto"].trim()].filter(Boolean)
        : [],
    });
  }

  // Walk Por Pauta: filter to Entregou=0 (active), resolve creator
  type Assignment = {
    briefing_number: number;
    creator_id: number;
    variante: string | null;
  };
  const activeAssignments: Assignment[] = [];
  const unmatched: { row: PautaRow; reason: string }[] = [];

  for (const row of porPautaRows) {
    const entregou = (row["Entregou"] ?? row["Entregou?"] ?? "").trim();
    if (entregou !== "0" && entregou !== "") continue; // skip delivered rows

    const num = parseInt(row["Pauta"] ?? "", 10);
    if (!Number.isInteger(num) || num < 1) {
      unmatched.push({ row, reason: "invalid pauta number" });
      continue;
    }
    if (!briefingByNumber.has(num)) {
      unmatched.push({ row, reason: `briefing ${num} missing in pautas csv` });
      continue;
    }
    const creatorRaw = row["CREATORS"] ?? row["Creator"] ?? "";
    const candidate = norm(creatorRaw);
    const canonical = handleToCanonical.get(candidate) ?? candidate;
    const creatorId = fullNameToId.get(canonical);
    if (!creatorId) {
      unmatched.push({ row, reason: `unmatched creator: ${creatorRaw}` });
      continue;
    }
    activeAssignments.push({
      briefing_number: num,
      creator_id: creatorId,
      variante: (row["Variante"] ?? "").trim() || null,
    });
  }

  // Filter briefings: only keep ones with at least one active assignment
  const activeNumbers = new Set(activeAssignments.map((a) => a.briefing_number));
  const briefingsToInsert = Array.from(briefingByNumber.values())
    .filter((b) => activeNumbers.has(b.briefing_number))
    .map((b) => ({
      brand_id: brandId,
      briefing_number: b.briefing_number,
      semana: b.semana,
      mes: b.mes,
      ano: b.ano,
      ref_url: b.ref_url,
      take_inicial: b.take_inicial,
      fala_inicial: b.fala_inicial,
      conceito: null,
      produtos: b.produtos,
      source: "docs" as const,
      source_doc_id: "backfill",
      updated_at: new Date().toISOString(),
    }));

  console.log(`Briefings to upsert: ${briefingsToInsert.length}`);
  console.log(`Active assignments: ${activeAssignments.length}`);
  console.log(`Unmatched rows: ${unmatched.length}`);

  // Upsert briefings
  if (briefingsToInsert.length > 0) {
    const { error: bErr } = await supabase
      .from("briefings")
      .upsert(briefingsToInsert, { onConflict: "brand_id,briefing_number" });
    if (bErr) throw new Error(`Briefing upsert failed: ${bErr.message}`);
  }

  // Get IDs for upserted briefings
  const { data: insertedBriefings } = await supabase
    .from("briefings")
    .select("id, briefing_number")
    .eq("brand_id", brandId)
    .in(
      "briefing_number",
      briefingsToInsert.map((b) => b.briefing_number),
    );
  const numberToId = new Map<number, number>();
  for (const b of insertedBriefings ?? []) {
    numberToId.set(b.briefing_number, b.id);
  }

  // Insert assignments (idempotent via unique key on (briefing_id, creator_id))
  const assignmentRows = activeAssignments
    .map((a) => {
      const briefingId = numberToId.get(a.briefing_number);
      if (!briefingId) return null;
      return {
        briefing_id: briefingId,
        creator_id: a.creator_id,
        variante: a.variante,
        status: "pendente" as const,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (assignmentRows.length > 0) {
    // Use upsert with ignoreDuplicates so re-runs don't break
    const { error: aErr } = await supabase
      .from("briefing_assignments")
      .upsert(assignmentRows, {
        onConflict: "briefing_id,creator_id",
        ignoreDuplicates: true,
      });
    if (aErr) throw new Error(`Assignment upsert failed: ${aErr.message}`);
  }

  // Write unmatched report
  if (unmatched.length > 0) {
    const csv = Papa.unparse(
      unmatched.map((u) => ({
        reason: u.reason,
        ...u.row,
      })),
    );
    const outPath = path.join(args.inputDir, "unmatched.csv");
    fs.writeFileSync(outPath, csv, "utf8");
    console.log(`Unmatched rows written to ${outPath}`);
  }

  // Trigger cache revalidation
  if (args.revalidateUrl && args.revalidateSecret) {
    try {
      await fetch(`${args.revalidateUrl}/api/revalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-revalidate-secret": args.revalidateSecret,
        },
        body: JSON.stringify({ tags: ["briefings"] }),
      });
      console.log("Revalidate dispatched");
    } catch (e) {
      console.error("Revalidate failed (non-fatal):", e);
    }
  }

  console.log("Backfill complete.");
}

function parseIntOrNull(v: string | undefined | null): number | null {
  if (v == null) return null;
  const trimmed = v.trim();
  if (trimmed === "") return null;
  const n = parseInt(trimmed, 10);
  return Number.isInteger(n) ? n : null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit scripts/backfill-briefings.ts`
Expected: No errors. (If TypeScript complains about missing types for node:util parseArgs, ensure `@types/node` is installed — it should be in devDependencies.)

If `tsc` complains about `parseArgs` not being available, the project's TypeScript config may need `lib` updated; alternatively the script can switch to using `process.argv` directly. Document this caveat in the commit message if it surfaces.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-briefings.ts
git commit -m "feat(scripts): add backfill script for active in-flight briefings"
```

---

## Task 20: Open the pull request

**Files:** None modified. Repo metadata only.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/briefings-management
```

- [ ] **Step 2: Open the PR via gh**

```bash
gh pr create --title "feat: briefings management (Pautas)" --body "$(cat <<'EOF'
## Summary
- New `/dashboard/briefings` page for managing pautas (briefings): list, allocate creators, track per-allocation status, view delivery URLs.
- New Edge Function `ingest-briefing` accepts POSTs from a Google Apps Script that parses pautas from a Docs and replaces the legacy "Apice - Pautas" sheet. Idempotent upsert by `(brand_id, briefing_number)`.
- New tables `briefings`, `briefing_assignments`, plus view `briefing_with_status` (aggregate status computed). All schema changes are additive — no existing tables touched.
- Apps Script template (`scripts/sync-briefings-gocreators.gs`) for the user to deploy in their Docs (parsing logic to be pasted from the existing File 3).
- Backfill tool (`scripts/backfill-briefings.ts`) for importing active in-flight pautas from CSV exports of the legacy Sheets.

## Non-impact guarantees (this PR is purely additive)
- ✅ `/dashboard/pautas` (existing analytics on `creatives.guideline_number`) untouched.
- ✅ `components/pautas-table.tsx` untouched.
- ✅ Existing sidebar entry "Pautas" in Dashboards group untouched. New entry "Pautas (Gestão)" added in Gestão group.
- ✅ Generated migration only `CREATE`s — no `ALTER` on existing tables.
- ✅ Old Apps Scripts (Files 1, 2, 3 in legacy Sheets) keep operating in parallel until the user disables them.

## Pending user actions before this is fully wired up
- Set `INGEST_BRIEFING_SECRET`, `NEXT_APP_URL` (and existing `REVALIDATE_SECRET`) in `supabase/.env`. Deploy the Edge Function manually.
- Paste the existing File 3 parsing logic into `extractBriefingsFromDoc_` in `scripts/sync-briefings-gocreators.gs`, then create a new Apps Script project in each per-brand Google Docs with `BRAND_ID`, `INGEST_URL`, `INGEST_SECRET` configured.
- (Optional) Run `scripts/backfill-briefings.ts` per brand with CSV exports.

## Test plan
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `/dashboard/pautas` (analytics) renders identically to main.
- [ ] `/dashboard/briefings` lists briefings, filters by status/month/year/search.
- [ ] Detail sheet allows allocating creators, changing status, marking concluído with URL, removing pendente/cancelado allocations.
- [ ] Edge Function `ingest-briefing` rejects without secret (401), accepts valid payload (200), returns idempotent counts on re-run.
- [ ] Browser walkthrough from Task 17 of the implementation plan completed end-to-end.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Confirm PR URL**

The `gh pr create` command outputs the PR URL. Open it and verify the description rendered correctly.

(Nothing to commit — repo metadata only.)

---

## Self-review checklist (run before declaring done)

- [ ] `git log --oneline main..HEAD` shows ~18 commits with clear scope-prefixed messages.
- [ ] `git diff main -- app/dashboard/pautas` is empty (no accidental changes to existing analytics page).
- [ ] `git diff main -- components/pautas-table.tsx` is empty.
- [ ] `git diff main -- supabase/schemas/01_creators.sql ... 19_get_distinct_products.sql` is empty (no edits to existing schemas).
- [ ] `npm run build` and `npm run lint` both pass on the final commit.
- [ ] CLAUDE.md instruction respected: no `supabase db push` (production deploy) was run; the user must approve that separately.

## Open follow-ups (out of scope for this PR)

- Move the parsing logic from File 3 into `extractBriefingsFromDoc_` once the user provides the full file (was truncated during brainstorming).
- Add an `onEdit` or time-based trigger to the Apps Script for automatic syncs (post-MVP).
- Build the Creators Hub integration: an RPC `get_briefings_for_creator(p_creator_id)` consumed by the hub instead of its current isolated Supabase.
- (If demanded later) `briefing_assignment_events` audit log table for status transitions.
