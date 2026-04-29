# Brand Goals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow traffic managers to set monthly share goals per brand and display them as dashed reference lines on charts.

**Architecture:** New `brand_goals` table with CRUD via server actions, a goals management section on the brands page with cascade selectors, and `ReferenceLine` integration in the existing `SpendShareChart` component. Data flows from the brands page (CRUD) to the chart views (read-only display).

**Tech Stack:** Next.js 14 App Router, Supabase PostgreSQL, Recharts `ReferenceLine`, Zod validation, shadcn/ui components, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-04-08-brand-goals-design.md`
**Issue:** #24

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/schemas/17_brand_goals.sql` | Create | Declarative schema for brand_goals table |
| `lib/schemas/brand.ts` | Modify | Add Zod schemas for goal upsert/delete |
| `app/dashboard/brands/actions.ts` | Modify | Add goal CRUD server actions |
| `app/dashboard/brands/page.tsx` | Modify | Include BrandGoalsSection below brands table |
| `components/brand-goals-section.tsx` | Create | Client component: goals form + summary table |
| `components/spend-share-chart.tsx` | Modify | Add optional `goalValue` prop + ReferenceLine |
| `app/dashboard/monthly-view/actions.ts` | Modify | Add `getGoalsForBrand` server action |
| `app/dashboard/daily-view/actions.ts` | Modify | Add `getGoalsForBrand` server action |
| `components/monthly-view-charts.tsx` | Modify | Fetch goals and pass to SpendShareChart |
| `components/daily-view-charts.tsx` | Modify | Fetch goals and pass to SpendShareChart |

---

## Task 1: Database Schema

**Files:**
- Create: `supabase/schemas/17_brand_goals.sql`

- [ ] **Step 1: Create declarative schema file**

```sql
-- supabase/schemas/17_brand_goals.sql
create table if not exists "public"."brand_goals" (
  "id" uuid not null default gen_random_uuid(),
  "brand_id" bigint not null,
  "metric" text not null,
  "month" date not null,
  "value" numeric not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),

  constraint "brand_goals_pkey" primary key ("id"),
  constraint "brand_goals_brand_id_fkey" foreign key ("brand_id") references "public"."brands"("id") on delete cascade,
  constraint "brand_goals_metric_check" check ("metric" in ('share_total', 'share_recent')),
  constraint "brand_goals_value_check" check ("value" >= 0 and "value" <= 100),
  constraint "brand_goals_brand_id_metric_month_key" unique ("brand_id", "metric", "month")
);
```

- [ ] **Step 2: Generate and apply migration**

```bash
supabase db diff -f add_brand_goals_table
supabase migration up
```

Expected: Migration created in `supabase/migrations/` and applied locally without errors.

- [ ] **Step 3: Verify table exists**

```bash
supabase db reset 2>&1 | tail -5
```

Expected: No errors. Schema applies cleanly. (Alternative: check via Supabase Studio that `brand_goals` table exists with all constraints.)

- [ ] **Step 4: Commit**

```bash
git add supabase/schemas/17_brand_goals.sql supabase/migrations/
git commit -m "feat: add brand_goals table schema

Closes part of #24"
```

---

## Task 2: Zod Schemas

**Files:**
- Modify: `lib/schemas/brand.ts`

- [ ] **Step 1: Add goal schemas to brand.ts**

Add the following at the end of `lib/schemas/brand.ts`:

```typescript
// --- Brand Goals ---

export const upsertBrandGoalSchema = z.object({
  brandId: z.number(),
  metric: z.enum(["share_total", "share_recent"]),
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "Mês deve estar no formato YYYY-MM-01"),
  value: z.number().min(0, "Meta deve ser maior ou igual a 0").max(100, "Meta deve ser menor ou igual a 100"),
});

export type UpsertBrandGoalInput = z.infer<typeof upsertBrandGoalSchema>;

export const deleteBrandGoalSchema = z.object({
  goalId: z.string().uuid("ID inválido"),
});

export type DeleteBrandGoalInput = z.infer<typeof deleteBrandGoalSchema>;
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas/brand.ts
git commit -m "feat: add Zod schemas for brand goals"
```

