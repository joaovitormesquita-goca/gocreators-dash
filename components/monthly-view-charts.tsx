"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, subMonths, startOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreatorMultiSelect,
  type CreatorOption,
} from "@/components/creator-multi-select";
import {
  DatePeriodSelector,
  type DatePreset,
} from "@/components/date-period-selector";
import {
  CombinedSpendShareChart,
  type CombinedSpendShareDataPoint,
} from "@/components/combined-spend-share-chart";
import { getMonthlySpendView, getCreatorsByBrand, type MonthlySpendRow } from "@/app/dashboard/monthly-view/actions";

type Brand = { id: number; name: string };

const monthlyPresets: DatePreset[] = [
  {
    label: "Últimos 3 meses",
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 2)),
      to: new Date(),
    }),
  },
  {
    label: "Últimos 6 meses",
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 5)),
      to: new Date(),
    }),
  },
  {
    label: "Últimos 12 meses",
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 11)),
      to: new Date(),
    }),
  },
  {
    label: "Este ano",
    getRange: () => ({
      from: startOfYear(new Date()),
      to: new Date(),
    }),
  },
];

function toCombinedChartData(
  rows: MonthlySpendRow[],
): CombinedSpendShareDataPoint[] {
  return rows.map((row) => {
    const spendTotal = Number(row.spend_total) || 0;
    const spendRecentes = Number(row.spend_recentes) || 0;
    const brandTotal = Number(row.brand_total_spend) || 0;
    const date = new Date(row.month + "T00:00:00");
    return {
      label: format(date, "MMM/yy", { locale: ptBR }),
      spendTotal,
      spendRecentes,
      sharePercentTotal:
        brandTotal > 0 ? Math.round((spendTotal / brandTotal) * 1000) / 10 : 0,
      sharePercentRecentes:
        brandTotal > 0
          ? Math.round((spendRecentes / brandTotal) * 1000) / 10
          : 0,
    };
  });
}

export function MonthlyViewCharts({
  brands,
  initialBrandId,
  initialCreators,
  initialData,
}: {
  brands: Brand[];
  initialBrandId: number | null;
  initialCreators: CreatorOption[];
  initialData: MonthlySpendRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedBrandId, setSelectedBrandId] = useState(initialBrandId);
  const [creators, setCreators] = useState<CreatorOption[]>(initialCreators);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<number[]>(
    initialCreators.map((c) => c.id),
  );
  const [dateRange, setDateRange] = useState(() => {
    const defaultPreset = monthlyPresets[2]; // Últimos 12 meses
    return defaultPreset.getRange();
  });
  const [data, setData] = useState<MonthlySpendRow[]>(initialData);

  const fetchData = useCallback(
    (brandId: number, creatorIds: number[], range: { from: Date; to: Date }) => {
      startTransition(async () => {
        const allSelected = creatorIds.length === 0;
        const rows = await getMonthlySpendView({
          brandId,
          creatorIds: allSelected ? undefined : creatorIds,
          startDate: format(range.from, "yyyy-MM-dd"),
          endDate: format(range.to, "yyyy-MM-dd"),
        });
        setData(rows);
      });
    },
    [],
  );

  function handleBrandChange(value: string) {
    const brandId = Number(value);
    setSelectedBrandId(brandId);
    router.push(`/dashboard/monthly-view?brand=${brandId}`);
    startTransition(async () => {
      const newCreators = await getCreatorsByBrand(brandId);
      setCreators(newCreators);
      const allIds = newCreators.map((c) => c.id);
      setSelectedCreatorIds(allIds);
      const rows = await getMonthlySpendView({
        brandId,
        startDate: format(dateRange.from, "yyyy-MM-dd"),
        endDate: format(dateRange.to, "yyyy-MM-dd"),
      });
      setData(rows);
    });
  }

  function handleCreatorChange(ids: number[]) {
    setSelectedCreatorIds(ids);
    if (selectedBrandId) {
      fetchData(selectedBrandId, ids, dateRange);
    }
  }

  function handleDateChange(range: { from: Date; to: Date }) {
    setDateRange(range);
    if (selectedBrandId) {
      fetchData(selectedBrandId, selectedCreatorIds, range);
    }
  }

  const combinedChartData = toCombinedChartData(data);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Select
          value={selectedBrandId?.toString()}
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

        <CreatorMultiSelect
          creators={creators}
          selected={selectedCreatorIds}
          onSelectionChange={handleCreatorChange}
          disabled={isPending}
        />
      </div>

      <DatePeriodSelector
        presets={monthlyPresets}
        value={dateRange}
        onChange={handleDateChange}
        disabled={isPending}
      />

      {isPending ? (
        <Skeleton className="h-[420px] w-full" />
      ) : (
        <CombinedSpendShareChart
          data={combinedChartData}
          title="Gasto em creators: total vs. recentes"
        />
      )}
    </div>
  );
}
