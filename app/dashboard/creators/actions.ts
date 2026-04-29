"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getBrands as _getBrands } from "@/lib/queries/brands";
import {
  bulkCostImportSchema,
  upsertCreatorCostSchema,
  type BulkCostImportInput,
  type BulkCostImportResult,
  type UpsertCreatorCostInput,
  type UpsertCreatorCostResult,
} from "@/lib/schemas/creator-cost";

export async function getBrands() {
  return _getBrands();
}

export type CreatorViewMode = "creator" | "product" | "granular";

export type CreatorMetric = {
  creator: string | null;
  creator_brand_id: number | null;
  product_name: string | null;
  month: string;
  group_id: number | null;
  spend_total: number;
  roas_total: number;
  ctr_total: number;
  spend_recentes: number;
  roas_recentes: number;
  ctr_recentes: number;
  cost: number | null;
  yearly_spend: number | null;
};

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
  ["groups-by-brand"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getGroupsByBrand(brandId: number): Promise<GroupOption[]> {
  return _getGroupsByBrandCached(brandId);
}

const _getCreatorBrandsForBrandCached = unstable_cache(
  async (brandId: number): Promise<{ creatorBrandId: number; creatorName: string; brandName: string }[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_brands")
      .select("id, creators(full_name), brands(name)")
      .eq("brand_id", brandId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((cb) => ({
      creatorBrandId: cb.id,
      creatorName:
        (cb.creators as unknown as { full_name: string })?.full_name ?? "",
      brandName: (cb.brands as unknown as { name: string })?.name ?? "",
    }));
  },
  ["creator-brands-for-brand"],
  { tags: [CACHE_TAGS.BRANDS] },
);

export async function getCreatorBrandsForBrand(
  brandId: number,
): Promise<{ creatorBrandId: number; creatorName: string; brandName: string }[]> {
  return _getCreatorBrandsForBrandCached(brandId);
}

const _getCreatorMetricsCached = unstable_cache(
  async (brandId: number, viewMode: CreatorViewMode): Promise<CreatorMetric[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_creator_metrics", {
      p_brand_id: brandId,
      p_view_mode: viewMode,
    });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["creator-metrics"],
  { tags: [CACHE_TAGS.METRICS, CACHE_TAGS.COSTS] },
);

export async function getCreatorMetrics(
  brandId: number,
  viewMode: CreatorViewMode = "creator",
): Promise<CreatorMetric[]> {
  return _getCreatorMetricsCached(brandId, viewMode);
}

export async function syncAdMetrics() {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("sync-ad-metrics", {
    body: { trigger: "manual" },
  });

  if (error) {
    return { success: false as const, error: error.message };
  }

  revalidateTag(CACHE_TAGS.METRICS);
  revalidateTag(CACHE_TAGS.SYNC_LOGS);
  revalidateTag(CACHE_TAGS.PRODUCTS);
  revalidatePath("/dashboard/sync");
  revalidatePath("/dashboard/creators");
  return { success: true as const, results: data };
}

export async function exportCostCsvBase(
  brandId: number,
  month: string,
): Promise<{ success: true; csv: string } | { success: false; error: string }> {
  const supabase = await createClient();

  const { data: brandData } = await supabase
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .single();

  if (!brandData) return { success: false, error: "Brand não encontrada" };

  const { data: creators, error } = await supabase
    .from("creator_brands")
    .select("id, creators(full_name)")
    .eq("brand_id", brandId);

  if (error) return { success: false, error: error.message };
  if (!creators || creators.length === 0) {
    return { success: false, error: "Nenhum creator vinculado a esta brand" };
  }

  const creatorBrandIds = creators.map((cb) => cb.id);
  const { data: existingCosts } = await supabase
    .from("creator_costs")
    .select("creator_brand_id, cost")
    .eq("month", month)
    .in("creator_brand_id", creatorBrandIds);

  const costMap = new Map(
    (existingCosts ?? []).map((c) => [c.creator_brand_id, c.cost]),
  );

  const rows = creators.map((cb) => {
    const creatorName =
      (cb.creators as unknown as { full_name: string })?.full_name ?? "";
    const existing = costMap.get(cb.id);
    return `"${creatorName}","${brandData.name}","${existing ?? ""}"`;
  });

  const csv = ["creator_name,brand_name,cost", ...rows].join("\n");
  return { success: true, csv };
}

export async function importCreatorCosts(
  input: BulkCostImportInput,
): Promise<BulkCostImportResult> {
  const parsed = bulkCostImportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { month, costs } = parsed.data;
  const supabase = await createClient();

  const rows = costs.map((c) => ({
    creator_brand_id: c.creatorBrandId,
    month,
    cost: c.cost,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("creator_costs").upsert(rows, {
    onConflict: "creator_brand_id,month",
  });

  if (error) return { success: false, error: error.message };

  revalidateTag(CACHE_TAGS.COSTS);
  revalidateTag(CACHE_TAGS.METRICS);
  revalidatePath("/dashboard/creators");
  return { success: true, importedCount: rows.length };
}

export async function upsertCreatorCost(
  input: UpsertCreatorCostInput,
): Promise<UpsertCreatorCostResult> {
  const parsed = upsertCreatorCostSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { creatorBrandId, month, cost } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("creator_costs").upsert(
    {
      creator_brand_id: creatorBrandId,
      month,
      cost,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "creator_brand_id,month" },
  );

  if (error) return { success: false, error: error.message };

  revalidateTag(CACHE_TAGS.COSTS);
  revalidateTag(CACHE_TAGS.METRICS);
  revalidatePath("/dashboard/creators");
  return { success: true };
}