---

## Task 3: Server Actions (CRUD)

**Files:**
- Modify: `app/dashboard/brands/actions.ts`

- [ ] **Step 1: Add BrandGoal type and CRUD actions**

Add the following imports at the top of `app/dashboard/brands/actions.ts` (merge with existing imports from `@/lib/schemas/brand`):

```typescript
import {
  // ... existing imports ...
  upsertBrandGoalSchema,
  deleteBrandGoalSchema,
  type UpsertBrandGoalInput,
  type DeleteBrandGoalInput,
} from "@/lib/schemas/brand";
```

Add the BrandGoal type alongside existing types:

```typescript
export type BrandGoal = {
  id: string;
  brand_id: number;
  metric: "share_total" | "share_recent";
  month: string;
  value: number;
};
```

Add three new server actions at the end of the file:

```typescript
export async function getBrandGoals(brandId: number): Promise<BrandGoal[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brand_goals")
    .select("id, brand_id, metric, month, value")
    .eq("brand_id", brandId)
    .order("month", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BrandGoal[];
}

export async function upsertBrandGoal(
  input: UpsertBrandGoalInput,
): Promise<ActionResult> {
  const parsed = upsertBrandGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("brand_goals")
    .upsert(
      {
        brand_id: parsed.data.brandId,
        metric: parsed.data.metric,
        month: parsed.data.month,
        value: parsed.data.value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand_id,metric,month" },
    );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}

export async function deleteBrandGoal(
  input: DeleteBrandGoalInput,
): Promise<ActionResult> {
  const parsed = deleteBrandGoalSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("brand_goals")
    .delete()
    .eq("id", parsed.data.goalId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/brands/actions.ts
git commit -m "feat: add brand goals CRUD server actions"
```

---

## Task 4: BrandGoalsSection Component

