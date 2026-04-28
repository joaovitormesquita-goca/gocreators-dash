import { createClient } from "@/lib/supabase/server";

export async function getDistinctProducts(brandId: number): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_distinct_products", {
    p_brand_id: brandId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: { product_name: string }) => row.product_name);
}
