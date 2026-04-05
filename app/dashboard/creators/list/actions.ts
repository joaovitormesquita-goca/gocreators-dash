"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createCreatorSchema,
  editCreatorSchema,
  type CreateCreatorInput,
  type EditCreatorInput,
} from "@/lib/schemas/creator";
import {
  bulkImportSchema,
  type BulkImportInput,
  type BulkImportResult,
} from "@/lib/schemas/csv-import";
import {
  bulkAssignGroupSchema,
  type BulkAssignGroupInput,
} from "@/lib/schemas/creator";

function splitHandles(raw: string): string[] {
  return raw.split(",").map((h) => h.trim()).filter(Boolean);
}

export type CreatorBrand = {
  id: number;
  assignmentId: number;
  name: string;
  handles: string[];
  start_date: string | null;
  group_id: number | null;
};

export type CreatorWithBrands = {
  id: number;
  full_name: string;
  email: string | null;
  brands: CreatorBrand[];
};

export async function getCreatorsWithBrands(): Promise<CreatorWithBrands[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("creators")
    .select(
      `
      id,
      full_name,
      email,
      creator_brands (
        id,
        brand_id,
        handles,
        start_date,
        group_id,
        brands ( id, name )
      )
    `,
    )
    .order("full_name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((creator) => ({
    id: creator.id,
    full_name: creator.full_name,
    email: creator.email,
    brands: (creator.creator_brands ?? []).map((cb: Record<string, unknown>) => {
      const brand = cb.brands as { id: number; name: string } | null;
      return {
        id: brand?.id ?? 0,
        assignmentId: cb.id as number,
        name: brand?.name ?? "",
        handles: (cb.handles as string[]) ?? [],
        start_date: cb.start_date as string | null,
        group_id: (cb.group_id as number | null) ?? null,
      };
    }),
  }));
}

export async function getBrandsForSelect() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}

type ActionResult =
  | { success: true; creatorId: number }
  | { success: false; error: string };

type UpdateResult =
  | { success: true }
  | { success: false; error: string };

export async function createCreatorWithBrands(
  input: CreateCreatorInput,
): Promise<ActionResult> {
  const parsed = createCreatorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { fullName, email, brandAssignments } = parsed.data;
  const supabase = await createClient();

  const { data: creator, error: creatorError } = await supabase
    .from("creators")
    .insert({
      full_name: fullName,
      email: email || null,
    })
    .select("id")
    .single();

  if (creatorError) {
    return { success: false, error: creatorError.message };
  }

  const creatorBrandsRows = brandAssignments.map((ba) => ({
    creator_id: creator.id,
    brand_id: Number(ba.brandId),
    handles: splitHandles(ba.handles),
    start_date: ba.startDate.toISOString().split("T")[0],
    group_id: ba.groupId ? Number(ba.groupId) : null,
  }));

  const { error: brandsError } = await supabase
    .from("creator_brands")
    .insert(creatorBrandsRows);

  if (brandsError) {
    return { success: false, error: brandsError.message };
  }

  revalidatePath("/dashboard/creators/list");
  return { success: true, creatorId: creator.id };
}

export async function updateCreator(
  input: EditCreatorInput,
): Promise<UpdateResult> {
  const parsed = editCreatorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { creatorId, fullName, email, brandAssignments } = parsed.data;
  const supabase = await createClient();

  // Update creator info
  const { error: creatorError } = await supabase
    .from("creators")
    .update({ full_name: fullName, email: email || null })
    .eq("id", creatorId);

  if (creatorError) {
    return { success: false, error: creatorError.message };
  }

  // Fetch current assignments to compute diff
  const { data: currentAssignments, error: fetchError } = await supabase
    .from("creator_brands")
    .select("id")
    .eq("creator_id", creatorId);

  if (fetchError) {
    return { success: false, error: fetchError.message };
  }

  const currentIds = new Set((currentAssignments ?? []).map((a) => a.id));
  const submittedIds = new Set(
    brandAssignments
      .filter((ba) => ba.assignmentId !== undefined)
      .map((ba) => ba.assignmentId!),
  );

  // Delete removed assignments
  const toDelete = [...currentIds].filter((id) => !submittedIds.has(id));
  if (toDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from("creator_brands")
      .delete()
      .in("id", toDelete);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }
  }

  // Update existing assignments
  for (const ba of brandAssignments.filter((ba) => ba.assignmentId !== undefined)) {
    const { error: updateError } = await supabase
      .from("creator_brands")
      .update({
        handles: splitHandles(ba.handles),
        start_date: ba.startDate.toISOString().split("T")[0],
        group_id: ba.groupId ? Number(ba.groupId) : null,
      })
      .eq("id", ba.assignmentId!);

    if (updateError) {
      return { success: false, error: updateError.message };
    }
  }

  // Insert new assignments
  const toInsert = brandAssignments
    .filter((ba) => ba.assignmentId === undefined)
    .map((ba) => ({
      creator_id: creatorId,
      brand_id: Number(ba.brandId),
      handles: ba.handles.split(",").map((h) => h.trim()).filter(Boolean),
      start_date: ba.startDate.toISOString().split("T")[0],
      group_id: ba.groupId ? Number(ba.groupId) : null,
    }));

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("creator_brands")
      .insert(toInsert);

    if (insertError) {
      return { success: false, error: insertError.message };
    }
  }

  revalidatePath("/dashboard/creators/list");
  return { success: true };
}

