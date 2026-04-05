"use client";

import { useState, useTransition, useMemo } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  getCostMatrix,
  exportCostCsvFromMatrix,
  type CostMatrixRow,
} from "@/app/dashboard/costs/actions";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { toast } from "sonner";
import { InlineEditCost } from "@/components/inline-edit-cost";
import { CreatorMultiSelect, type CreatorOption } from "@/components/creator-multi-select";
import { MonthMultiSelect } from "@/components/month-multi-select";
import { ImportCostDialogV2 } from "@/components/import-cost-csv/import-cost-dialog-v2";

type Brand = { id: number; name: string };
type SortKey = "creator_name" | "brand_name" | "month" | "cost";
type SortDir = "asc" | "desc";

function formatMonth(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function CostsTable({
  brands,
  initialBrandId,
  initialMatrix,
}: {
  brands: Brand[];
  initialBrandId: number | null;
  initialMatrix: CostMatrixRow[];
}) {
  const [matrix, setMatrix] = useState(initialMatrix);
  const [isPending, startTransition] = useTransition();
  const [isExporting, startExport] = useTransition();
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(initialBrandId);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("creator_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Derive unique creators and months from the matrix
  const creatorOptions: CreatorOption[] = useMemo(() => {
    const seen = new Map<number, string>();
    matrix.forEach((r) => {
      if (!seen.has(r.creator_brand_id)) {
        seen.set(r.creator_brand_id, r.creator_name);
      }
    });
    return Array.from(seen, ([id, name]) => ({ id, full_name: name }));
  }, [matrix]);

  const availableMonths = useMemo(() => {
    const unique = Array.from(new Set(matrix.map((r) => r.month)));
    return unique.sort();
  }, [matrix]);

  function handleBrandChange(value: string) {
    const brandId = Number(value);
    setSelectedBrandId(brandId);
    setSelectedCreatorIds([]);
    setSelectedMonths([]);
    startTransition(async () => {
      const data = await getCostMatrix(brandId);
      setMatrix(data);
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "creator_name" ? "asc" : "desc");
    }
  }

  function handleExportCsv() {
    if (!selectedBrandId) return;

    const sortedMonths = selectedMonths.length > 0
      ? [...selectedMonths].sort()
      : [...availableMonths].sort();
    const monthFrom = sortedMonths[0];
    const monthTo = sortedMonths[sortedMonths.length - 1];
    const creatorBrandIds = selectedCreatorIds.length > 0 ? selectedCreatorIds : undefined;

    startExport(async () => {
      const result = await exportCostCsvFromMatrix(
        selectedBrandId,
        monthFrom,
        monthTo,
        creatorBrandIds,
      );
      if (!result.success) {
        toast.error(result.error);
        return;
      }

      // Filter to selected months if applicable
      let csv = result.csv;
      if (selectedMonths.length > 0) {
        const lines = csv.split("\n");
        const header = lines[0];
        const dataLines = lines.slice(1).filter((line) => {
          const monthMatch = line.match(/^"[^"]*","(\d{4}-\d{2})"/);
          if (!monthMatch) return false;
          return selectedMonths.some((m) => m.startsWith(monthMatch[1]));
        });
        csv = [header, ...dataLines].join("\n");
      }

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `custos-creators-base.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV base exportado");
    });
  }

  function handleCostSaved(creatorBrandId: number, month: string, newCost: number) {
    setMatrix((prev) =>
      prev.map((r) =>
        r.creator_brand_id === creatorBrandId && r.month === month
          ? { ...r, cost: newCost }
          : r,
      ),
    );
  }

  function handleImportSuccess() {
    if (!selectedBrandId) return;
    startTransition(async () => {
      const data = await getCostMatrix(selectedBrandId);
      setMatrix(data);
    });
  }

  const filtered = useMemo(() => {
    let rows = matrix;

    if (selectedCreatorIds.length > 0) {
      rows = rows.filter((r) => selectedCreatorIds.includes(r.creator_brand_id));
    }

    if (selectedMonths.length > 0) {
      rows = rows.filter((r) => selectedMonths.includes(r.month));
    }

    return [...rows].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [matrix, selectedCreatorIds, selectedMonths, sortKey, sortDir]);

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ArrowUpDown className="ml-1 h-3 w-3 inline" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    );
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "creator_name", label: "Creator" },
    { key: "month", label: "Mês" },
    { key: "brand_name", label: "Brand" },
    { key: "cost", label: "Custo" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          value={selectedBrandId?.toString() ?? ""}
          onValueChange={handleBrandChange}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Selecione uma brand" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id.toString()}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <CreatorMultiSelect
          creators={creatorOptions}
          selected={selectedCreatorIds}
          onSelectionChange={setSelectedCreatorIds}
          disabled={!selectedBrandId}
        />

        <MonthMultiSelect
          months={availableMonths}
          selected={selectedMonths}
          onSelectionChange={setSelectedMonths}
          disabled={!selectedBrandId}
        />

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={!selectedBrandId || isExporting || filtered.length === 0}
            onClick={handleExportCsv}
          >
            <Download className="h-4 w-4 mr-1" />
            {isExporting ? "Exportando..." : "Exportar Base CSV"}
          </Button>
          <ImportCostDialogV2 brands={brands} onSuccess={handleImportSuccess} />
        </div>
      </div>

      {brands.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma brand cadastrada.</p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className="cursor-pointer select-none whitespace-nowrap"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <SortIcon column={col.key} />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                    Nenhum dado encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow
                    key={`${row.creator_brand_id}-${row.month}`}
                    className={row.cost == null ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}
                  >
                    <TableCell className="whitespace-nowrap">{row.creator_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatMonth(row.month)}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.brand_name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <InlineEditCost
                        value={row.cost}
                        creatorBrandId={row.creator_brand_id}
                        month={row.month}
                        onSaved={(newCost) =>
                          handleCostSaved(row.creator_brand_id, row.month, newCost)
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
