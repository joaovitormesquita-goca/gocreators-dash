import { getBrands, suggestNextBriefingNumber } from "../actions";
import { BriefingForm } from "@/components/briefing-form";

export default async function NewBriefingPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const params = await searchParams;
  const brands = await getBrands();
  const initialBrandId = params.brand
    ? Number(params.brand)
    : brands[0]?.id ?? 0;

  const initialNumber = initialBrandId
    ? await suggestNextBriefingNumber(initialBrandId)
    : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Nova pauta</h1>
      <BriefingForm
        mode="create"
        brands={brands}
        initialBrandId={initialBrandId}
        initialNumber={initialNumber}
      />
    </div>
  );
}
