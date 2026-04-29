"use server";

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getBrands as _getBrands } from "@/lib/queries/brands";
import { getDistinctProducts as _getDistinctProducts } from "@/lib/queries/products";

export async function getBrands() {
  return _getBrands();
}

export type GuidelineMetric = {
  guideline_number: number;
  spend: number;
  revenue: number;
  roas: number;
  ctr: number;
  creator_count: number;
  ad_count: number;
  prev_roas: number | null;
  prev_month: string | null;
  product_names: string | null;
};

const _getGuidelineMetricsCached = unstable_cache(
  async (
    brandId: number,
    month: string | null,
    productNames: string[] | null,
  ): Promise<GuidelineMetric[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_guideline_metrics", {
      p_brand_id: brandId,
      p_month: month,
      p_product_names: productNames,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["guideline-metrics"],
  { tags: [CACHE_TAGS.METRICS] },
);

export async function getGuidelineMetrics(
  brandId: number,
  month?: string,
  productNames?: string[],
): Promise<GuidelineMetric[]> {
  return _getGuidelineMetricsCached(
    brandId,
    month ?? null,
    productNames && productNames.length > 0 ? productNames : null,
  );
}

const _getAvailableMonthsCached = unstable_cache(
  async (brandId: number): Promise<string[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_guideline_available_months", {
      p_brand_id: brandId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: { month: string }) => row.month);
  },
  ["guideline-available-months"],
  { tags: [CACHE_TAGS.METRICS] },
);

export async function getAvailableMonths(brandId: number): Promise<string[]> {
  return _getAvailableMonthsCached(brandId);
}

export async function getDistinctProducts(brandId: number): Promise<string[]> {
  return _getDistinctProducts(brandId);
}
