import { getBrands, getBriefings } from "./actions";
import { BriefingsGrid } from "@/components/briefings-grid";
import type { BriefingFilters } from "@/lib/queries/briefings";

export default async function BriefingsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    brand?: string;
    mes?: string;
    ano?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const brands = await getBrands();
  const selectedBrandId = params.brand
    ? Number(params.brand)
    : brands[0]?.id ?? null;

  const filters: BriefingFilters = {
    mes: params.mes ? Number(params.mes) : null,
    ano: params.ano ? Number(params.ano) : null,
    q: params.q ?? null,
  };

  const briefings = selectedBrandId
    ? await getBriefings(selectedBrandId, filters).catch((err) => {
        console.error("Failed to load briefings:", err);
        return [];
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Briefings</h1>
      </div>
      <BriefingsGrid
        brands={brands}
        selectedBrandId={selectedBrandId}
        briefings={briefings}
      />
    </div>
  );
}
