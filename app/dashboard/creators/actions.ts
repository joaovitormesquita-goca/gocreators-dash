"use server";

import { createClient } from "@/lib/supabase/server";

export async function getBrands() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

export type CreatorMetric = {
  creator: string;
  month: string;
  spend_total: number;
  roas_total: number;
  ctr_total: number;
  spend_recentes: number;
  roas_recentes: number;
  ctr_recentes: number;
};

export async function syncAdMetrics() {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("sync-ad-metrics");

  if (error) {
    return { success: false as const, error: error.message };
  }

  return { success: true as const, results: data };
}

export async function getCreatorMetrics(
  brandId: number,
): Promise<CreatorMetric[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_creator_metrics", {
    p_brand_id: brandId,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}
