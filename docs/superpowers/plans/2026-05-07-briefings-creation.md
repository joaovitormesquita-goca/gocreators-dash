# Briefings — Native Creation & Page Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native pauta creation/edit/list flows to the dashboard while splitting the existing `/dashboard/briefings` (allocation/management) into `/dashboard/alocacao`. Extends the existing PR #45 (`feat/briefings-management` branch).

**Architecture:** Schema rename (`conceito` → `construcao`) plus 2 new fields (`headline`, `tempo_video`). Existing `briefings` route moves to `alocacao`; new `briefings` route holds a Notion-style cards list, plus `new/` and `[id]/` form pages mirroring the Google Docs table layout with auto-resizing textareas. Server Actions for CRUD live in the new `app/dashboard/briefings/actions.ts`; allocation server actions stay in `app/dashboard/alocacao/actions.ts`.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Supabase (Postgres + Edge Functions), TypeScript, Tailwind v4, shadcn/ui (Sheet, Select, Input, Button, Badge, Skeleton, Command, Popover), Zod v4, sonner (toasts), react-textarea-autosize.

**Spec:** [docs/superpowers/specs/2026-05-07-briefings-creation-design.md](../specs/2026-05-07-briefings-creation-design.md)

---

## File Structure

### Modified files
```
supabase/schemas/20_briefings.sql                 # rename conceito→construcao, add headline, tempo_video
supabase/functions/ingest-briefing/types.ts       # update IncomingBriefing
supabase/functions/ingest-briefing/index.ts       # update toRow()
scripts/sync-briefings-gocreators.gs              # update JSDoc shape
scripts/backfill-briefings.ts                     # rename field mapping, optional new fields
lib/schemas/briefing.ts                           # rename + add types, add briefingFormSchema
components/app-sidebar.tsx                        # 2 entries: Briefings + Alocação de Pautas
components/briefing-detail-sheet.tsx              # update import path (briefings→alocacao)
components/briefing-allocation-form.tsx           # update import path
components/briefing-assignment-row.tsx            # update import path
components/briefing-management-table.tsx          # no import change (uses local component)
package.json                                      # +react-textarea-autosize
package-lock.json                                 # auto
```

### Renamed files (move)
```
app/dashboard/briefings/page.tsx     → app/dashboard/alocacao/page.tsx
app/dashboard/briefings/loading.tsx  → app/dashboard/alocacao/loading.tsx
app/dashboard/briefings/actions.ts   → app/dashboard/alocacao/actions.ts
```

### Deleted/regenerated
```
supabase/migrations/20260506183422_add_briefings_tables.sql   # delete + regen with final schema
```

### New files
```
components/ui/auto-textarea.tsx                    # wrapper around react-textarea-autosize
components/briefing-products-input.tsx             # chip-tag input (free-form products)
components/briefing-form-row.tsx                   # single row of the form table (label + input)
components/briefing-form.tsx                       # main form (create + edit modes)
components/briefing-content-card.tsx               # card for the list page
components/briefings-grid.tsx                      # grid of cards + filters
app/dashboard/briefings/page.tsx                   # NEW list page (cards)
app/dashboard/briefings/loading.tsx                # NEW skeleton
app/dashboard/briefings/actions.ts                 # NEW CRUD actions (briefing-level)
app/dashboard/briefings/new/page.tsx               # NEW creation form page
app/dashboard/briefings/[id]/page.tsx              # NEW edit form page
```

---

## Task 1: Verify branch and starting state

**Files:** None modified.

- [ ] **Step 1: Confirm branch**

```bash
git branch --show-current
```
Expected: `feat/briefings-management`

If different: `git checkout feat/briefings-management && git pull`

- [ ] **Step 2: Pull latest**

```bash
git pull
```

- [ ] **Step 3: Verify build green**

```bash
npm run build
```
Expected: `✓ Compiled successfully` with the briefings page already present at `/dashboard/briefings`.

(Nothing committed in this task — verification only.)

---

## Task 2: Update declarative schema

**Files:**
- Modify: `supabase/schemas/20_briefings.sql`

- [ ] **Step 1: Replace file contents**

Overwrite `supabase/schemas/20_briefings.sql` with:

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
  "headline" text,
  "construcao" text,
  "tempo_video" text,
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

Changes vs current file:
- `conceito` REMOVED
- `headline text` ADDED
- `construcao text` ADDED (replaces conceito semantically)
- `tempo_video text` ADDED

- [ ] **Step 2: Commit**

```bash
git add supabase/schemas/20_briefings.sql
git commit -m "refactor(schema): rename conceito to construcao, add headline + tempo_video"
```

---

## Task 3: Regenerate migration (Strategy A)

**Files:**
- Delete: `supabase/migrations/20260506183422_add_briefings_tables.sql`
- Create: `supabase/migrations/<new_timestamp>_add_briefings_tables.sql` (auto-generated)

- [ ] **Step 1: Verify Supabase local is running**

```bash
supabase status
```
If not: `supabase start`.

- [ ] **Step 2: Delete the existing migration file**

```bash
rm supabase/migrations/20260506183422_add_briefings_tables.sql
```

- [ ] **Step 3: Reset local DB**

```bash
supabase db reset --local
```
Expected: rebuilds local DB from remaining migrations + schemas. The briefings tables disappear.

If prompted, confirm Y/y.

- [ ] **Step 4: Generate new migration from updated schemas**

```bash
supabase db diff -f add_briefings_tables
```
Expected: creates a new file `supabase/migrations/<YYYYMMDDHHMMSS>_add_briefings_tables.sql`. Print the filename.

- [ ] **Step 5: Inspect the generated migration**

Open the new file. Verify it contains:
- `CREATE TABLE briefings` with columns including `headline`, `construcao`, `tempo_video` (and NO `conceito`)
- `CREATE TABLE briefing_assignments`
- `CREATE OR REPLACE VIEW briefing_with_status`
- All constraints and indexes
- NO `DROP` statements; NO `ALTER` of pre-existing tables

