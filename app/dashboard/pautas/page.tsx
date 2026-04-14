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
      // TODO: remove mock data before merging — RPC functions not deployed yet
      metrics = [
        { guideline_number: 1311, spend: 4230.5, revenue: 14468.31, roas: 3.42, ctr: 2.18, creator_count: 5, ad_count: 12, prev_roas: 2.85, prev_month: "2026-02" },
        { guideline_number: 1298, spend: 8120.0, revenue: 23304.4, roas: 2.87, ctr: 1.94, creator_count: 8, ad_count: 21, prev_roas: 3.1, prev_month: "2026-02" },
        { guideline_number: 1305, spend: 2650.8, revenue: 4029.22, roas: 1.52, ctr: 1.65, creator_count: 3, ad_count: 6, prev_roas: 1.2, prev_month: "2026-02" },
        { guideline_number: 1320, spend: 5410.3, revenue: 11632.15, roas: 2.15, ctr: 2.05, creator_count: 6, ad_count: 15, prev_roas: 2.15, prev_month: "2026-02" },
        { guideline_number: 1290, spend: 6980.2, revenue: 5933.17, roas: 0.85, ctr: 0.92, creator_count: 4, ad_count: 9, prev_roas: 1.4, prev_month: "2026-01" },
        { guideline_number: 1275, spend: 1440.3, revenue: 907.39, roas: 0.63, ctr: 0.78, creator_count: 2, ad_count: 3, prev_roas: 0.9, prev_month: "2026-01" },
        { guideline_number: 1330, spend: 3200.0, revenue: 13120.0, roas: 4.1, ctr: 3.12, creator_count: 7, ad_count: 18, prev_roas: null, prev_month: null },
        { guideline_number: 1315, spend: 950.6, revenue: 950.6, roas: 1.0, ctr: 1.2, creator_count: 1, ad_count: 2, prev_roas: 0, prev_month: "2026-02" },
      ];
      months = ["2026-03", "2026-02", "2026-01"];
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
