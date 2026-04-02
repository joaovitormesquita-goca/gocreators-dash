"use server";

import { createClient } from "@/lib/supabase/server";

export type OverviewRow = {
  month: string;
  brand_id: number;
  brand_name: string;
  spend_total: number;
  spend_recentes: number;
  brand_total_spend: number;
};

export async function getOverviewData(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<OverviewRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_overview_data", {
    p_start_date: params?.startDate ?? null,
    p_end_date: params?.endDate ?? null,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}