**Files:**
- Create: `components/brand-goals-section.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { useState, useEffect, useTransition } from "react";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import {
  getBrandGoals,
  upsertBrandGoal,
  deleteBrandGoal,
  type BrandGoal,
} from "@/app/dashboard/brands/actions";

type Brand = { id: number; name: string };

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const start = subMonths(startOfMonth(now), 6);

  for (let i = 0; i < 15; i++) {
    const date = addMonths(start, i);
    options.push({
      value: format(date, "yyyy-MM-01"),
      label: format(date, "MMMM yyyy", { locale: ptBR }),
    });
  }
  return options;
}

const metricOptions = [
  { value: "share_total", label: "Share Total" },
  { value: "share_recent", label: "Share Recente" },
] as const;

export function BrandGoalsSection({ brands }: { brands: Brand[] }) {
  const [isPending, startTransition] = useTransition();
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<string>("");
  const [goalValue, setGoalValue] = useState<string>("");
  const [goals, setGoals] = useState<BrandGoal[]>([]);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<BrandGoal | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const monthOptions = generateMonthOptions();

  useEffect(() => {
    if (selectedBrandId) {
      getBrandGoals(selectedBrandId).then(setGoals);
    } else {
      setGoals([]);
    }
  }, [selectedBrandId]);

  // Auto-load existing goal when brand + month + metric are selected
  useEffect(() => {
    if (!selectedBrandId || !selectedMonth || !selectedMetric) return;

    const existing = goals.find(
      (g) => g.month === selectedMonth && g.metric === selectedMetric,
    );

    if (existing) {
      setGoalValue(String(existing.value));
      setEditingGoalId(existing.id);
    } else {
      setGoalValue("");
      setEditingGoalId(null);
    }
  }, [selectedBrandId, selectedMonth, selectedMetric, goals]);

  function handleBrandChange(value: string) {
    const brandId = Number(value);
    setSelectedBrandId(brandId);
    setSelectedMonth("");
    setSelectedMetric("");
    setGoalValue("");
    setEditingGoalId(null);
  }

  function handleSave() {
    if (!selectedBrandId || !selectedMonth || !selectedMetric || !goalValue) return;

    const numericValue = parseFloat(goalValue);
    if (isNaN(numericValue)) {
      toast.error("Valor inválido");
      return;
    }

    startTransition(async () => {
      const result = await upsertBrandGoal({
        brandId: selectedBrandId,
        metric: selectedMetric as "share_total" | "share_recent",
        month: selectedMonth,
        value: numericValue,
      });

      if (result.success) {
        toast.success(editingGoalId ? "Meta atualizada!" : "Meta salva!");
        const updatedGoals = await getBrandGoals(selectedBrandId);
        setGoals(updatedGoals);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleEdit(goal: BrandGoal) {
    setSelectedMonth(goal.month);
    setSelectedMetric(goal.metric);
    setGoalValue(String(goal.value));
    setEditingGoalId(goal.id);
  }

  function handleDelete() {
    if (!deletingGoal || !selectedBrandId) return;

    startDeleteTransition(async () => {
      const result = await deleteBrandGoal({ goalId: deletingGoal.id });
      if (result.success) {
        toast.success("Meta excluída!");
        setDeletingGoal(null);
        const updatedGoals = await getBrandGoals(selectedBrandId);
        setGoals(updatedGoals);
        if (editingGoalId === deletingGoal.id) {
          setGoalValue("");
          setEditingGoalId(null);
        }
      } else {
        toast.error(result.error);
      }
    });
  }

  function formatMonth(dateStr: string): string {
    const date = new Date(dateStr + "T00:00:00");
    return format(date, "MMM/yyyy", { locale: ptBR });
  }

  function formatMetricLabel(metric: string): string {
    return metric === "share_total" ? "Share Total" : "Share Recente";
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Metas</h2>

      {/* Form row */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Marca
          </Label>
          <Select
            value={selectedBrandId?.toString() ?? ""}
            onValueChange={handleBrandChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Mês
          </Label>
          <Select
            value={selectedMonth}
            onValueChange={setSelectedMonth}
            disabled={!selectedBrandId}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Métrica
          </Label>
          <Select
            value={selectedMetric}
            onValueChange={setSelectedMetric}
            disabled={!selectedBrandId}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {metricOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">
            Meta (%)
          </Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="100"
            placeholder="0.0"
            className="w-[100px]"
            value={goalValue}
            onChange={(e) => setGoalValue(e.target.value)}
            disabled={!selectedBrandId || !selectedMonth || !selectedMetric}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={
            isPending ||
            !selectedBrandId ||
            !selectedMonth ||
            !selectedMetric ||
            !goalValue
          }
        >
          {isPending
            ? "Salvando..."
            : editingGoalId
              ? "Atualizar"
              : "Salvar"}
        </Button>
      </div>

      {/* Summary table */}
      {selectedBrandId && goals.length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead className="w-[80px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((goal) => (
                <TableRow key={goal.id}>
                  <TableCell>{formatMonth(goal.month)}</TableCell>
                  <TableCell>{formatMetricLabel(goal.metric)}</TableCell>
                  <TableCell className="font-mono">{goal.value}%</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(goal)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingGoal(goal)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedBrandId && goals.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">
          Nenhuma meta cadastrada para esta marca.
        </p>
      )}

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={deletingGoal !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingGoal(null);
        }}
        title="Excluir meta"
        description={
          deletingGoal
            ? `Excluir a meta de ${formatMetricLabel(deletingGoal.metric)} para ${formatMonth(deletingGoal.month)}? Esta ação não pode ser desfeita.`
            : ""
        }
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds (component is not yet imported anywhere, but should compile).

- [ ] **Step 3: Commit**

```bash
git add components/brand-goals-section.tsx
git commit -m "feat: add BrandGoalsSection component for managing goals"
```

---

## Task 5: Integrate Goals Section into Brands Page

**Files:**
- Modify: `app/dashboard/brands/page.tsx`

- [ ] **Step 1: Update brands page to include BrandGoalsSection**

Replace the entire content of `app/dashboard/brands/page.tsx` with:

```typescript
import { BrandsTable } from "@/components/brands-table";
import { BrandGoalsSection } from "@/components/brand-goals-section";
import { CreateBrandDialog } from "@/components/create-brand-dialog";
import { getBrandsWithAdAccounts } from "./actions";

