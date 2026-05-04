"use server";

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type OverviewRow = {
  month: string;
  brand_id: number;
  brand_name: string;
  spend_total: number;
  spend_recentes: number;
  brand_total_spend: number;
};

const _getOverviewDataCached = unstable_cache(
  async (startDate: string | null, endDate: string | null): Promise<OverviewRow[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_overview_data", {
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["overview-data"],
  { tags: [CACHE_TAGS.METRICS, CACHE_TAGS.BRANDS] },
);

export async function getOverviewData(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<OverviewRow[]> {
  return _getOverviewDataCached(params?.startDate ?? null, params?.endDate ?? null);
}
