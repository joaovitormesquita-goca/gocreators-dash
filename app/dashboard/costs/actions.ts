"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getBrands as _getBrands } from "@/lib/queries/brands";
import {
  bulkCostImportWithMonthSchema,
  upsertCreatorCostSchema,
  type BulkCostImportWithMonthInput,
  type BulkCostImportResult,
  type UpsertCreatorCostInput,
  type UpsertCreatorCostResult,
} from "@/lib/schemas/creator-cost";

export async function getBrands() {
  return _getBrands();
}

export type CostMatrixRow = {
  creator_name: string;
  brand_name: string;
  creator_brand_id: number;
  month: string;
  cost: number | null;
};

export async function getCostMatrix(
  brandId: number,
  monthFrom?: string,
  monthTo?: string,
): Promise<CostMatrixRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_cost_matrix", {
    p_brand_id: brandId,
    p_month_from: monthFrom ?? null,
    p_month_to: monthTo ?? null,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type CreatorForBrand = {
  creatorBrandId: number;
  creatorName: string;
  brandName: string;
  startDate: string;
  endDate: string | null;
};

export async function getCreatorsForBrand(
  brandId: number,
): Promise<CreatorForBrand[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creator_brands")
    .select("id, start_date, end_date, creators(full_name), brands(name)")
    .eq("brand_id", brandId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((cb) => ({
    creatorBrandId: cb.id,
    creatorName:
      (cb.creators as unknown as { full_name: string })?.full_name ?? "",
    brandName: (cb.brands as unknown as { name: string })?.name ?? "",
    startDate: cb.start_date,
    endDate: cb.end_date,
  }));
}

export async function exportCostCsvFromMatrix(
  brandId: number,
  monthFrom?: string,
  monthTo?: string,
  creatorBrandIds?: number[],
): Promise<{ success: true; csv: string } | { success: false; error: string }> {
  const matrix = await getCostMatrix(brandId, monthFrom, monthTo);

  const filtered = creatorBrandIds?.length
    ? matrix.filter((r) => creatorBrandIds.includes(r.creator_brand_id))
    : matrix;

  if (filtered.length === 0) {
    return { success: false, error: "Nenhum dado encontrado para os filtros selecionados" };
  }

  const rows = filtered.map((r) => {
    const monthFormatted = r.month.substring(0, 7);
    return `"${r.creator_name}","${monthFormatted}","${r.brand_name}","${r.cost ?? ""}"`;
  });

  const csv = ["creator_name,month,brand_name,cost", ...rows].join("\n");
  return { success: true, csv };
}

export async function importCreatorCostsWithMonth(
  input: BulkCostImportWithMonthInput,
): Promise<BulkCostImportResult> {
  const parsed = bulkCostImportWithMonthSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { costs } = parsed.data;
  const supabase = await createClient();

  const rows = costs.map((c) => ({
    creator_brand_id: c.creatorBrandId,
    month: c.month,
    cost: c.cost,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("creator_costs").upsert(rows, {
    onConflict: "creator_brand_id,month",
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/costs");
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

  revalidatePath("/dashboard/costs");
  revalidatePath("/dashboard/creators");
  return { success: true };
}
