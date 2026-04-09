import { subMonths, format, startOfMonth } from "date-fns";
import { getBrands } from "@/lib/queries/brands";
import { getCreatorsByBrand } from "@/lib/queries/creators";
import { getMonthlySpendView, getGoalsForBrand } from "./actions";
import { MonthlyViewCharts } from "@/components/monthly-view-charts";

export default async function MonthlyViewPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const brands = await getBrands();
  const params = await searchParams;
  const selectedBrandId = params.brand
    ? Number(params.brand)
    : brands[0]?.id ?? null;

  const creators = selectedBrandId
    ? await getCreatorsByBrand(selectedBrandId)
    : [];

  const now = new Date();
  const defaultStart = format(startOfMonth(subMonths(now, 11)), "yyyy-MM-dd");
  const defaultEnd = format(now, "yyyy-MM-dd");

  const [initialData, initialGoals] = selectedBrandId
    ? await Promise.all([
        getMonthlySpendView({
          brandId: selectedBrandId,
          startDate: defaultStart,
          endDate: defaultEnd,
        }),
        getGoalsForBrand(
          selectedBrandId,
          format(startOfMonth(subMonths(new Date(), 11)), "yyyy-MM-01"),
          format(new Date(), "yyyy-MM-01"),
        ),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Visão Mensal</h1>
      <MonthlyViewCharts
        brands={brands}
        initialBrandId={selectedBrandId}
        initialCreators={creators}
        initialData={initialData}
        initialGoals={initialGoals}
      />
    </div>
  );
}
