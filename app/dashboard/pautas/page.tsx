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

  let metrics: Awaited<ReturnType<typeof getGuidelineMetrics>> = [];
  let months: Awaited<ReturnType<typeof getAvailableMonths>> = [];

  if (selectedBrandId) {
    try {
      [metrics, months] = await Promise.all([
        getGuidelineMetrics(selectedBrandId),
        getAvailableMonths(selectedBrandId),
      ]);
    } catch {
      // RPC functions may not exist yet (e.g. local dev before migration)
    }
  }

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
