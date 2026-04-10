import { BrandsTable } from "@/components/brands-table";
import { BrandGoalsSection } from "@/components/brand-goals-section";
import { CreateBrandDialog } from "@/components/create-brand-dialog";
import { getBrandsWithAdAccounts } from "./actions";

export default async function BrandsPage() {
  const brands = await getBrandsWithAdAccounts();

  return (
    <div className="space-y-10">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Marcas</h1>
          <CreateBrandDialog />
        </div>
        <BrandsTable brands={brands} />
      </div>

      <BrandGoalsSection
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
