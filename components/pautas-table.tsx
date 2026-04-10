"use client";

import { useState, useTransition, useMemo } from "react";
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
  getGuidelineMetrics,
  getAvailableMonths,
  type GuidelineMetric,
} from "@/app/dashboard/pautas/actions";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type Brand = { id: number; name: string };
type SortKey = keyof GuidelineMetric;
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

function roasColor(value: number | null) {
  if (value == null) return "";
  if (value >= 2) return "text-green-500";
  if (value >= 1) return "text-yellow-500";
  return "text-red-500";
}

function formatMonthLabel(ym: string) {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

export function PautasTable({
  brands,
  initialBrandId,
  initialData,
  initialMonths,
}: {
  brands: Brand[];
  initialBrandId: number | null;
  initialData: GuidelineMetric[];
  initialMonths: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [metrics, setMetrics] = useState(initialData);
  const [availableMonths, setAvailableMonths] = useState(initialMonths);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>("roas");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const selectedBrandId = searchParams.get("brand")
    ? Number(searchParams.get("brand"))
    : initialBrandId;

  function handleBrandChange(value: string) {
    router.push(`/dashboard/pautas?brand=${value}`);
    setSelectedMonth("all");
    startTransition(async () => {
      const brandId = Number(value);
      const [data, months] = await Promise.all([
        getGuidelineMetrics(brandId),
        getAvailableMonths(brandId),
      ]);
      setMetrics(data);
      setAvailableMonths(months);
    });
  }

  function handleMonthChange(value: string) {
    setSelectedMonth(value);
    if (!selectedBrandId) return;
    startTransition(async () => {
      const month = value === "all" ? undefined : value;
      const data = await getGuidelineMetrics(selectedBrandId, month);
      setMetrics(data);
    });
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "guideline_number" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    return [...metrics].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [metrics, sortKey, sortDir]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "guideline_number", label: "Pauta" },
    { key: "spend", label: "Gasto" },
    { key: "roas", label: "ROAS" },
    { key: "ctr", label: "CTR" },
    { key: "creator_count", label: "Creators" },
  ];

  function formatCell(row: GuidelineMetric, key: SortKey) {
    switch (key) {
      case "guideline_number":
        return `#${row.guideline_number}`;
      case "spend":
        return formatCurrency(row.spend);
      case "roas":
        return formatRoas(row.roas);
      case "ctr":
        return formatCtr(row.ctr);
      case "creator_count":
        return String(row.creator_count);
      default:
        return String(row[key] ?? "");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column)
      return <ArrowUpDown className="ml-1 h-3 w-3 inline" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-muted-foreground">
          Marca:
        </label>
        <Select
          value={selectedBrandId?.toString() ?? ""}
          onValueChange={handleBrandChange}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Selecione uma marca" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id.toString()}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="text-sm font-medium text-muted-foreground">
          Mês:
        </label>
        <Select value={selectedMonth} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os meses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {brands.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma marca cadastrada.
        </p>
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
                  <TableCell
                    colSpan={columns.length}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nenhuma pauta encontrada para esta marca.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row) => (
                  <TableRow key={row.guideline_number}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.key}
                        className={`whitespace-nowrap ${col.key === "roas" ? roasColor(row.roas) : ""}`}
                      >
                        {formatCell(row, col.key)}
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