If anything looks wrong (e.g., references `conceito`, missing new fields), regenerate after fixing schemas.

- [ ] **Step 6: Apply the migration locally**

```bash
supabase migration up
```
Expected: applies cleanly.

- [ ] **Step 7: Verify in DB**

```bash
supabase db query "select column_name from information_schema.columns where table_schema='public' and table_name='briefings' order by ordinal_position;"
```
Expected: list includes `headline`, `construcao`, `tempo_video`. Does NOT include `conceito`.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/
git commit -m "chore(schema): regenerate migration with construcao + headline + tempo_video"
```

---

## Task 4: Update lib/schemas/briefing.ts

**Files:**
- Modify: `lib/schemas/briefing.ts`

- [ ] **Step 1: Replace file contents**

Overwrite `lib/schemas/briefing.ts` with:

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
  headline: string | null;
  construcao: string | null;
  tempo_video: string | null;
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

// ============ Allocation schemas (existing) ============

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

// ============ Briefing CRUD schemas (NEW) ============

const optionalUrl = z
  .string()
  .url("URL inválida")
  .or(z.literal(""))
  .nullable()
  .optional()
  .transform((v) => (v === "" ? null : v));

export const briefingFormSchema = z.object({
  brand_id: z.number().int().positive("Marca obrigatória"),
  briefing_number: z.number().int().positive("Número deve ser positivo"),
  semana: z.number().int().min(1).max(53).nullable().optional(),
  mes: z.number().int().min(1).max(12).nullable().optional(),
  ano: z.number().int().min(2020).max(2050).nullable().optional(),
  ref_url: optionalUrl,
  take_inicial: z.string().max(2000).nullable().optional(),
  fala_inicial: z.string().max(2000).nullable().optional(),
  headline: z.string().max(500).nullable().optional(),
  construcao: z.string().max(5000).nullable().optional(),
  tempo_video: z.string().max(100).nullable().optional(),
  produtos: z.array(z.string().max(100)).max(20).default([]),
});
export type BriefingFormInput = z.infer<typeof briefingFormSchema>;

export const updateBriefingSchema = briefingFormSchema.extend({
  id: z.number().int().positive(),
});
export type UpdateBriefingInput = z.infer<typeof updateBriefingSchema>;

export const deleteBriefingSchema = z.object({
  id: z.number().int().positive(),
});
export type DeleteBriefingInput = z.infer<typeof deleteBriefingSchema>;
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: builds successfully. The page that uses the existing `BriefingAssignmentWithCreator` etc. still works (types are compatible — only added/renamed within `Briefing`, not the assignment types).

If build fails because some component references `conceito`, fix those imports in subsequent tasks (the move/components tasks). Note the file in your report and proceed.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/briefing.ts
git commit -m "refactor(schemas): rename conceito to construcao, add headline + tempo_video + form schemas"
```

---

## Task 5: Update Edge Function payload

**Files:**
- Modify: `supabase/functions/ingest-briefing/types.ts`
- Modify: `supabase/functions/ingest-briefing/index.ts`

- [ ] **Step 1: Update types.ts**

Replace `supabase/functions/ingest-briefing/types.ts` with:

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
  headline?: string | null;
  construcao?: string | null;
  tempo_video?: string | null;
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

- [ ] **Step 2: Update index.ts toRow function**

Open `supabase/functions/ingest-briefing/index.ts`. Find the `toRow` function near the bottom. Replace it with:

```typescript
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
    headline: b.headline ?? null,
    construcao: b.construcao ?? null,
    tempo_video: b.tempo_video ?? null,
    produtos: b.produtos ?? [],
    source: "docs",
    source_doc_id: sourceDocId,
    updated_at: new Date().toISOString(),
  };
}
```

(Removed `conceito`, added `headline`, `construcao`, `tempo_video`.)

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/ingest-briefing/
git commit -m "feat(edge): support headline, construcao, tempo_video in ingest-briefing"
```

---

## Task 6: Update Apps Script template comment

**Files:**
- Modify: `scripts/sync-briefings-gocreators.gs`

- [ ] **Step 1: Update JSDoc shape**

Open `scripts/sync-briefings-gocreators.gs`. Find the JSDoc comment above `extractBriefingsFromDoc_`. Replace its "Each returned object should match this shape" block with:

```javascript
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
 *     headline: string | null,
 *     construcao: string | null,      // antes era 'conceito'
 *     tempo_video: string | null,
 *     produtos: string[]              // [] if none
 *   }
 */
```

The function body (currently `return [];`) stays.

- [ ] **Step 2: Commit**

```bash
git add scripts/sync-briefings-gocreators.gs
git commit -m "chore(scripts): update Apps Script template shape (headline/construcao/tempo_video)"
```

---

## Task 7: Update backfill script field mapping

**Files:**
- Modify: `scripts/backfill-briefings.ts`

- [ ] **Step 1: Update Briefing type and mapping**

Open `scripts/backfill-briefings.ts`. Find the `Briefing` type declaration (around line 80-90 inside `main()`). Replace it with:

```typescript
type Briefing = {
  briefing_number: number;
  semana: number | null;
  mes: number | null;
  ano: number | null;
  ref_url: string | null;
  take_inicial: string | null;
  fala_inicial: string | null;
  headline: string | null;
  construcao: string | null;
  tempo_video: string | null;
  produtos: string[];
};
```

- [ ] **Step 2: Update map building**

Find the loop `for (const row of pautasRows)`. Replace its body (the `briefingByNumber.set(num, {...})` block) with:

```typescript
    briefingByNumber.set(num, {
      briefing_number: num,
      semana: parseIntOrNull(row["Semana"]),
      mes: parseIntOrNull(row["Mês"] ?? row["Mes"]),
      ano: parseIntOrNull(row["Ano"]),
      ref_url: row["Ref"]?.trim() || null,
      take_inicial: row["Take inicial"]?.trim() || null,
      fala_inicial: row["Fala inicial"]?.trim() || null,
      headline: row["Headline"]?.trim() || null,
      construcao: (row["Construção"] ?? row["Construcao"] ?? row["Conceito"])?.trim() || null,
      tempo_video: (row["Tempo de Vídeo"] ?? row["Tempo de Video"] ?? row["Tempo"])?.trim() || null,
      produtos: row["Produto"]
        ? [row["Produto"].trim()].filter(Boolean)
        : [],
    });
