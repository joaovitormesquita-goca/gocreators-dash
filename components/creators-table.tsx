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

  const columns: { key: SortKey; label: string; format: (v: CreatorMetric) => string }[] = [
    { key: "month", label: "Mês/Ano", format: (r) => formatMonth(r.month) },
    { key: "creator", label: "Creator", format: (r) => r.creator },
    { key: "spend_total", label: "Gasto", format: (r) => formatCurrency(r.spend_total) },
    { key: "roas_total", label: "ROAS", format: (r) => formatRoas(r.roas_total) },
    { key: "ctr_total", label: "CTR", format: (r) => formatCtr(r.ctr_total) },
    { key: "spend_recentes", label: "Gasto Recentes", format: (r) => formatCurrency(r.spend_recentes) },
    { key: "roas_recentes", label: "ROAS Recentes", format: (r) => formatRoas(r.roas_recentes) },
    { key: "ctr_recentes", label: "CTR Recentes", format: (r) => formatCtr(r.ctr_recentes) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
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
                        {col.format(row)}
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
