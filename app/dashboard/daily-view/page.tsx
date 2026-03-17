import { subDays, format } from "date-fns";
import { getBrands } from "@/lib/queries/brands";
import { getCreatorsByBrand } from "@/lib/queries/creators";
import { getDailySpendView } from "./actions";
import { DailyViewCharts } from "@/components/daily-view-charts";

export default async function DailyViewPage({
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
  const defaultStart = format(subDays(now, 29), "yyyy-MM-dd");
  const defaultEnd = format(now, "yyyy-MM-dd");

  const initialData = selectedBrandId
    ? await getDailySpendView({
        brandId: selectedBrandId,
        startDate: defaultStart,
        endDate: defaultEnd,
      })
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Visão Diária</h1>
      <DailyViewCharts
        brands={brands}
        initialBrandId={selectedBrandId}
        initialCreators={creators}
        initialData={initialData}
      />
    </div>
  );
}
