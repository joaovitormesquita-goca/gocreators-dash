# Pautas Multi-Select Filter — Design Spec

**Date:** 2026-04-15
**Branch:** `feat/filtropauta`
**Extends:** [2026-04-14-pautas-enhancements-design.md](2026-04-14-pautas-enhancements-design.md)

## Summary

Add a multi-select filter to the Pautas table allowing users to narrow the view to specific guideline numbers. The filter is client-side only — it operates on the metrics already loaded for the selected brand/month.

## Decisions Made

| Decision | Choice | Rationale |
|---|---|---|
| UI pattern | Multi-select dropdown with search (Command + Popover) | Scales to hundreds of pautas, consistent with shadcn/ui patterns |
| Filtering | Client-side | No backend work needed; `metrics` array is already in memory |
| Reset behavior | Clear selection when brand or month changes | Avoids confusing state when selected pautas don't exist in new dataset |
| Empty selection | Shows all pautas | "No filter" = "show everything" |

## 1. Frontend Changes

### Modified: `components/pautas-table.tsx`

**New imports:**

```typescript
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
```

**New state:**

```typescript
const [selectedGuidelines, setSelectedGuidelines] = useState<Set<number>>(new Set());
```

**Reset on brand/month change:**
- `handleBrandChange` — add `setSelectedGuidelines(new Set())` alongside the existing `setSelectedMonth("all")`
- `handleMonthChange` — add `setSelectedGuidelines(new Set())` at the top of the function

**Filter logic in `sorted` useMemo:**

Before sorting, filter `metrics` by `selectedGuidelines` when the set is not empty:

```typescript
const sorted = useMemo(() => {
  const filtered = selectedGuidelines.size === 0
    ? metrics
    : metrics.filter((m) => selectedGuidelines.has(m.guideline_number));

  return [...filtered].sort(/* existing sort logic */);
}, [metrics, sortKey, sortDir, selectedGuidelines]);
```

**Toggle helper:**

```typescript
function toggleGuideline(num: number) {
  setSelectedGuidelines((prev) => {
    const next = new Set(prev);
    if (next.has(num)) next.delete(num);
    else next.add(num);
    return next;
  });
}
```

**Available guidelines list:**

Derived from `metrics` (all guidelines currently loaded for the brand/month):

```typescript
const availableGuidelines = useMemo(
  () => metrics.map((m) => m.guideline_number).sort((a, b) => a - b),
  [metrics]
);
```

### UI layout

New filter added after the "Mês" filter in the filters row:

```tsx
<label className="text-sm font-medium text-muted-foreground">Pautas:</label>
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline" className="w-[200px] justify-start">
      {selectedGuidelines.size === 0
        ? "Todas as pautas"
        : `${selectedGuidelines.size} selecionada${selectedGuidelines.size > 1 ? "s" : ""}`}
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[240px] p-0">
    <Command>
      <CommandInput placeholder="Buscar pauta..." />
      <CommandList>
        <CommandEmpty>Nenhuma pauta encontrada.</CommandEmpty>
        <CommandGroup>
          {availableGuidelines.map((num) => (
            <CommandItem key={num} onSelect={() => toggleGuideline(num)} className="cursor-pointer">
              <Checkbox checked={selectedGuidelines.has(num)} className="mr-2" />
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

## 2. Out of Scope

- Server-side filtering by guideline (not needed — client can filter the already-loaded list)
- Persisting selection in URL params
- "Select all" shortcut (rarely useful when empty already = all)
- Changes to RPC, server actions, or data model