export default async function BrandsPage() {
  const brands = await getBrandsWithAdAccounts();

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Marcas</h1>
          <CreateBrandDialog />
        </div>
        <BrandsTable brands={brands} />
      </div>

      <BrandGoalsSection
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run dev server and verify page renders**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard/brands`. Verify:
- Brands table renders as before
- "Metas" section appears below with the 4 selectors
- Selecting a brand loads its goals (empty table for now)
- Creating/editing/deleting goals works via the form

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/brands/page.tsx
git commit -m "feat: integrate BrandGoalsSection into brands page"
```

---

## Task 6: Add Goal Line to SpendShareChart

**Files:**
- Modify: `components/spend-share-chart.tsx`

- [ ] **Step 1: Add ReferenceLine import and goalValue prop**

In `components/spend-share-chart.tsx`, update the recharts import to include `ReferenceLine`:

```typescript
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
```

Update the interface:

```typescript
interface SpendShareChartProps {
  data: SpendShareDataPoint[];
  title: string;
  goalValue?: number;
}
```

Update the component signature:

```typescript
export function SpendShareChart({ data, title, goalValue }: SpendShareChartProps) {
```

- [ ] **Step 2: Add ReferenceLine and update chartConfig/legend**

Add `goal` entry to `chartConfig`:

```typescript
const chartConfig = {
  spend: {
    label: "Gasto em Creators (R$)",
    color: "hsl(var(--chart-1))",
  },
  sharePercent: {
    label: "Share %",
    color: "hsl(var(--chart-2))",
  },
  goal: {
    label: "Meta",
    color: "#ef4444",
  },
} satisfies ChartConfig;
```

Add the `ReferenceLine` inside `<ComposedChart>`, right after the `<Line>` element:

```typescript
          {goalValue !== undefined && (
            <ReferenceLine
              yAxisId="right"
              y={goalValue}
              stroke="#ef4444"
              strokeDasharray="6 4"
              strokeWidth={2}
              label={{
                value: `Meta: ${goalValue}%`,
                position: "right",
                fill: "#ef4444",
                fontSize: 11,
              }}
            />
          )}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds. Existing charts render without changes (goalValue is undefined by default).

- [ ] **Step 4: Commit**

```bash
git add components/spend-share-chart.tsx
git commit -m "feat: add optional goal reference line to SpendShareChart"
```

---

## Task 7: Fetch Goals in Monthly View

**Files:**
- Modify: `app/dashboard/monthly-view/actions.ts`
- Modify: `components/monthly-view-charts.tsx`

- [ ] **Step 1: Add getGoalsForBrand action**

Add to the end of `app/dashboard/monthly-view/actions.ts`:

```typescript
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brand_goals")
    .select("metric, month, value")
    .eq("brand_id", brandId)
    .gte("month", startDate)
    .lte("month", endDate);

  if (error) throw new Error(error.message);
  return (data ?? []) as BrandGoalRow[];
}
```

- [ ] **Step 2: Update MonthlyViewCharts to fetch and pass goals**

In `components/monthly-view-charts.tsx`, add import:

```typescript
import { getMonthlySpendView, getCreatorsByBrand, getGroupsByBrand, getCreatorsByBrandAndGroup, getGoalsForBrand, type MonthlySpendRow, type GroupOption, type BrandGoalRow } from "@/app/dashboard/monthly-view/actions";
```

Add state for goals:

```typescript
const [goals, setGoals] = useState<BrandGoalRow[]>([]);
```

Add a helper function to extract the most recent month's goal for a metric:

```typescript
function getGoalValue(
  goals: BrandGoalRow[],
  metric: "share_total" | "share_recent",
): number | undefined {
  const metricGoals = goals
    .filter((g) => g.metric === metric)
    .sort((a, b) => b.month.localeCompare(a.month));
  return metricGoals.length > 0 ? Number(metricGoals[0].value) : undefined;
}
```

In the `fetchData` callback, after fetching spend data, also fetch goals:

```typescript
  const fetchData = useCallback(
    (brandId: number, creatorIds: number[], range: { from: Date; to: Date }) => {
      startTransition(async () => {
        const allSelected = creatorIds.length === 0;
        const [rows, brandGoals] = await Promise.all([
          getMonthlySpendView({
            brandId,
            creatorIds: allSelected ? undefined : creatorIds,
            startDate: format(range.from, "yyyy-MM-dd"),
            endDate: format(range.to, "yyyy-MM-dd"),
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

Do the same in `handleBrandChange` — fetch goals alongside spend data:

```typescript
  function handleBrandChange(value: string) {
    const brandId = Number(value);
    setSelectedBrandId(brandId);
    setSelectedGroupId("all");
    router.push(`/dashboard/monthly-view?brand=${brandId}`);
    startTransition(async () => {
      const newCreators = await getCreatorsByBrand(brandId);
      setCreators(newCreators);
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

Do the same in `handleGroupChange` — add goals fetch in parallel:

```typescript
  function handleGroupChange(value: string) {
    setSelectedGroupId(value);
    if (!selectedBrandId) return;
    startTransition(async () => {
      const groupId = value === "all" ? null : value === "none" ? 0 : Number(value);
      const filteredCreators = groupId === null
        ? await getCreatorsByBrand(selectedBrandId)
        : await getCreatorsByBrandAndGroup(selectedBrandId, groupId);
      setCreators(filteredCreators);
      const allIds = filteredCreators.map((c) => c.id);
      setSelectedCreatorIds(allIds);
      const [rows, brandGoals] = await Promise.all([
        getMonthlySpendView({
          brandId: selectedBrandId,
          creatorIds: allIds.length > 0 ? allIds : undefined,
          startDate: format(dateRange.from, "yyyy-MM-dd"),
          endDate: format(dateRange.to, "yyyy-MM-dd"),
        }),
        getGoalsForBrand(
          selectedBrandId,
          format(dateRange.from, "yyyy-MM-01"),
          format(dateRange.to, "yyyy-MM-01"),
        ),
      ]);
      setData(rows);
      setGoals(brandGoals);
    });
  }
```

Pass `goalValue` to each SpendShareChart:

```typescript
        <div className="space-y-8">
          <SpendShareChart
            data={totalChartData}
            title="Gasto total em creators"
            goalValue={getGoalValue(goals, "share_total")}
          />
          <SpendShareChart
            data={recentesChartData}
            title="Gasto em conteúdo recente de creators"
            goalValue={getGoalValue(goals, "share_recent")}
          />
        </div>
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Manual test**

Open `http://localhost:3000/dashboard/monthly-view`, select a brand that has goals set. Verify:
- Red dashed line appears at the goal percentage
- Label "Meta: X%" visible on the right
- Switching brands updates/removes the line correctly
- Changing date range updates the goal line

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/monthly-view/actions.ts components/monthly-view-charts.tsx
git commit -m "feat: display goal reference lines in monthly view charts"
```

---

## Task 8: Fetch Goals in Daily View

**Files:**
- Modify: `app/dashboard/daily-view/actions.ts`
- Modify: `components/daily-view-charts.tsx`

- [ ] **Step 1: Add getGoalsForBrand action**

Add to the end of `app/dashboard/daily-view/actions.ts`:

```typescript
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brand_goals")
    .select("metric, month, value")
    .eq("brand_id", brandId)
    .gte("month", startDate)
    .lte("month", endDate);

  if (error) throw new Error(error.message);
  return (data ?? []) as BrandGoalRow[];
}
```

- [ ] **Step 2: Update DailyViewCharts to fetch and pass goals**

In `components/daily-view-charts.tsx`, update the import:

```typescript
import { getDailySpendView, getCreatorsByBrand, getGroupsByBrand, getCreatorsByBrandAndGroup, getGoalsForBrand, type DailySpendRow, type GroupOption, type BrandGoalRow } from "@/app/dashboard/daily-view/actions";
```

Add state for goals:

```typescript
const [goals, setGoals] = useState<BrandGoalRow[]>([]);
```

Add the same `getGoalValue` helper:

```typescript
function getGoalValue(
  goals: BrandGoalRow[],
  metric: "share_total" | "share_recent",
): number | undefined {
  const metricGoals = goals
    .filter((g) => g.metric === metric)
    .sort((a, b) => b.month.localeCompare(a.month));
  return metricGoals.length > 0 ? Number(metricGoals[0].value) : undefined;
}
```

In `fetchData`, fetch goals in parallel (use `format(range.from, "yyyy-MM-01")` and `format(range.to, "yyyy-MM-01")` for date range):

```typescript
  const fetchData = useCallback(
    (brandId: number, creatorIds: number[], range: { from: Date; to: Date }) => {
      startTransition(async () => {
        const allSelected = creatorIds.length === 0;
        const [rows, brandGoals] = await Promise.all([
          getDailySpendView({
            brandId,
            creatorIds: allSelected ? undefined : creatorIds,
            startDate: format(range.from, "yyyy-MM-dd"),
            endDate: format(range.to, "yyyy-MM-dd"),
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

In `handleBrandChange`, fetch goals in parallel:

```typescript
  function handleBrandChange(value: string) {
    const brandId = Number(value);
    setSelectedBrandId(brandId);
    setSelectedGroupId("all");
    router.push(`/dashboard/daily-view?brand=${brandId}`);
    startTransition(async () => {
      const newCreators = await getCreatorsByBrand(brandId);
      setCreators(newCreators);
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

In `handleGroupChange`, fetch goals in parallel:

```typescript
  function handleGroupChange(value: string) {
    setSelectedGroupId(value);
    if (!selectedBrandId) return;
    startTransition(async () => {
      const groupId = value === "all" ? null : value === "none" ? 0 : Number(value);
      const filteredCreators = groupId === null
        ? await getCreatorsByBrand(selectedBrandId)
        : await getCreatorsByBrandAndGroup(selectedBrandId, groupId);
      setCreators(filteredCreators);
      const allIds = filteredCreators.map((c) => c.id);
      setSelectedCreatorIds(allIds);
      const [rows, brandGoals] = await Promise.all([
        getDailySpendView({
          brandId: selectedBrandId,
          creatorIds: allIds.length > 0 ? allIds : undefined,
          startDate: format(dateRange.from, "yyyy-MM-dd"),
          endDate: format(dateRange.to, "yyyy-MM-dd"),
        }),
        getGoalsForBrand(
          selectedBrandId,
          format(dateRange.from, "yyyy-MM-01"),
          format(dateRange.to, "yyyy-MM-01"),
        ),
      ]);
      setData(rows);
      setGoals(brandGoals);
    });
  }
```

Pass `goalValue` to each SpendShareChart:

```typescript
        <div className="space-y-8">
          <SpendShareChart
            data={totalChartData}
            title="Gasto total em creators"
            goalValue={getGoalValue(goals, "share_total")}
          />
          <SpendShareChart
            data={recentesChartData}
            title="Gasto em conteúdo recente de creators"
            goalValue={getGoalValue(goals, "share_recent")}
          />
        </div>
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Manual test**

Open `http://localhost:3000/dashboard/daily-view`, select a brand with goals. Verify:
- Red dashed goal line appears
- Switching month periods updates the line
- Brand without goals shows no line

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/daily-view/actions.ts components/daily-view-charts.tsx
git commit -m "feat: display goal reference lines in daily view charts"
```

---

## Task 9: Final Verification & Lint

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: No errors. Fix any warnings if present.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: End-to-end manual verification**

Verify the complete flow:
1. Go to `/dashboard/brands` → "Metas" section visible
2. Select brand → select month → select metric → enter value → click "Salvar"
3. Goal appears in the summary table
4. Select same brand/month/metric → value auto-loads, button says "Atualizar"
5. Edit via pencil icon → form populates
6. Delete via trash icon → confirmation → goal removed
7. Go to `/dashboard/monthly-view` → select same brand → red dashed goal line visible
8. Go to `/dashboard/daily-view` → select same brand → red dashed goal line visible
9. Select brand with no goals → no goal line

- [ ] **Step 4: Final commit (if any lint/build fixes)**

```bash
git add -A
git commit -m "fix: lint and build fixes for brand goals feature"
```

(Skip this step if no fixes were needed.)
