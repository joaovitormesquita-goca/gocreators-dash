import { getBrands, getCostMatrix } from "./actions";
import { CostsTable } from "@/components/costs-table";

export default async function CostsPage() {
  const brands = await getBrands();
  const initialBrandId = brands[0]?.id ?? null;
  const initialMatrix = initialBrandId ? await getCostMatrix(initialBrandId) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Central de Custos</h1>
      <CostsTable
        brands={brands}
        initialBrandId={initialBrandId}
        initialMatrix={initialMatrix}
      />
    </div>
  );
}