```

- [ ] **Step 3: Update insert mapping**

Find `briefingsToInsert = ...map((b) => ({...}))`. Replace the object with:

```typescript
    .map((b) => ({
      brand_id: brandId,
      briefing_number: b.briefing_number,
      semana: b.semana,
      mes: b.mes,
      ano: b.ano,
      ref_url: b.ref_url,
      take_inicial: b.take_inicial,
      fala_inicial: b.fala_inicial,
      headline: b.headline,
      construcao: b.construcao,
      tempo_video: b.tempo_video,
      produtos: b.produtos,
      source: "docs" as const,
      source_doc_id: "backfill",
      updated_at: new Date().toISOString(),
    }));
```

(Note: removed `conceito: null`, added `headline`, `construcao`, `tempo_video`.)

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-briefings.ts
git commit -m "chore(scripts): map Construção, Headline, Tempo de Vídeo in backfill"
```

---

## Task 8: Build verify after schema/types changes

**Files:** None modified.

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: builds successfully. The existing pages still work because we haven't moved or renamed routes yet — only field names changed.

If build fails referring to `conceito`, identify the file and fix the reference. Most likely candidates: components/briefing-detail-sheet.tsx (renders briefing fields). Check if it references `conceito`:

```bash
grep -rn "conceito" components/ app/ lib/ 2>&1
```

If references found in code (not just spec docs), fix them by replacing with `construcao` and re-run build.

- [ ] **Step 2: If fixes were needed, commit them**

```bash
git add components/ app/
git commit -m "refactor(ui): replace conceito with construcao in briefing displays"
```

If no fixes needed, no commit; proceed.

---

## Task 9: Move briefings → alocacao + sidebar update

**Files:**
- Move: `app/dashboard/briefings/page.tsx` → `app/dashboard/alocacao/page.tsx`
- Move: `app/dashboard/briefings/loading.tsx` → `app/dashboard/alocacao/loading.tsx`
- Move: `app/dashboard/briefings/actions.ts` → `app/dashboard/alocacao/actions.ts`
- Modify: `components/briefing-detail-sheet.tsx`
- Modify: `components/briefing-allocation-form.tsx`
- Modify: `components/briefing-assignment-row.tsx`
- Modify: `components/app-sidebar.tsx`

- [ ] **Step 1: Move route files**

```bash
mkdir -p app/dashboard/alocacao
git mv app/dashboard/briefings/page.tsx app/dashboard/alocacao/page.tsx
git mv app/dashboard/briefings/loading.tsx app/dashboard/alocacao/loading.tsx
git mv app/dashboard/briefings/actions.ts app/dashboard/alocacao/actions.ts
```

- [ ] **Step 2: Update internal page.tsx import**

Open `app/dashboard/alocacao/page.tsx`. The first import line is:

```typescript
import { getBrands, getBriefings } from "./actions";
```

This is a relative import — it works as-is after the move. **No change needed.**

But verify the import for the table component:

```typescript
import { BriefingManagementTable } from "@/components/briefing-management-table";
```

This is an absolute import from `components/` — also unchanged. **Verify by reading the file.**

- [ ] **Step 3: Update components that import old action path**

Open `components/briefing-detail-sheet.tsx`. Find this import block (around line 16-18):

```typescript
import {
  getBriefingDetail,
  getAllocatableCreators,
} from "@/app/dashboard/briefings/actions";
```

Change to:

```typescript
import {
  getBriefingDetail,
  getAllocatableCreators,
} from "@/app/dashboard/alocacao/actions";
```

Open `components/briefing-allocation-form.tsx`. Find:

```typescript
import { assignCreatorsToBriefing } from "@/app/dashboard/briefings/actions";
```

Change to:

```typescript
import { assignCreatorsToBriefing } from "@/app/dashboard/alocacao/actions";
```

Open `components/briefing-assignment-row.tsx`. Find:

```typescript
import {
  updateAssignmentStatus,
  removeAssignment,
} from "@/app/dashboard/briefings/actions";
```

Change to:

```typescript
import {
  updateAssignmentStatus,
  removeAssignment,
} from "@/app/dashboard/alocacao/actions";
```

