"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { getBrands as _getBrands } from "@/lib/queries/brands";
import {
  getBriefings as _getBriefings,
  getBriefingDetail as _getBriefingDetail,
  getAllocatableCreators as _getAllocatableCreators,
  type BriefingFilters,
} from "@/lib/queries/briefings";
import {
  assignCreatorsSchema,
  updateAssignmentStatusSchema,
  removeAssignmentSchema,
  type AssignCreatorsInput,
  type UpdateAssignmentStatusInput,
  type RemoveAssignmentInput,
} from "@/lib/schemas/briefing";

// ============ READS ============

export async function getBrands() {
  return _getBrands();
}

export async function getBriefings(
  brandId: number,
  filters: BriefingFilters = {},
) {
  return _getBriefings(brandId, filters);
}

export async function getBriefingDetail(briefingId: number) {
  return _getBriefingDetail(briefingId);
}

export async function getAllocatableCreators(brandId: number) {
  return _getAllocatableCreators(brandId);
}

// ============ MUTATIONS ============

export async function assignCreatorsToBriefing(
  input: AssignCreatorsInput,
): Promise<{ success: true; createdCount: number } | { success: false; error: string }> {
  const parsed = assignCreatorsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const nowIso = new Date().toISOString();
  const rows = parsed.data.creators.map((c) => ({
    briefing_id: parsed.data.briefingId,
    creator_id: c.creatorId,
    variante: c.variante ?? null,
    status: "pendente" as const,
    assigned_at: nowIso,
    assigned_by: user.id,
    updated_at: nowIso,
    updated_by: user.id,
  }));

  const { data, error } = await supabase
    .from("briefing_assignments")
    .upsert(rows, {
      onConflict: "briefing_id,creator_id",
      ignoreDuplicates: false,
    })
    .select("id");

  if (error) return { success: false, error: error.message };

  revalidateTag(CACHE_TAGS.BRIEFINGS);
  revalidatePath("/dashboard/briefings");
  return { success: true, createdCount: data?.length ?? 0 };
}

export async function updateAssignmentStatus(
  input: UpdateAssignmentStatusInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = updateAssignmentStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("briefing_assignments")
    .update({
      status: parsed.data.status,
      delivered_url:
        parsed.data.status === "concluido"
          ? parsed.data.deliveredUrl ?? null
          : null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("id", parsed.data.assignmentId);

  if (error) return { success: false, error: error.message };

  revalidateTag(CACHE_TAGS.BRIEFINGS);
  revalidatePath("/dashboard/briefings");
  return { success: true };
}

export async function removeAssignment(
  input: RemoveAssignmentInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = removeAssignmentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("briefing_assignments")
    .select("status")
    .eq("id", parsed.data.assignmentId)
    .maybeSingle();

  if (fetchError) return { success: false, error: fetchError.message };
  if (!existing) return { success: false, error: "Alocação não encontrada" };

  if (existing.status !== "pendente" && existing.status !== "cancelado") {
    return {
      success: false,
      error:
        "Para remover, primeiro mude o status para Cancelado (em andamento e concluídas preservam histórico)",
    };
  }

  const { error: deleteError } = await supabase
    .from("briefing_assignments")
    .delete()
    .eq("id", parsed.data.assignmentId);

  if (deleteError) return { success: false, error: deleteError.message };

  revalidateTag(CACHE_TAGS.BRIEFINGS);
  revalidatePath("/dashboard/briefings");
  return { success: true };
}
