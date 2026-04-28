"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCreatorMetrics,
  getGroupsByBrand,
  type CreatorMetric,
  type GroupOption,
} from "@/app/dashboard/creators/actions";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { InlineEditCost } from "@/components/inline-edit-cost";

type Brand = { id: number; name: string };
type SortKey = keyof CreatorMetric;
type SortDir = "asc" | "desc";

function formatCurrency(value: number | null) {
  if (value == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatRoas(value: number | null) {
  if (value == null) return "0.00x";
  return `${Number(value).toFixed(2)}x`;
}

function formatCtr(value: number | null) {
  if (value == null) return "0.00%";
  return `${Number(value).toFixed(2)}%`;
}

function formatMonth(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function CreatorsTable({
  brands,
  initialBrandId,
  initialMetrics,
}: {
  brands: Brand[];
  initialBrandId: number | null;
  initialMetrics: CreatorMetric[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>("creator");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [groups, setGroups] = useState<GroupOption[]>([]);

  const selectedBrandId = searchParams.get("brand")
    ? Number(searchParams.get("brand"))
    : initialBrandId;

  useEffect(() => {
    if (selectedBrandId) {
      getGroupsByBrand(selectedBrandId).then(setGroups);
    } else {
      setGroups([]);
    }
  }, [selectedBrandId]);

  const availableMonths = useMemo(() => {
    const unique = Array.from(new Set(metrics.map((m) => m.month)));
    return unique.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [metrics]);

  function handleBrandChange(value: string) {
    router.push(`/dashboard/creators?brand=${value}`);
    setSelectedMonth("all");
    setSelectedGroupId("all");
    startTransition(async () => {
      const data = await getCreatorMetrics(Number(value));
      setMetrics(data);
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "creator" ? "asc" : "desc");
    }
  }

  function handleCostSaved(index: number, newCost: number) {
    setMetrics((prev) =>
      prev.map((m, i) => (i === index ? { ...m, cost: newCost } : m)),
    );
  }

  const sorted = useMemo(() => {
    let filtered = selectedMonth === "all"
      ? metrics
      : metrics.filter((m) => m.month === selectedMonth);

    if (selectedGroupId !== "all") {
      if (selectedGroupId === "none") {
        filtered = filtered.filter((m) => m.group_id == null);
      } else {
        filtered = filtered.filter((m) => m.group_id === Number(selectedGroupId));
      }
    }

    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [metrics, sortKey, sortDir, selectedMonth, selectedGroupId]);

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <ArrowUpDown className="ml-1 h-3 w-3 inline" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    );
  }

  const columns: { key: SortKey; label: string; sortable?: boolean }[] = [
    { key: "month", label: "Mês/Ano" },
    { key: "creator", label: "Creator" },
    { key: "product_names", label: "Produto", sortable: false },
    { key: "cost", label: "Custo" },
    { key: "yearly_spend", label: "Investimento Ano" },
    { key: "spend_total", label: "Gasto" },
    { key: "roas_total", label: "ROAS" },
    { key: "ctr_total", label: "CTR" },
    { key: "spend_recentes", label: "Gasto Recentes" },
    { key: "roas_recentes", label: "ROAS Recentes" },
    { key: "ctr_recentes", label: "CTR Recentes" },
  ];

  function formatCell(row: CreatorMetric, key: SortKey) {
    switch (key) {
      case "month":
        return formatMonth(row.month);
      case "creator":
        return row.creator;
      case "product_names":
        return row.product_names ?? "Não informado";
      case "spend_total":
      case "spend_recentes":
      case "yearly_spend":
        return formatCurrency(row[key] as number);
      case "roas_total":
      case "roas_recentes":
        return formatRoas(row[key] as number);
      case "ctr_total":
      case "ctr_recentes":
        return formatCtr(row[key] as number);
      default:
        return String(row[key] ?? "");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-muted-foreground">Brand:</label>
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

        {groups.length > 0 && (
          <>
            <label className="text-sm font-medium text-muted-foreground">Grupo:</label>
            <Select
              value={selectedGroupId}
              onValueChange={setSelectedGroupId}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos os grupos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                <SelectItem value="none">Sem grupo</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id.toString()}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <label className="text-sm font-medium text-muted-foreground">Mês:</label>
        <Select
          value={selectedMonth}
          onValueChange={setSelectedMonth}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os meses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    className={`${col.sortable === false ? "" : "cursor-pointer"} select-none whitespace-nowrap`}
                    onClick={() => { if (col.sortable !== false) handleSort(col.key); }}
                  >
                    {col.label}
                    {col.sortable !== false && <SortIcon column={col.key} />}
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
              ) : sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-8">
                    Nenhum dado encontrado para esta brand.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row, i) => (
                  <TableRow key={`${row.creator}-${row.month}-${i}`}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className="whitespace-nowrap">
                        {col.key === "cost" ? (
                          <InlineEditCost
                            value={row.cost}
                            creatorBrandId={row.creator_brand_id}
                            month={row.month}
                            onSaved={(newCost) => {
                              const originalIndex = metrics.findIndex(
                                (m) =>
                                  m.creator_brand_id === row.creator_brand_id &&
                                  m.month === row.month,
                              );
                              if (originalIndex !== -1) handleCostSaved(originalIndex, newCost);
                            }}
                          />
                        ) : (
                          formatCell(row, col.key)
                        )}
                      </TableCell>
                    ))}
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
