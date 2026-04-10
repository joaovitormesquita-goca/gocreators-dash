import { getBrands, getGuidelineMetrics, getAvailableMonths } from "./actions";
import { PautasTable } from "@/components/pautas-table";

export default async function PautasPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const brands = await getBrands();
  const params = await searchParams;
  const selectedBrandId = params.brand
    ? Number(params.brand)
    : brands[0]?.id ?? null;

  const [metrics, months] = selectedBrandId
    ? await Promise.all([
        getGuidelineMetrics(selectedBrandId),
        getAvailableMonths(selectedBrandId),
      ])
    : [[], []];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Pautas</h1>
      </div>
      <PautasTable
        brands={brands}
        initialBrandId={selectedBrandId}
        initialData={metrics}
        initialMonths={months}
      />
    </div>
  );
}
