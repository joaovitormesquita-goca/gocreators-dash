"use server";

import { createClient } from "@/lib/supabase/server";
import { spendViewFiltersSchema } from "@/lib/schemas/spend-view";
import { getCreatorsByBrand as _getCreatorsByBrand } from "@/lib/queries/creators";

export async function getCreatorsByBrand(brandId: number) {
  return _getCreatorsByBrand(brandId);
}

export type DailySpendRow = {
  day: string;
  spend_total: number;
  spend_recentes: number;
  brand_total_spend: number;
};

export async function getDailySpendView(params: {
  brandId: number;
  creatorIds?: number[];
  startDate: string;
  endDate: string;
}): Promise<DailySpendRow[]> {
  const parsed = spendViewFiltersSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_spend_view", {
    p_brand_id: parsed.data.brandId,
    p_creator_ids: parsed.data.creatorIds ?? null,
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}
