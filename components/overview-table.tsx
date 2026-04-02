"use client";

import { useState, useTransition, useMemo } from "react";
import { subMonths, format, startOfMonth } from "date-fns";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getOverviewData, type OverviewRow } from "@/app/dashboard/overview/actions";

const BRAND_COLORS = [
  "#dc2626", // red
  "#2563eb", // blue
  "#16a34a", // green
  "#d97706", // amber
  "#9333ea", // purple
  "#0891b2", // cyan
  "#e11d48", // rose
  "#4f46e5", // indigo
];

const PERIOD_OPTIONS = [
  { label: "Últimos 6 meses", months: 5 },
  { label: "Últimos 12 meses", months: 11 },
  { label: "Últimos 18 meses", months: 17 },
  { label: "Últimos 24 meses", months: 23 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatMonthLabel(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00Z");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  const monthName = date.toLocaleDateString("pt-BR", {
    month: "long",
    timeZone: "UTC",
  });
  return { code: `${mm}/${yyyy}`, name: monthName.charAt(0).toUpperCase() + monthName.slice(1) };
}

type BrandInfo = { id: number; name: string; color: string };

export function OverviewTable({ initialData }: { initialData: OverviewRow[] }) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const [period, setPeriod] = useState("11");
  const [selectedBrandIds, setSelectedBrandIds] = useState<number[]>([]);
  const [brandPopoverOpen, setBrandPopoverOpen] = useState(false);

  const allBrands = useMemo<BrandInfo[]>(() => {
    const seen = new Map<number, string>();
    for (const row of data) {
      if (!seen.has(row.brand_id)) {
        seen.set(row.brand_id, row.brand_name);
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name], i) => ({
        id,
        name,
        color: BRAND_COLORS[i % BRAND_COLORS.length],
      }));
  }, [data]);

  const brands = useMemo(() => {
    if (selectedBrandIds.length === 0) return allBrands;
    return allBrands.filter((b) => selectedBrandIds.includes(b.id));
  }, [allBrands, selectedBrandIds]);

  const allBrandsSelected = selectedBrandIds.length === 0 || selectedBrandIds.length === allBrands.length;

  function toggleBrand(id: number) {
    setSelectedBrandIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleAllBrands() {
    setSelectedBrandIds(allBrandsSelected ? [] : allBrands.map((b) => b.id));
  }

  const brandLabel = allBrandsSelected
    ? "Todas as marcas"
    : selectedBrandIds.length === 1
      ? allBrands.find((b) => b.id === selectedBrandIds[0])?.name ?? "1 marca"
      : `${selectedBrandIds.length} marcas`;

  const months = useMemo(() => {
    const unique = Array.from(new Set(data.map((r) => r.month)));
    return unique.sort((a, b) => b.localeCompare(a));
  }, [data]);

  const lookup = useMemo(() => {
    const map = new Map<string, OverviewRow>();
    for (const row of data) {
      map.set(`${row.month}|${row.brand_id}`, row);
    }
    return map;
  }, [data]);

  function getRow(month: string, brandId: number): OverviewRow | undefined {
    return lookup.get(`${month}|${brandId}`);
  }

  function handlePeriodChange(value: string) {
    setPeriod(value);
    const monthsBack = Number(value);
    const now = new Date();
    const startDate = format(startOfMonth(subMonths(now, monthsBack)), "yyyy-MM-dd");
    const endDate = format(now, "yyyy-MM-dd");
    startTransition(async () => {
      const result = await getOverviewData({ startDate, endDate });
      setData(result);
    });
  }

  const metricGroups = [
    { label: "Investimento Play Vídeos Recentes Mês", key: "spend_recentes" as const },
    { label: "Share Creators Mês", key: "share_total" as const },
    { label: "Share Creators Vídeos Recentes Mês", key: "share_recentes" as const },
  ];

  function getCellValue(month: string, brandId: number, metric: string) {
    const row = getRow(month, brandId);
    if (!row) return metric === "spend_recentes" ? formatCurrency(0) : formatPercent(0);

    switch (metric) {
      case "spend_recentes":
        return formatCurrency(row.spend_recentes);
      case "share_total":
        return row.brand_total_spend > 0
          ? formatPercent((row.spend_total / row.brand_total_spend) * 100)
          : formatPercent(0);
      case "share_recentes":
        return row.brand_total_spend > 0
          ? formatPercent((row.spend_recentes / row.brand_total_spend) * 100)
          : formatPercent(0);
      default:
        return "—";
    }
  }

  const totalDataCols = brands.length * metricGroups.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-muted-foreground">Período:</label>
        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.months} value={opt.months.toString()}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="text-sm font-medium text-muted-foreground">Marcas:</label>
        <Popover open={brandPopoverOpen} onOpenChange={setBrandPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={brandPopoverOpen}
              className="w-[240px] justify-between"
            >
              <Building2 className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <span className="truncate">{brandLabel}</span>
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-0">
            <Command>
              <CommandInput placeholder="Buscar marca..." />
              <CommandList>
                <CommandEmpty>Nenhuma marca encontrada.</CommandEmpty>
                <CommandGroup>
                  <CommandItem onSelect={toggleAllBrands}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        allBrandsSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                    Selecionar todas
                  </CommandItem>
                  {allBrands.map((brand) => (
                    <CommandItem
                      key={brand.id}
                      value={brand.name}
                      onSelect={() => toggleBrand(brand.id)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedBrandIds.includes(brand.id)
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <span style={{ color: brand.color }} className="font-medium">
                        {brand.name}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {/* Row 1: metric group headers */}
            <TableRow>
              <TableHead
                colSpan={2}
                className="sticky left-0 z-20 bg-background text-center"
              />
              {metricGroups.map((group, gi) => (
                <TableHead
                  key={group.key}
                  colSpan={brands.length}
                  className={`text-center text-xs font-bold ${gi > 0 ? "border-l-2 border-border" : ""}`}
                >
                  {group.label}
                </TableHead>
              ))}
            </TableRow>
            {/* Row 2: brand sub-headers */}
            <TableRow>
              <TableHead className="sticky left-0 z-20 bg-background whitespace-nowrap w-[80px]">
                Data
              </TableHead>
              <TableHead className="sticky left-[80px] z-20 bg-background whitespace-nowrap">
                Mês
              </TableHead>
              {metricGroups.map((group, gi) =>
                brands.map((brand, bi) => (
                  <TableHead
                    key={`${group.key}-${brand.id}`}
                    className={`text-center text-xs whitespace-nowrap ${gi > 0 && bi === 0 ? "border-l-2 border-border" : ""}`}
                  >
                    <span
                      className="font-bold"
                      style={{ color: brand.color }}
                    >
                      {brand.name.toUpperCase()}
                    </span>
                  </TableHead>
                ))
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="sticky left-0 z-10 bg-background">
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell className="sticky left-[80px] z-10 bg-background">
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  {Array.from({ length: totalDataCols }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : months.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={2 + totalDataCols}
                  className="text-center text-muted-foreground py-8"
                >
                  Nenhum dado encontrado para o período selecionado.
                </TableCell>
              </TableRow>
            ) : (
              months.map((month) => {
                const { code, name } = formatMonthLabel(month);
                return (
                  <TableRow key={month}>
                    <TableCell className="sticky left-0 z-10 bg-background whitespace-nowrap font-medium text-sm">
                      {code}
                    </TableCell>
                    <TableCell className="sticky left-[80px] z-10 bg-background whitespace-nowrap text-sm">
                      {name}
                    </TableCell>
                    {metricGroups.map((group, gi) =>
                      brands.map((brand, bi) => (
                        <TableCell
                          key={`${group.key}-${brand.id}`}
                          className={`text-right text-sm whitespace-nowrap tabular-nums ${gi > 0 && bi === 0 ? "border-l-2 border-border" : ""}`}
                        >
                          {getCellValue(month, brand.id, group.key)}
                        </TableCell>
                      ))
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