export async function bulkImportCreators(
  input: BulkImportInput,
): Promise<BulkImportResult> {
  const parsed = bulkImportSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { brandId, newCreators, existingCreatorLinks } = parsed.data;
  const supabase = await createClient();
  const errors: Array<{ name: string; error: string }> = [];
  let createdCount = 0;
  let linkedCount = 0;
  let handleAddedCount = 0;

  // 1. Batch insert new creators
  if (newCreators.length > 0) {
    const { data: insertedCreators, error: creatorsError } = await supabase
      .from("creators")
      .insert(
        newCreators.map((c) => ({
          full_name: c.fullName,
          email: c.email || null,
        })),
      )
      .select("id, full_name");

    if (creatorsError) {
      return { success: false, error: creatorsError.message };
    }

    // Create creator_brands for each new creator
    const brandRows = (insertedCreators ?? []).map((creator, i) => ({
      creator_id: creator.id,
      brand_id: brandId,
      handles: splitHandles(newCreators[i].handle),
      start_date: newCreators[i].startDate,
    }));

    const { error: brandsError } = await supabase
      .from("creator_brands")
      .insert(brandRows);

    if (brandsError) {
      return { success: false, error: brandsError.message };
    }

    createdCount = insertedCreators?.length ?? 0;
  }

  // 2. Link existing creators
  for (const link of existingCreatorLinks) {
    if (link.existingAssignmentId) {
      // Already linked to this brand — append handle
      const { data: current, error: fetchErr } = await supabase
        .from("creator_brands")
        .select("handles")
        .eq("id", link.existingAssignmentId)
        .single();

      if (fetchErr) {
        errors.push({ name: `Creator #${link.creatorId}`, error: fetchErr.message });
        continue;
      }

      const currentHandles = (current?.handles as string[]) ?? [];
      const newHandles = splitHandles(link.handle);
      const merged = [...new Set([...currentHandles, ...newHandles])];
      if (merged.length > currentHandles.length) {
        const { error: updateErr } = await supabase
          .from("creator_brands")
          .update({ handles: merged })
          .eq("id", link.existingAssignmentId);

        if (updateErr) {
          errors.push({ name: `Creator #${link.creatorId}`, error: updateErr.message });
          continue;
        }
        handleAddedCount++;
      }
    } else {
      // Not linked to this brand — create new creator_brands row
      const { error: insertErr } = await supabase
        .from("creator_brands")
        .insert({
          creator_id: link.creatorId,
          brand_id: brandId,
          handles: splitHandles(link.handle),
          start_date: link.startDate,
        });

      if (insertErr) {
        errors.push({ name: `Creator #${link.creatorId}`, error: insertErr.message });
        continue;
      }
      linkedCount++;
    }
  }

  revalidatePath("/dashboard/creators/list");
  return { success: true, createdCount, linkedCount, handleAddedCount, errors };
}

// --- Creator Group actions ---

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

export async function bulkUpdateCreatorBrandGroup(
  input: BulkAssignGroupInput,
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const parsed = bulkAssignGroupSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("creator_brands")
    .update({ group_id: parsed.data.groupId })
    .in("id", parsed.data.creatorBrandIds);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/creators/list");
  return { success: true, count: parsed.data.creatorBrandIds.length };
}
