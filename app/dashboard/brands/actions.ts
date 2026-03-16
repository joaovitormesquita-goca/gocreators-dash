"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createBrandSchema,
  editBrandSchema,
  createAdAccountSchema,
  editAdAccountSchema,
  type CreateBrandInput,
  type EditBrandInput,
  type CreateAdAccountInput,
  type EditAdAccountInput,
} from "@/lib/schemas/brand";

export type AdAccount = {
  id: number;
  name: string;
  meta_account_id: string;
};

export type BrandWithAdAccounts = {
  id: number;
  name: string;
  ad_accounts: AdAccount[];
};

type ActionResult =
  | { success: true }
  | { success: false; error: string };

export async function getBrandsWithAdAccounts(): Promise<BrandWithAdAccounts[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("brands")
    .select(
      `
      id,
      name,
      ad_accounts (
        id,
        name,
        meta_account_id
      )
    `,
    )
    .order("name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((brand) => ({
    id: brand.id,
    name: brand.name,
    ad_accounts: (brand.ad_accounts ?? []).map((aa: Record<string, unknown>) => ({
      id: aa.id as number,
      name: aa.name as string,
      meta_account_id: aa.meta_account_id as string,
    })),
  }));
}

export async function createBrand(
  input: CreateBrandInput,
): Promise<ActionResult> {
  const parsed = createBrandSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("brands")
    .insert({ name: parsed.data.name });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}

export async function updateBrand(
  input: EditBrandInput,
): Promise<ActionResult> {
  const parsed = editBrandSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("brands")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.brandId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}

export async function deleteBrand(
  brandId: number,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("brands")
    .delete()
    .eq("id", brandId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}

export async function createAdAccount(
  input: CreateAdAccountInput,
): Promise<ActionResult> {
  const parsed = createAdAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("ad_accounts")
    .insert({
      brand_id: parsed.data.brandId,
      name: parsed.data.name,
      meta_account_id: parsed.data.metaAccountId,
    });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}

export async function updateAdAccount(
  input: EditAdAccountInput,
): Promise<ActionResult> {
  const parsed = editAdAccountSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("ad_accounts")
    .update({
      name: parsed.data.name,
      meta_account_id: parsed.data.metaAccountId,
    })
    .eq("id", parsed.data.adAccountId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}

export async function deleteAdAccount(
  adAccountId: number,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("ad_accounts")
    .delete()
    .eq("id", adAccountId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard/brands");
  return { success: true };
}
