"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBrands as _getBrands } from "@/lib/queries/brands";

export async function getBrands() {
  return _getBrands();
}

export type CreatorMetric = {
  creator: string;
  month: string;
  group_id: number | null;
  spend_total: number;
  roas_total: number;
  ctr_total: number;
  spend_recentes: number;
  roas_recentes: number;
  ctr_recentes: number;
};

export type GroupOption = {
  id: number;
  name: string;
};

export async function getGroupsByBrand(
  brandId: number,
): Promise<GroupOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creator_groups")
    .select("id, name")
    .eq("brand_id", brandId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function syncAdMetrics() {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("sync-ad-metrics", {
    body: { trigger: "manual" },
  });

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidatePath("/dashboard/sync");
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
