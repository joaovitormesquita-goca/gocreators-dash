import { getBrands, getBriefings } from "./actions";
import { BriefingManagementTable } from "@/components/briefing-management-table";
import type { BriefingFilters } from "@/lib/queries/briefings";

const ACTIVE_STATUSES = [
  "nao_alocada",
  "pendente",
  "em_andamento",
  "parcialmente_concluida",
];

export default async function BriefingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    brand?: string;
    status?: string;
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

  let statuses: string[] | undefined;
  if (!params.status || params.status === "ativos") {
    statuses = ACTIVE_STATUSES;
  } else if (params.status === "todos") {
    statuses = undefined;
  } else {
    statuses = [params.status];
  }

  const filters: BriefingFilters = {
    status: statuses,
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
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Pautas</h1>
      </div>
      <BriefingManagementTable
        brands={brands}
        selectedBrandId={selectedBrandId}
        briefings={briefings}
      />
    </div>
  );
}
