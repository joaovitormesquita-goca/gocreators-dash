"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getBrands as _getBrands } from "@/lib/queries/brands";
import {
  getBriefings as _getBriefings,
  type BriefingFilters,
} from "@/lib/queries/briefings";
import {
  briefingFormSchema,
  updateBriefingSchema,
  deleteBriefingSchema,
  type BriefingFormInput,
  type UpdateBriefingInput,
  type DeleteBriefingInput,
  type Briefing,
} from "@/lib/schemas/briefing";

// ============ READS ============

export async function getBrands() {
  return _getBrands();
}

export async function getBriefings(brandId: number, filters: BriefingFilters = {}) {
  return _getBriefings(brandId, filters);
}

export async function getBriefingById(id: number): Promise<Briefing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Briefing | null;
}

export async function suggestNextBriefingNumber(brandId: number): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("briefings")
    .select("briefing_number")
    .eq("brand_id", brandId)
    .order("briefing_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.briefing_number ?? 0) + 1;
}

// ============ MUTATIONS ============

function invalidateCaches() {
  revalidateTag(CACHE_TAGS.BRIEFINGS);
  revalidatePath("/dashboard/briefings");
  revalidatePath("/dashboard/alocacao");
}

export async function createBriefing(
  input: BriefingFormInput,
): Promise<{ success: true; id: number } | { success: false; error: string }> {
  const parsed = briefingFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("briefings")
    .insert({
      ...parsed.data,
      source: "native" as const,
      source_doc_id: null,
      updated_at: nowIso,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: `Já existe uma pauta ${parsed.data.briefing_number} nessa marca`,
      };
    }
    return { success: false, error: error.message };
  }

  invalidateCaches();
  return { success: true, id: data.id };
}

export async function updateBriefing(
  input: UpdateBriefingInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = updateBriefingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { id, ...rest } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("briefings")
    .update({
      ...rest,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        error: `Já existe uma pauta ${parsed.data.briefing_number} nessa marca`,
      };
    }
    return { success: false, error: error.message };
  }

  invalidateCaches();
  return { success: true };
}

export async function deleteBriefing(
  input: DeleteBriefingInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = deleteBriefingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("briefings")
    .delete()
    .eq("id", parsed.data.id);

  if (error) return { success: false, error: error.message };

  invalidateCaches();
  return { success: true };
}
