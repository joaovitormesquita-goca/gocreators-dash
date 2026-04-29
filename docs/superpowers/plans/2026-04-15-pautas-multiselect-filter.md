# Pautas Multi-Select Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side multi-select filter that lets users narrow the Pautas table to specific guideline numbers.

**Architecture:** Single file change. Adds a new piece of state (`selectedGuidelines: Set<number>`), a Popover+Command UI for multi-select with search, and a filter step inside the existing `sorted` useMemo. Resets on brand/month change.

**Tech Stack:** React (client component), Next.js 14, shadcn/ui (Popover, Command, Checkbox, Button), TypeScript

**Spec:** `docs/superpowers/specs/2026-04-15-pautas-multiselect-filter-design.md`

**Branch:** `feat/filtropauta`

---

## File Structure

### Modified files
- `components/pautas-table.tsx` — add state, filter logic, multi-select UI

All required shadcn/ui components already exist in the project (`components/ui/popover.tsx`, `command.tsx`, `checkbox.tsx`, `button.tsx`).

---

### Task 1: Add imports, state, and helpers

**File:** `components/pautas-table.tsx`

- [ ] **Step 1: Add imports for new UI components**

At the top of the file, add these imports after the existing `@/components/ui/skeleton` import (currently on line 20):

```typescript
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
```

- [ ] **Step 2: Add `selectedGuidelines` state**

Inside the `PautasTable` component, after the existing `const [sortDir, setSortDir] = useState<SortDir>("desc");` line (currently line 103), add:

```typescript
  const [selectedGuidelines, setSelectedGuidelines] = useState<Set<number>>(new Set());
```

- [ ] **Step 3: Add `toggleGuideline` helper and `availableGuidelines` derived value**

After the `selectedBrandId` derivation and before `handleBrandChange`, add:

```typescript
  const availableGuidelines = useMemo(
    () => metrics.map((m) => m.guideline_number).sort((a, b) => a - b),
    [metrics],
  );

  function toggleGuideline(num: number) {
    setSelectedGuidelines((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  }
```

- [ ] **Step 4: Reset `selectedGuidelines` on brand and month changes**

Replace the current `handleBrandChange` (currently lines 109-126) with:

```typescript
  function handleBrandChange(value: string) {
    router.push(`/dashboard/pautas?brand=${value}`);
    setSelectedMonth("all");
    setSelectedGuidelines(new Set());
    startTransition(async () => {
      try {
        const brandId = Number(value);
        const [data, months] = await Promise.all([
          getGuidelineMetrics(brandId),
          getAvailableMonths(brandId),
        ]);
        setMetrics(data);
        setAvailableMonths(months);
      } catch {
        setMetrics([]);
        setAvailableMonths([]);
      }
    });
  }
```

Replace the current `handleMonthChange` (currently lines 128-140) with:

```typescript
  function handleMonthChange(value: string) {
    setSelectedMonth(value);
    setSelectedGuidelines(new Set());
    if (!selectedBrandId) return;
    startTransition(async () => {
      try {
        const month = value === "all" ? undefined : value;
        const data = await getGuidelineMetrics(selectedBrandId, month);
        setMetrics(data);
      } catch {
        setMetrics([]);
      }
    });
  }
```

- [ ] **Step 5: Update `sorted` useMemo to apply the filter**

Replace the current `sorted` useMemo (currently lines 151-170) with:

```typescript
  const sorted = useMemo(() => {
    const filtered =
      selectedGuidelines.size === 0
        ? metrics
        : metrics.filter((m) => selectedGuidelines.has(m.guideline_number));

    return [...filtered].sort((a, b) => {
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
  }, [metrics, sortKey, sortDir, selectedGuidelines]);
```

- [ ] **Step 6: Commit**

```bash
git add components/pautas-table.tsx
git commit -m "feat(pautas): add selectedGuidelines state and filter logic"
```

---

### Task 2: Add the multi-select UI

**File:** `components/pautas-table.tsx`

- [ ] **Step 1: Add the Popover filter after the month filter**

Find the closing `</Select>` of the month filter (around line 253) and add this new block immediately after it, before the closing `</div>` of the filters row:

```tsx
        <label className="text-sm font-medium text-muted-foreground">
          Pautas:
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-start font-normal">
              {selectedGuidelines.size === 0
                ? "Todas as pautas"
                : `${selectedGuidelines.size} selecionada${selectedGuidelines.size > 1 ? "s" : ""}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar pauta..." />
              <CommandList>
                <CommandEmpty>Nenhuma pauta encontrada.</CommandEmpty>
                <CommandGroup>
                  {availableGuidelines.map((num) => (
                    <CommandItem
                      key={num}
                      value={String(num)}
                      onSelect={() => toggleGuideline(num)}
                      className="cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedGuidelines.has(num)}
                        className="mr-2"
                      />
                      #{num}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
              {selectedGuidelines.size > 0 && (
                <div className="border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedGuidelines(new Set())}
                  >
                    Limpar seleção
                  </Button>
                </div>
              )}
            </Command>
          </PopoverContent>
        </Popover>
```

The filters row should now have three filters: Marca, Mês, Pautas.

- [ ] **Step 2: Commit**

```bash
git add components/pautas-table.tsx
git commit -m "feat(pautas): add multi-select guideline filter UI"
```

---

### Task 3: Build verification

- [ ] **Step 1: Run lint on the changed file**

Run: `npx eslint components/pautas-table.tsx`

Expected: No errors.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: Build succeeds, `/dashboard/pautas` listed in output.

- [ ] **Step 3: Manual smoke test**

Start dev server if not running: `npm run dev`

Visit `http://localhost:3000/dashboard/pautas` and verify:
- Pautas filter appears next to Mês filter
- Trigger shows "Todas as pautas" initially
- Clicking opens a popover with a search input and checkbox list
- Searching filters the list
- Selecting items updates the trigger text ("N selecionadas")
- Selecting items filters the table
- "Limpar seleção" button appears when at least one is selected and clears all
- Changing brand or month resets the selection back to "Todas as pautas"

- [ ] **Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: resolve build/lint issues for pautas multi-select filter"
```
