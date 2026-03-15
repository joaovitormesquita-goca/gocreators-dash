"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createCreatorSchema, type CreateCreatorInput } from "@/lib/schemas/creator";

export type CreatorBrand = {
  id: number;
  name: string;
  handles: string[];
  start_date: string | null;
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
        name: brand?.name ?? "",
        handles: (cb.handles as string[]) ?? [],
        start_date: cb.start_date as string | null,
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
    handles: ba.handles
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean),
    start_date: ba.startDate.toISOString().split("T")[0],
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
