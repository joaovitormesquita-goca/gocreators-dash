"use server";

import { createClient } from "@/lib/supabase/server";
import { spendViewFiltersSchema } from "@/lib/schemas/spend-view";
import { getCreatorsByBrand as _getCreatorsByBrand } from "@/lib/queries/creators";

export async function getCreatorsByBrand(brandId: number) {
  return _getCreatorsByBrand(brandId);
}

export type GroupOption = {
  id: number;
  name: string;
};

export async function getGroupsByBrand(brandId: number): Promise<GroupOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_groups")
    .select("id, name")
    .eq("brand_id", brandId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCreatorsByBrandAndGroup(
  brandId: number,
  groupId: number | null,
): Promise<{ id: number; full_name: string }[]> {
  const supabase = await createClient();

  let query = supabase
    .from("creator_brands")
    .select("creators(id, full_name)")
    .eq("brand_id", brandId);

  if (groupId === 0) {
    query = query.is("group_id", null);
  } else if (groupId !== null) {
    query = query.eq("group_id", groupId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const creatorsMap = new Map<number, string>();
  for (const row of data ?? []) {
    const creator = row.creators as unknown as { id: number; full_name: string };
    if (creator && !creatorsMap.has(creator.id)) {
      creatorsMap.set(creator.id, creator.full_name);
    }
  }

  return Array.from(creatorsMap.entries()).map(([id, full_name]) => ({
    id,
    full_name,
  }));
}

export type MonthlySpendRow = {
  month: string;
  spend_total: number;
  spend_recentes: number;
  brand_total_spend: number;
};

export async function getMonthlySpendView(params: {
  brandId: number;
  creatorIds?: number[];
  startDate: string;
  endDate: string;
}): Promise<MonthlySpendRow[]> {
  const parsed = spendViewFiltersSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_monthly_spend_view", {
    p_brand_id: parsed.data.brandId,
    p_creator_ids: parsed.data.creatorIds ?? null,
    p_start_date: parsed.data.startDate,
    p_end_date: parsed.data.endDate,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type BrandGoalRow = {
  metric: "share_total" | "share_recent";
  month: string;
  value: number;
};

export async function getGoalsForBrand(
  brandId: number,
  startDate: string,
  endDate: string,
): Promise<BrandGoalRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brand_goals")
    .select("metric, month, value")
    .eq("brand_id", brandId)
    .gte("month", startDate)
    .lte("month", endDate);

  if (error) throw new Error(error.message);
  return (data ?? []) as BrandGoalRow[];
}
