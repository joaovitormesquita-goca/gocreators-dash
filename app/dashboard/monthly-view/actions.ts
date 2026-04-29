"use server";

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { spendViewFiltersSchema } from "@/lib/schemas/spend-view";
import { getCreatorsByBrand as _getCreatorsByBrand } from "@/lib/queries/creators";
import { getDistinctProducts as _getDistinctProducts } from "@/lib/queries/products";

export async function getCreatorsByBrand(brandId: number) {
  return _getCreatorsByBrand(brandId);
}

export type GroupOption = {
  id: number;
  name: string;
};

const _getGroupsByBrandCached = unstable_cache(
  async (brandId: number): Promise<GroupOption[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_groups")
      .select("id, name")
      .eq("brand_id", brandId)
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["groups-by-brand-monthly"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getGroupsByBrand(brandId: number): Promise<GroupOption[]> {
  return _getGroupsByBrandCached(brandId);
}

const _getCreatorsByBrandAndGroupCached = unstable_cache(
  async (brandId: number, groupId: number | null): Promise<{ id: number; full_name: string }[]> => {
    const supabase = createStaticClient();
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
  },
  ["creators-by-brand-and-group-monthly"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getCreatorsByBrandAndGroup(
  brandId: number,
  groupId: number | null,
): Promise<{ id: number; full_name: string }[]> {
  return _getCreatorsByBrandAndGroupCached(brandId, groupId);
}

export type MonthlySpendRow = {
  month: string;
  spend_total: number;
  spend_recentes: number;
  brand_total_spend: number;
};

const _getMonthlySpendViewCached = unstable_cache(
  async (
    brandId: number,
    creatorIds: number[] | null,
    startDate: string,
    endDate: string,
    productNames: string[] | null,
  ): Promise<MonthlySpendRow[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_monthly_spend_view", {
      p_brand_id: brandId,
      p_creator_ids: creatorIds,
      p_start_date: startDate,
      p_end_date: endDate,
      p_product_names: productNames,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["monthly-spend-view"],
  { tags: [CACHE_TAGS.METRICS] },
);

export async function getMonthlySpendView(params: {
  brandId: number;
  creatorIds?: number[];
  startDate: string;
  endDate: string;
  productNames?: string[];
}): Promise<MonthlySpendRow[]> {
  const parsed = spendViewFiltersSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }
  return _getMonthlySpendViewCached(
    parsed.data.brandId,
    parsed.data.creatorIds && parsed.data.creatorIds.length > 0 ? parsed.data.creatorIds : null,
    parsed.data.startDate,
    parsed.data.endDate,
    parsed.data.productNames && parsed.data.productNames.length > 0 ? parsed.data.productNames : null,
  );
}

export async function getDistinctProducts(brandId: number): Promise<string[]> {
  return _getDistinctProducts(brandId);
}
