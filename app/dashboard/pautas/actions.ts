"use server";

import { createClient } from "@/lib/supabase/server";
import { getBrands as _getBrands } from "@/lib/queries/brands";

export async function getBrands() {
  return _getBrands();
}

export type GuidelineMetric = {
  guideline_number: number;
  spend: number;
  roas: number;
  ctr: number;
  creator_count: number;
};

export async function getGuidelineMetrics(
  brandId: number,
  month?: string,
): Promise<GuidelineMetric[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_guideline_metrics", {
    p_brand_id: brandId,
    p_month: month ?? null,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAvailableMonths(brandId: number): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_guideline_available_months", {
    p_brand_id: brandId,
  });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { month: string }) => row.month);
}
