import { subMonths, format, startOfMonth } from "date-fns";
import { getOverviewData } from "./actions";
import { OverviewTable } from "@/components/overview-table";

export default async function OverviewPage() {
  const now = new Date();
  const defaultStart = format(startOfMonth(subMonths(now, 11)), "yyyy-MM-dd");
  const defaultEnd = format(now, "yyyy-MM-dd");

  const data = await getOverviewData({
    startDate: defaultStart,
    endDate: defaultEnd,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
      <OverviewTable initialData={data} />
    </div>
  );
}
