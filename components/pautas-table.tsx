"use client";

import { useEffect, useRef, useState, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ProductMultiSelect } from "@/components/product-multi-select";
import {
  getGuidelineMetrics,
  getAvailableMonths,
  getDistinctProducts,
  type GuidelineMetric,
} from "@/app/dashboard/pautas/actions";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

type Brand = { id: number; name: string };
type SortKey = keyof GuidelineMetric | "trend";
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

function formatMonthShort(ym: string) {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

function trendVariation(roas: number, prevRoas: number | null): number | null {
  if (prevRoas == null) return null;
  if (prevRoas === 0) return roas > 0 ? 100 : 0;
  return Math.round(((roas - prevRoas) / prevRoas) * 100);
}

function formatTrend(row: GuidelineMetric): { text: string; color: string } {
  const variation = trendVariation(row.roas, row.prev_roas);
  if (variation == null) return { text: "—", color: "text-muted-foreground" };

  const monthRef = formatMonthShort(row.prev_month!);
  if (variation > 0) return { text: `↑ ${variation}% vs ${monthRef}`, color: "text-green-500" };
  if (variation < 0) return { text: `↓ ${Math.abs(variation)}% vs ${monthRef}`, color: "text-red-500" };
  return { text: `→ 0% vs ${monthRef}`, color: "text-muted-foreground" };
}

export function PautasTable({
  brands,
  initialBrandId,
  initialData,
  initialMonths,
  initialProducts,
}: {
  brands: Brand[];
  initialBrandId: number | null;
  initialData: GuidelineMetric[];
  initialMonths: string[];
  initialProducts: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [metrics, setMetrics] = useState(initialData);
  const [availableMonths, setAvailableMonths] = useState(initialMonths);
  const [availableProducts, setAvailableProducts] = useState(initialProducts);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [sortKey, setSortKey] = useState<SortKey>("roas");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedGuidelines, setSelectedGuidelines] = useState<Set<number>>(new Set());

  const selectedBrandId = searchParams.get("brand")
    ? Number(searchParams.get("brand"))
    : initialBrandId;

  const lastFetchedBrandRef = useRef(initialBrandId);

  useEffect(() => {
    if (selectedBrandId === lastFetchedBrandRef.current) return;
    lastFetchedBrandRef.current = selectedBrandId;
    if (!selectedBrandId) return;
    setSelectedMonth("all");
    setSelectedProducts([]);
    setSelectedGuidelines(new Set());
    startTransition(async () => {
      try {
        const [data, months, products] = await Promise.all([
          getGuidelineMetrics(selectedBrandId),
          getAvailableMonths(selectedBrandId),
          getDistinctProducts(selectedBrandId),
        ]);
        setMetrics(data);
        setAvailableMonths(months);
        setAvailableProducts(products);
      } catch {
        toast.error("Erro ao carregar dados das Pautas");
        setMetrics([]);
        setAvailableMonths([]);
        setAvailableProducts([]);
      }
    });
  }, [selectedBrandId]);

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

  function refetch(brandId: number, month: string, products: string[]) {
    const monthArg = month === "all" ? undefined : month;
    const productArg = products.length === 0 ? undefined : products;
    startTransition(async () => {
      try {
        const data = await getGuidelineMetrics(brandId, monthArg, productArg);
        setMetrics(data);
      } catch {
        toast.error("Erro ao carregar dados das Pautas");
        setMetrics([]);
      }
    });
  }

  function handleBrandChange(value: string) {
    router.push(`/dashboard/pautas?brand=${value}`);
  }

  function handleMonthChange(value: string) {
    setSelectedMonth(value);
    setSelectedGuidelines(new Set());
    if (selectedBrandId) refetch(selectedBrandId, value, selectedProducts);
  }

  function handleProductsChange(values: string[]) {
    setSelectedProducts(values);
    setSelectedGuidelines(new Set());
    if (selectedBrandId) refetch(selectedBrandId, selectedMonth, values);
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

  const columns: { key: SortKey; label: string; align?: string; sortable?: boolean }[] = [
    { key: "guideline_number", label: "Pauta" },
    { key: "product_names", label: "Produto", sortable: false },
    { key: "spend", label: "Gasto", align: "text-right" },
    { key: "revenue", label: "Revenue", align: "text-right" },
    { key: "roas", label: "ROAS", align: "text-right" },
    { key: "ctr", label: "CTR", align: "text-right" },
    { key: "ad_count", label: "Anúncios", align: "text-center" },
    { key: "creator_count", label: "Creators", align: "text-center" },
    { key: "trend", label: "Tendência", align: "text-right" },
  ];

  function formatCell(row: GuidelineMetric, key: SortKey) {
    switch (key) {
      case "guideline_number":
        return `#${row.guideline_number}`;
      case "product_names":
        return row.product_names ?? "Não informado";
      case "spend":
        return formatCurrency(row.spend);
      case "revenue":
        return formatCurrency(row.revenue);
      case "roas":
        return formatRoas(row.roas);
      case "ctr":
        return formatCtr(row.ctr);
      case "ad_count":
        return String(row.ad_count);
      case "creator_count":
        return String(row.creator_count);
      case "trend":
        return null;
      default:
        return "";
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

        {availableProducts.length > 0 && (
          <>
            <label className="text-sm font-medium text-muted-foreground">
              Produto:
            </label>
            <ProductMultiSelect
              products={availableProducts}
              selected={selectedProducts}
              onSelectionChange={handleProductsChange}
            />
          </>
        )}

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
                        className="mr-2 pointer-events-none"
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
                    className={`${col.sortable === false ? "" : "cursor-pointer"} select-none whitespace-nowrap ${col.align ?? ""}`}
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
                        className={`whitespace-nowrap ${col.align ?? ""} ${col.key === "roas" ? roasColor(row.roas) : ""}`}
                      >
                        {col.key === "trend" ? (
                          <span className={formatTrend(row).color}>
                            {formatTrend(row).text}
                          </span>
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
