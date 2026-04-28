"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
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
  SpendShareChart,
  type SpendShareDataPoint,
} from "@/components/spend-share-chart";
import { toast } from "sonner";
import { getMonthlySpendView, getCreatorsByBrand, getGroupsByBrand, getCreatorsByBrandAndGroup, getDistinctProducts, type MonthlySpendRow, type GroupOption } from "@/app/dashboard/monthly-view/actions";
import { getGoalsForBrand, type BrandGoalRow } from "@/app/dashboard/brands/actions";

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

function toChartData(
  rows: MonthlySpendRow[],
  spendKey: "spend_total" | "spend_recentes",
  goals: BrandGoalRow[],
  metric: "share_total" | "share_recent",
): SpendShareDataPoint[] {
  return rows.map((row) => {
    const spend = Number(row[spendKey]) || 0;
    const brandTotal = Number(row.brand_total_spend) || 0;
    const sharePercent = brandTotal > 0 ? (spend / brandTotal) * 100 : 0;
    const date = new Date(row.month + "T00:00:00");
    const matchingGoal = goals.find(
      (g) => g.metric === metric && g.month === row.month,
    );
    return {
      label: format(date, "MMM/yy", { locale: ptBR }),
      spend,
      sharePercent: Math.round(sharePercent * 10) / 10,
      goal: matchingGoal ? Number(matchingGoal.value) : undefined,
    };
  });
}

export function MonthlyViewCharts({
  brands,
  initialBrandId,
  initialCreators,
  initialData,
  initialGoals = [],
}: {
  brands: Brand[];
  initialBrandId: number | null;
  initialCreators: CreatorOption[];
  initialData: MonthlySpendRow[];
  initialGoals?: BrandGoalRow[];
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
  const [goals, setGoals] = useState<BrandGoalRow[]>(initialGoals);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [products, setProducts] = useState<string[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("all");

  useEffect(() => {
    if (selectedBrandId) {
      Promise.all([
        getGroupsByBrand(selectedBrandId),
        getDistinctProducts(selectedBrandId),
      ])
        .then(([grps, prods]) => {
          setGroups(grps);
          setProducts(prods);
        })
        .catch(() => toast.error("Erro ao carregar filtros"));
    } else {
      setGroups([]);
      setProducts([]);
    }
  }, [selectedBrandId]);

  const fetchData = useCallback(
    (brandId: number, creatorIds: number[], range: { from: Date; to: Date }, product: string) => {
      startTransition(async () => {
        const allSelected = creatorIds.length === 0;
        const productNames = product === "all" ? undefined : [product];
        const [rows, brandGoals] = await Promise.all([
          getMonthlySpendView({
            brandId,
            creatorIds: allSelected ? undefined : creatorIds,
            startDate: format(range.from, "yyyy-MM-dd"),
            endDate: format(range.to, "yyyy-MM-dd"),
            productNames,
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

  function handleBrandChange(value: string) {
    const brandId = Number(value);
    setSelectedBrandId(brandId);
    setSelectedGroupId("all");
    setSelectedProduct("all");
    router.push(`/dashboard/monthly-view?brand=${brandId}`);
    startTransition(async () => {
      const [newCreators, newProducts] = await Promise.all([
        getCreatorsByBrand(brandId),
        getDistinctProducts(brandId),
      ]);
      setCreators(newCreators);
      setProducts(newProducts);
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
      const productNames = selectedProduct === "all" ? undefined : [selectedProduct];
      const [rows, brandGoals] = await Promise.all([
        getMonthlySpendView({
          brandId: selectedBrandId,
          creatorIds: allIds.length > 0 ? allIds : undefined,
          startDate: format(dateRange.from, "yyyy-MM-dd"),
          endDate: format(dateRange.to, "yyyy-MM-dd"),
          productNames,
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

  function handleProductChange(value: string) {
    setSelectedProduct(value);
    if (selectedBrandId) {
      fetchData(selectedBrandId, selectedCreatorIds, dateRange, value);
    }
  }

  function handleCreatorChange(ids: number[]) {
    setSelectedCreatorIds(ids);
    if (selectedBrandId) {
      fetchData(selectedBrandId, ids, dateRange, selectedProduct);
    }
  }

  function handleDateChange(range: { from: Date; to: Date }) {
    setDateRange(range);
    if (selectedBrandId) {
      fetchData(selectedBrandId, selectedCreatorIds, range, selectedProduct);
    }
  }

  const totalChartData = toChartData(data, "spend_total", goals, "share_total");
  const recentesChartData = toChartData(data, "spend_recentes", goals, "share_recent");

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

        {groups.length > 0 && (
          <Select
            value={selectedGroupId}
            onValueChange={handleGroupChange}
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
        )}

        <CreatorMultiSelect
          creators={creators}
          selected={selectedCreatorIds}
          onSelectionChange={handleCreatorChange}
          disabled={isPending}
        />

        {products.length > 0 && (
          <Select value={selectedProduct} onValueChange={handleProductChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todos os produtos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <DatePeriodSelector
        presets={monthlyPresets}
        value={dateRange}
        onChange={handleDateChange}
        disabled={isPending}
      />

      {isPending ? (
        <div className="space-y-6">
          <Skeleton className="h-[340px] w-full" />
          <Skeleton className="h-[340px] w-full" />
        </div>
      ) : (
        <div className="space-y-8">
          <SpendShareChart
            data={totalChartData}
            title="Gasto total em creators"
          />
          <SpendShareChart
            data={recentesChartData}
            title="Gasto em conteúdo recente de creators"
          />
        </div>
      )}
    </div>
  );
}
