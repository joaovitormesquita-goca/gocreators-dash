import { getBrands, getCreatorMetrics } from "./actions";
import { CreatorsTable } from "@/components/creators-table";
import { SyncButton } from "@/components/sync-button";

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const brands = await getBrands();
  const params = await searchParams;
  const selectedBrandId = params.brand
    ? Number(params.brand)
    : brands[0]?.id ?? null;

  const metrics = selectedBrandId
    ? await getCreatorMetrics(selectedBrandId)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tabela Mensal</h1>
        <SyncButton />
      </div>
      <CreatorsTable
        brands={brands}
        initialBrandId={selectedBrandId}
        initialMetrics={metrics}
      />
    </div>
  );
}
