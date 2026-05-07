import { notFound } from "next/navigation";
import { getBrands, getBriefingById } from "../actions";
import { BriefingForm } from "@/components/briefing-form";

export default async function EditBriefingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum < 1) notFound();

  const [brands, briefing] = await Promise.all([
    getBrands(),
    getBriefingById(idNum),
  ]);

  if (!briefing) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">
        Editar pauta {briefing.briefing_number}
      </h1>
      <BriefingForm mode="edit" brands={brands} initial={briefing} />
    </div>
  );
}