(`components/briefing-management-table.tsx` doesn't import server actions directly — only the badge and the detail sheet. No change.)

- [ ] **Step 4: Update sidebar entry**

Open `components/app-sidebar.tsx`. Find the `Gestão` section. Replace the existing "Pautas (Gestão)" entry:

```typescript
{
  title: "Pautas (Gestão)",
  href: "/dashboard/briefings",
  icon: ScrollText,
},
```

With:

```typescript
{
  title: "Alocação de Pautas",
  href: "/dashboard/alocacao",
  icon: ScrollText,
},
```

(We'll add the new "Briefings" entry in Task 19, after the new pages exist.)

- [ ] **Step 5: Verify the directory move**

```bash
ls app/dashboard/briefings 2>&1
```
Expected: `ls: cannot access 'app/dashboard/briefings': No such file or directory` (Linux) or empty result (Windows). The directory should be empty/gone.

```bash
ls app/dashboard/alocacao
```
Expected: `actions.ts  loading.tsx  page.tsx`

- [ ] **Step 6: Build verify**

```bash
npm run build
```
Expected: succeeds. The route `/dashboard/alocacao` now serves the management table.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/ components/briefing-detail-sheet.tsx components/briefing-allocation-form.tsx components/briefing-assignment-row.tsx components/app-sidebar.tsx
git commit -m "refactor(routing): move /dashboard/briefings to /dashboard/alocacao"
```

---

## Task 10: Install react-textarea-autosize

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the package**

```bash
npm install react-textarea-autosize
```
Expected: installs `react-textarea-autosize` (latest, ~3kb gz).

- [ ] **Step 2: Verify in package.json**

```bash
grep "react-textarea-autosize" package.json
```
Expected: shows the dependency line.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add react-textarea-autosize for auto-resizing form inputs"
```

---

## Task 11: Auto-textarea wrapper component

**Files:**
- Create: `components/ui/auto-textarea.tsx`

- [ ] **Step 1: Create the component**

Create `components/ui/auto-textarea.tsx` with EXACTLY:

```typescript
"use client";

import * as React from "react";
import TextareaAutosize, {
  type TextareaAutosizeProps,
} from "react-textarea-autosize";
import { cn } from "@/lib/utils";

export type AutoTextareaProps = TextareaAutosizeProps;

export const AutoTextarea = React.forwardRef<
  HTMLTextAreaElement,
  AutoTextareaProps
>(({ className, minRows = 2, ...props }, ref) => {
  return (
    <TextareaAutosize
      ref={ref}
      minRows={minRows}
      className={cn(
        "flex w-full resize-none bg-transparent px-3 py-2 text-sm",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
AutoTextarea.displayName = "AutoTextarea";
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: builds successfully.

- [ ] **Step 3: Commit**

```bash
git add components/ui/auto-textarea.tsx
git commit -m "feat(ui): add AutoTextarea wrapper around react-textarea-autosize"
```

---

## Task 12: Briefing form-row component

**Files:**
- Create: `components/briefing-form-row.tsx`

- [ ] **Step 1: Create the component**

Create `components/briefing-form-row.tsx` with EXACTLY:

```typescript
import * as React from "react";
import { cn } from "@/lib/utils";

export function BriefingFormRow({
  label,
  children,
  className,
  isLast,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  isLast?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[140px_1fr] divide-x divide-border",
        !isLast && "border-b",
        className,
      )}
    >
      <div className="bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/briefing-form-row.tsx
git commit -m "feat(ui): add BriefingFormRow component (label + value cell)"
```

---

## Task 13: Briefing products chip-input component

**Files:**
- Create: `components/briefing-products-input.tsx`

- [ ] **Step 1: Create the component**

Create `components/briefing-products-input.tsx` with EXACTLY:

```typescript
"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function BriefingProductsInput({
  value,
  onChange,
  placeholder = "Digite e pressione Enter...",
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState("");

  function commitDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  function removeAt(index: number) {
    const next = [...value];
    next.splice(index, 1);
    onChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
      return;
    }
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 px-3 py-2",
        className,
      )}
    >
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 rounded-md border bg-secondary px-2 py-0.5 text-xs"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeAt(i)}
            className="rounded hover:bg-muted"
            aria-label={`Remover ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm focus:outline-none"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/briefing-products-input.tsx
git commit -m "feat(ui): add BriefingProductsInput chip-tag component"
```

---

## Task 14: Briefing CRUD server actions

**Files:**
- Create: `app/dashboard/briefings/actions.ts`

- [ ] **Step 1: Create directory and actions file**

```bash
mkdir -p app/dashboard/briefings
```

Create `app/dashboard/briefings/actions.ts` with EXACTLY:

```typescript
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getBrands as _getBrands } from "@/lib/queries/brands";
import {
  getBriefings as _getBriefings,
  type BriefingFilters,
} from "@/lib/queries/briefings";
import {
  briefingFormSchema,
  updateBriefingSchema,
  deleteBriefingSchema,
  type BriefingFormInput,
  type UpdateBriefingInput,
  type DeleteBriefingInput,
  type Briefing,
} from "@/lib/schemas/briefing";

// ============ READS ============

export async function getBrands() {
  return _getBrands();
}

export async function getBriefings(brandId: number, filters: BriefingFilters = {}) {
  return _getBriefings(brandId, filters);
}

export async function getBriefingById(id: number): Promise<Briefing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Briefing | null;
}

export async function suggestNextBriefingNumber(brandId: number): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefings")
    .select("briefing_number")
    .eq("brand_id", brandId)
    .order("briefing_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.briefing_number ?? 0) + 1;
}

// ============ MUTATIONS ============

function invalidateCaches() {
  revalidateTag(CACHE_TAGS.BRIEFINGS);
  revalidatePath("/dashboard/briefings");
  revalidatePath("/dashboard/alocacao");
}

export async function createBriefing(
  input: BriefingFormInput,
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  const parsed = briefingFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("briefings")
    .insert({
      ...parsed.data,
      source: "native" as const,
      source_doc_id: null,
      updated_at: nowIso,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: `Já existe uma pauta ${parsed.data.briefing_number} nessa marca`,
      };
    }
    return { success: false, error: error.message };
  }

  invalidateCaches();
  return { success: true, id: data.id };
}

export async function updateBriefing(
  input: UpdateBriefingInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = updateBriefingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { id, ...rest } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("briefings")
    .update({
      ...rest,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: `Já existe uma pauta ${parsed.data.briefing_number} nessa marca`,
      };
    }
    return { success: false, error: error.message };
  }

  invalidateCaches();
  return { success: true };
}

export async function deleteBriefing(
  input: DeleteBriefingInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = deleteBriefingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("briefings")
    .delete()
    .eq("id", parsed.data.id);

  if (error) return { success: false, error: error.message };

  invalidateCaches();
  return { success: true };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/briefings/actions.ts
git commit -m "feat(actions): add briefing CRUD server actions (create/update/delete/getById/suggestNumber)"
```

---

## Task 15: Briefing form component

**Files:**
- Create: `components/briefing-form.tsx`

- [ ] **Step 1: Create the component**

Create `components/briefing-form.tsx` with EXACTLY:

```typescript
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { BriefingFormRow } from "@/components/briefing-form-row";
import { BriefingProductsInput } from "@/components/briefing-products-input";
import {
  createBriefing,
  updateBriefing,
  deleteBriefing,
} from "@/app/dashboard/briefings/actions";
import type { BriefingFormInput, Briefing } from "@/lib/schemas/briefing";

type Brand = { id: number; name: string };

const MES_PT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function buildNamingTemplate(form: BriefingFormInput): string {
  const mes = form.mes ? MES_PT[form.mes - 1] : "<mes>";
  const ano = form.ano ? String(form.ano).slice(-2) : "<aa>";
  const num = form.briefing_number || "<numero>";
  const sem = form.semana || "<semana>";
  const produto = form.produtos[0] || "ProdutoFocoDoVideo";
  return `@<insta> - ${mes} ${ano} - pauta ${num} - semana ${sem} - ${produto} - sem headline/com headline`;
}

export function BriefingForm({
  mode,
  brands,
  initial,
  initialBrandId,
  initialNumber,
}: {
  mode: "create" | "edit";
  brands: Brand[];
  initial?: Briefing;
  initialBrandId?: number;
  initialNumber?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  const [form, setForm] = React.useState<BriefingFormInput>(() => ({
    brand_id: initial?.brand_id ?? initialBrandId ?? brands[0]?.id ?? 0,
    briefing_number:
      initial?.briefing_number ??
      initialNumber ??
      0,
    semana: initial?.semana ?? null,
    mes: initial?.mes ?? new Date().getMonth() + 1,
    ano: initial?.ano ?? new Date().getFullYear(),
    ref_url: initial?.ref_url ?? null,
    take_inicial: initial?.take_inicial ?? null,
    fala_inicial: initial?.fala_inicial ?? null,
    headline: initial?.headline ?? null,
    construcao: initial?.construcao ?? null,
    tempo_video: initial?.tempo_video ?? null,
    produtos: initial?.produtos ?? [],
  }));

  const [dirty, setDirty] = React.useState(false);

  function setField<K extends keyof BriefingFormInput>(
    key: K,
    value: BriefingFormInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  // beforeunload guard
  React.useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function handleSave() {
    if (!form.brand_id || !form.briefing_number) {
      toast.error("Marca e número da pauta são obrigatórios");
      return;
    }
    startTransition(async () => {
      if (mode === "create") {
        const result = await createBriefing(form);
        if (result.success) {
          toast.success("Pauta criada");
          setDirty(false);
          router.push(`/dashboard/briefings/${result.id}`);
        } else {
          toast.error(result.error);
        }
      } else {
        if (!initial?.id) return;
        const result = await updateBriefing({ ...form, id: initial.id });
        if (result.success) {
          toast.success("Pauta atualizada");
          setDirty(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      }
    });
  }

  // Cmd+S / Ctrl+S
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, mode]);

  function handleDelete() {
    if (!initial?.id) return;
    if (!confirm(`Deletar pauta ${initial.briefing_number}? Essa ação remove também todas as alocações.`))
      return;
    startTransition(async () => {
      const result = await deleteBriefing({ id: initial.id });
      if (result.success) {
        toast.success("Pauta removida");
        router.push("/dashboard/briefings");
      } else {
        toast.error(result.error);
      }
    });
  }

  const namingTemplate = buildNamingTemplate(form);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/briefings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Briefings
        </Link>
        <div className="flex items-center gap-2">
          {mode === "edit" && initial?.source ? (
            <Badge variant="outline" className="text-xs">
              {initial.source === "docs" ? "Docs" : "Nativa"}
            </Badge>
          ) : null}
          {mode === "edit" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Excluir
            </Button>
          ) : null}
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar (⌘S)"}
          </Button>
        </div>
      </div>

      {mode === "edit" && initial?.source === "docs" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ Esta pauta foi sincronizada do Google Docs. Edits aqui podem ser sobrescritos no próximo sync.
        </div>
      ) : null}

      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/30 px-4 py-4 text-center border-b">
          <div className="font-mono text-xl font-bold tracking-tight">
            PAUTA{" "}
            <input
              type="number"
              value={form.briefing_number || ""}
              onChange={(e) =>
                setField("briefing_number", Number(e.target.value) || 0)
              }
              className="inline-block w-[100px] bg-transparent text-center font-mono text-xl font-bold focus:outline-none focus:ring-1 focus:ring-ring rounded"
              min={1}
            />
          </div>
        </div>

        <BriefingFormRow label="Fala inicial">
          <AutoTextarea
            value={form.fala_inicial ?? ""}
            onChange={(e) => setField("fala_inicial", e.target.value || null)}
            placeholder='"O que você tá fazendo?" "Finalizando..."'
          />
        </BriefingFormRow>

        <BriefingFormRow label="Take inicial">
          <AutoTextarea
            value={form.take_inicial ?? ""}
            onChange={(e) => setField("take_inicial", e.target.value || null)}
            placeholder="Personagem 1 tentando finalizar..."
          />
        </BriefingFormRow>

        <BriefingFormRow label="Headline">
          <AutoTextarea
            value={form.headline ?? ""}
            onChange={(e) => setField("headline", e.target.value || null)}
            placeholder="POV: você acha que sabe..."
            minRows={1}
          />
        </BriefingFormRow>

        <BriefingFormRow label="Construção">
          <AutoTextarea
            value={form.construcao ?? ""}
            onChange={(e) => setField("construcao", e.target.value || null)}
            placeholder="- A ideia é uma espécie de teatrinho..."
            minRows={3}
          />
        </BriefingFormRow>

        <BriefingFormRow label="Referência">
          <Input
            type="url"
            value={form.ref_url ?? ""}
            onChange={(e) => setField("ref_url", e.target.value || null)}
            placeholder="https://..."
            className="border-0 rounded-none focus-visible:ring-1"
          />
        </BriefingFormRow>

        <BriefingFormRow label="Produto">
          <BriefingProductsInput
            value={form.produtos}
            onChange={(next) => setField("produtos", next)}
          />
        </BriefingFormRow>

        <BriefingFormRow label="Tempo de Vídeo">
          <Input
            value={form.tempo_video ?? ""}
            onChange={(e) => setField("tempo_video", e.target.value || null)}
            placeholder="Até 1:00s"
            className="border-0 rounded-none focus-visible:ring-1"
          />
        </BriefingFormRow>

        <BriefingFormRow label="Nomeie o vídeo com" isLast>
          <div className="px-3 py-2 text-sm text-muted-foreground italic font-mono">
            {namingTemplate}
          </div>
        </BriefingFormRow>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Marca
          </label>
          <Select
            value={form.brand_id ? String(form.brand_id) : ""}
            onValueChange={(v) => setField("brand_id", Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Semana
          </label>
          <Input
            type="number"
            value={form.semana ?? ""}
            onChange={(e) => setField("semana", e.target.value ? Number(e.target.value) : null)}
            min={1}
            max={53}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Mês
          </label>
          <Input
            type="number"
            value={form.mes ?? ""}
            onChange={(e) => setField("mes", e.target.value ? Number(e.target.value) : null)}
            min={1}
            max={12}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Ano
          </label>
          <Input
            type="number"
            value={form.ano ?? ""}
            onChange={(e) => setField("ano", e.target.value ? Number(e.target.value) : null)}
            min={2020}
            max={2050}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/briefing-form.tsx
git commit -m "feat(ui): add BriefingForm with auto-textarea, Cmd+S, naming template"
```

---

## Task 16: Briefing creation page

**Files:**
- Create: `app/dashboard/briefings/new/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/dashboard/briefings/new/page.tsx` with EXACTLY:

```typescript
import { getBrands, suggestNextBriefingNumber } from "../actions";
import { BriefingForm } from "@/components/briefing-form";

export default async function NewBriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const params = await searchParams;
  const brands = await getBrands();
  const initialBrandId = params.brand
    ? Number(params.brand)
    : brands[0]?.id ?? 0;

  const initialNumber = initialBrandId
    ? await suggestNextBriefingNumber(initialBrandId)
    : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Nova pauta</h1>
      <BriefingForm
        mode="create"
        brands={brands}
        initialBrandId={initialBrandId}
        initialNumber={initialNumber}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: succeeds. The route `/dashboard/briefings/new` is registered.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/briefings/new/page.tsx
git commit -m "feat(ui): add /dashboard/briefings/new page (create briefing)"
```

---

## Task 17: Briefing edit page

**Files:**
- Create: `app/dashboard/briefings/[id]/page.tsx`

- [ ] **Step 1: Create the page**

Create `app/dashboard/briefings/[id]/page.tsx` with EXACTLY:

```typescript
import { notFound } from "next/navigation";
import { getBrands, getBriefingById } from "../actions";
import { BriefingForm } from "@/components/briefing-form";

export default async function EditBriefingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum < 1) notFound();

  const [brands, briefing] = await Promise.all([
    getBrands(),
    getBriefingById(idNum),
  ]);

  if (!briefing) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">
        Editar pauta {briefing.briefing_number}
      </h1>
      <BriefingForm mode="edit" brands={brands} initial={briefing} />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/briefings/[id]/page.tsx
git commit -m "feat(ui): add /dashboard/briefings/[id] page (edit briefing)"
```

---

## Task 18: Briefing content card component

**Files:**
- Create: `components/briefing-content-card.tsx`

- [ ] **Step 1: Create the component**

Create `components/briefing-content-card.tsx` with EXACTLY:

```typescript
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BriefingAggregateBadge } from "@/components/briefing-status-badge";
import type { BriefingWithStatus } from "@/lib/schemas/briefing";

const MES_PT_LONG = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function BriefingContentCard({
  briefing,
}: {
  briefing: BriefingWithStatus;
}) {
  const semMes =
    briefing.semana != null && briefing.mes != null
      ? `Sem ${briefing.semana} · ${MES_PT_LONG[briefing.mes - 1]}/${briefing.ano ?? ""}`
      : briefing.mes != null
        ? `${MES_PT_LONG[briefing.mes - 1]}/${briefing.ano ?? ""}`
        : null;

  return (
    <Link
      href={`/dashboard/briefings/${briefing.id}`}
      className="group block rounded-lg border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-foreground/20"
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-xs text-muted-foreground tracking-wider">
          PAUTA {briefing.briefing_number}
        </div>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider px-1.5 py-0">
          {briefing.source === "docs" ? "Docs" : "Nativa"}
        </Badge>
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug line-clamp-2 group-hover:text-foreground">
        {briefing.headline?.trim() || briefing.take_inicial?.trim() || "Sem título"}
      </h3>

      {briefing.fala_inicial ? (
        <p className="mt-1.5 text-sm text-muted-foreground line-clamp-1">
          {briefing.fala_inicial}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {briefing.produtos.slice(0, 2).map((p) => (
          <Badge key={p} variant="secondary" className="text-xs">
            {p}
          </Badge>
        ))}
        {briefing.produtos.length > 2 ? (
          <span className="text-xs text-muted-foreground">
            +{briefing.produtos.length - 2}
          </span>
        ) : null}
        {briefing.assignment_count > 0 ? (
          <BriefingAggregateBadge status={briefing.aggregate_status} />
        ) : null}
      </div>

      {semMes ? (
        <div className="mt-3 text-xs text-muted-foreground">{semMes}</div>
      ) : null}
    </Link>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/briefing-content-card.tsx
git commit -m "feat(ui): add BriefingContentCard for the list page"
```

---

## Task 19: Briefings grid + filters component

**Files:**
- Create: `components/briefings-grid.tsx`

- [ ] **Step 1: Create the component**

Create `components/briefings-grid.tsx` with EXACTLY:

```typescript
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BriefingContentCard } from "@/components/briefing-content-card";
import type { BriefingWithStatus } from "@/lib/schemas/briefing";

type Brand = { id: number; name: string };

export function BriefingsGrid({
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

  const currentMes = searchParams.get("mes") ?? "";
  const currentAno = searchParams.get("ano") ?? "";
  const currentQ = searchParams.get("q") ?? "";

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="space-y-5">
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
          placeholder="Buscar (nº, headline, take, fala)"
          className="w-[300px]"
          value={currentQ}
          onChange={(e) => updateParam("q", e.target.value || null)}
        />

        <div className="ml-auto">
          <Button asChild>
            <Link
              href={
                selectedBrandId
                  ? `/dashboard/briefings/new?brand=${selectedBrandId}`
                  : "/dashboard/briefings/new"
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              Nova pauta
            </Link>
          </Button>
        </div>
      </div>

      {briefings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma pauta encontrada para os filtros atuais.
          </p>
          <Button asChild variant="link" className="mt-2">
            <Link
              href={
                selectedBrandId
                  ? `/dashboard/briefings/new?brand=${selectedBrandId}`
                  : "/dashboard/briefings/new"
              }
            >
              Criar a primeira →
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {briefings.map((b) => (
            <BriefingContentCard key={b.id} briefing={b} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/briefings-grid.tsx
git commit -m "feat(ui): add BriefingsGrid (cards + filters + new pauta button)"
```

---

## Task 20: Briefings list page + loading

**Files:**
- Create: `app/dashboard/briefings/page.tsx`
- Create: `app/dashboard/briefings/loading.tsx`

- [ ] **Step 1: Create page.tsx**

Create `app/dashboard/briefings/page.tsx` with EXACTLY:

```typescript
import { getBrands, getBriefings } from "./actions";
import { BriefingsGrid } from "@/components/briefings-grid";
import type { BriefingFilters } from "@/lib/queries/briefings";

export default async function BriefingsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    brand?: string;
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

  const filters: BriefingFilters = {
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
        <h1 className="text-2xl font-bold tracking-tight">Briefings</h1>
      </div>
      <BriefingsGrid
        brands={brands}
        selectedBrandId={selectedBrandId}
        briefings={briefings}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create loading.tsx**

Create `app/dashboard/briefings/loading.tsx` with EXACTLY:

```typescript
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-32 ml-auto" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: succeeds. The route `/dashboard/briefings` now serves the new list page.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/briefings/page.tsx app/dashboard/briefings/loading.tsx
git commit -m "feat(ui): add /dashboard/briefings list page (cards) + loading"
```

---

## Task 21: Add Briefings sidebar entry

**Files:**
- Modify: `components/app-sidebar.tsx`

- [ ] **Step 1: Add the import**

Open `components/app-sidebar.tsx`. Find the lucide-react import line (around line 3). It currently includes `ScrollText`. Add `FileText`:

Find:
```typescript
import { LayoutDashboard, TableProperties, BarChart3, CalendarDays, UserPlus, Building2, History, DollarSign, ClipboardList, ScrollText } from "lucide-react";
```

Change to:
```typescript
import { LayoutDashboard, TableProperties, BarChart3, CalendarDays, UserPlus, Building2, History, DollarSign, ClipboardList, ScrollText, FileText } from "lucide-react";
```

- [ ] **Step 2: Add the new entry to Gestão group**

In the `Gestão` section's `items` array, add a new entry as the FIRST item (before "Alocação de Pautas"):

The Gestão items array should end up like this:

```typescript
{
  label: "Gestão",
  items: [
    {
      title: "Briefings",
      href: "/dashboard/briefings",
      icon: FileText,
    },
    {
      title: "Alocação de Pautas",
      href: "/dashboard/alocacao",
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

The existing "Pautas" entry in the **Dashboards** section (linking to `/dashboard/pautas` with `ClipboardList` icon) **must remain unchanged**.

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "feat(ui): add Briefings entry to sidebar Gestão group"
```

---

## Task 22: Browser walkthrough verification

**Files:** None modified.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```
Open the URL printed (likely `http://localhost:3000` or `:3001`).

- [ ] **Step 2: Login**

Navigate to `/auth/login`. Sign in:
- Email: `teste@gocreators.com`
- Password: `teste123456`

- [ ] **Step 3: Verify analytics route untouched**

Navigate to `/dashboard/pautas`. Confirm the existing analytics page renders (table of guideline_number metrics). No errors.

- [ ] **Step 4: Verify Alocação route works**

Sidebar → Gestão → "Alocação de Pautas". URL becomes `/dashboard/alocacao`. The page renders the management table identically to before the rename.

- [ ] **Step 5: Verify Briefings list (empty)**

Sidebar → Gestão → "Briefings". URL becomes `/dashboard/briefings`. List renders empty state ("Nenhuma pauta encontrada... Criar a primeira →").

- [ ] **Step 6: Create a new briefing**

Click **+ Nova pauta**. URL becomes `/dashboard/briefings/new`.
- Field "Marca" pre-selected first brand
- Field "PAUTA" auto-suggests next number (e.g. 1, or 9001 if you'd inserted earlier test data)
- Mês/Ano default current

Fill:
- Fala inicial: `"O que você tá fazendo?"`
- Take inicial: `Personagem 1 finalizando cabelo`
- Headline: `POV: você acha que sabe finalizar`
- Construção: paste a multi-line bullet list (3-5 lines) — verify the textarea grows
- Referência: `https://example.com/ref`
- Produto: type `Livre`, press Enter, type `Outlet`, press Enter — verify chips
- Tempo de Vídeo: `Até 1:00s`
- Confirm "Nomeie o vídeo com" updates with template

Click **Salvar** (or press Cmd/Ctrl+S). Toast appears. Redirected to `/dashboard/briefings/<id>` (edit mode).

- [ ] **Step 7: Verify card on list**

Navigate back to `/dashboard/briefings`. Card appears with PAUTA number, headline, fala, products, badge "Nativa". Card has hover lift.

- [ ] **Step 8: Edit existing briefing**

Click the card. Form populates with all fields. Change headline, save. Toast. Field persists on reload (F5).

- [ ] **Step 9: Test beforeunload guard**

Edit a field. Try to navigate away (sidebar link). Browser shows native confirmation. Cancel; field stays.

- [ ] **Step 10: Test Cmd/Ctrl+S**

Edit a field. Press Ctrl+S (or Cmd+S on Mac). Save fires without browser default save-page dialog. Toast appears.

- [ ] **Step 11: Test delete**

In edit mode, click **Excluir**. Confirm. Toast "Pauta removida". Redirected to list. Card no longer present.

- [ ] **Step 12: Test filters on list**

Insert 2-3 more briefings via UI (or via SQL: `supabase db query "insert into briefings (...)"`). On list:
- Change month filter → list updates
- Type briefing number in search → filters to that one
- Type partial text in search → ILIKE match

- [ ] **Step 13: Stop dev server**

Ctrl+C in the dev server terminal.

(Verification only — no commit.)

---

## Task 23: Update PR description

**Files:** None modified.

- [ ] **Step 1: Update PR description via gh**

```bash
gh pr edit 45 --repo goca-se/gocreators-dash --body "$(cat <<'EOF'
## Summary

Implements native pauta management in the Gocreators dashboard, with two distinct pages:

- **Briefings** (`/dashboard/briefings`) — editorial creation/listing of pautas as cards. New form mirrors the Google Docs table layout with auto-resizing textareas, Cmd/Ctrl+S save, and a derived "Nomeie o vídeo com" naming template hint.
- **Alocação de Pautas** (`/dashboard/alocacao`) — operational allocation/status management (renamed from the original `/dashboard/briefings`).

Plus the foundation from the original spec:
- `briefings`, `briefing_assignments` tables and `briefing_with_status` view
- Edge Function `ingest-briefing` for Apps Script ingestion
- Backfill script for legacy CSV import
- Apps Script template (Docs → Edge Function)

## Schema

- `briefings` columns: `headline` (NEW), `construcao` (renamed from `conceito`), `tempo_video` (NEW). Rest unchanged.
- Migration is consolidated single-shot (Strategy A — original migration was rewritten before being merged anywhere).

## Non-impact guarantees (purely additive)

- ✅ `/dashboard/pautas` (analytics) untouched
- ✅ `components/pautas-table.tsx` untouched
- ✅ Sidebar entry "Pautas" in Dashboards group unchanged
- ✅ All existing schemas (`01_creators.sql`...`19_*`) untouched
- ✅ Apps Scripts antigos in legacy Sheets keep operating

## Production deploy state

Was deployed once for validation, then **rolled back at user request** for team review:
- ❌ DB tables/view not in production (rolled back)
- ❌ Edge Function `ingest-briefing` not deployed (deleted)
- ❌ Secrets not set yet

To re-apply when approved:
```bash
supabase db push
supabase functions deploy ingest-briefing
# Owner sets INGEST_BRIEFING_SECRET, NEXT_APP_URL, REVALIDATE_SECRET via dashboard
```

## Pending for full Apps Script flow (post-merge)

1. Owner sets the 3 secrets
2. Paste full File 3 parsing logic into `extractBriefingsFromDoc_` in `scripts/sync-briefings-gocreators.gs`
3. Configure Script Properties per Docs (BRAND_ID, INGEST_URL, INGEST_SECRET)

## Test plan

- [x] `npm run lint` + `npm run build` pass
- [x] Migration consolidated; only CREATE statements in production-bound SQL
- [x] Edge Function smoke-tested via curl (auth, idempotency, validation)
- [x] View aggregate-status transitions verified (nao_alocada → pendente → em_andamento → concluida)
- [x] Native creation walkthrough: create + list + edit + delete + Cmd+S + chips + auto-resize textarea
- [ ] Post-merge in prod: reapply DB + function deploy + smoke-test end-to-end

## Rollback

- Vercel: promote previous deployment (~30s)
- DB: `DROP TABLE briefing_assignments; DROP TABLE briefings; DROP VIEW briefing_with_status;`
- Edge Function: `supabase functions delete ingest-briefing`
- Existing features unaffected in any rollback scenario.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Verify PR description**

```bash
gh pr view 45 --repo goca-se/gocreators-dash | head -40
```
Expected: title and body match the new description.

(No commit — repo metadata only.)

---

## Self-review checklist

- [ ] `git log --oneline main..HEAD` shows ~22-25 atomic commits with scope-prefixed messages.
- [ ] `git diff main -- app/dashboard/pautas` empty (analytics page untouched).
- [ ] `git diff main -- components/pautas-table.tsx` empty.
- [ ] `git diff main -- supabase/schemas/01_creators.sql ... 19_*` empty (existing schemas untouched).
- [ ] `npm run build` and `npm run lint` pass on the final commit.
- [ ] `/dashboard/pautas` (analytics) and `/dashboard/alocacao` (renamed mgmt) and `/dashboard/briefings` (new list) all reachable.
- [ ] Sidebar shows: existing "Pautas" entry in Dashboards (unchanged) + "Briefings" + "Alocação de Pautas" in Gestão (new + renamed respectively).
- [ ] `briefings` table has: headline, construcao, tempo_video. Does NOT have: conceito.

## Open follow-ups (out of scope for this PR)

- Move parsing logic from File 3 into Apps Script template once user provides full file
- Apps Script time-based trigger for automatic Docs → Supabase sync
- Markdown rendering for Construção bullets in card preview
- Deep-link "Alocar agora" from briefing edit page to alocacao detail sheet
- Versioning/history of edits per briefing
- Templates (clone existing as starting point for new pauta)
