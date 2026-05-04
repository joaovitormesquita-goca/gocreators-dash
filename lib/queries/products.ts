import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const getDistinctProducts = unstable_cache(
  async (brandId: number): Promise<string[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("get_distinct_products", {
      p_brand_id: brandId,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row: { product_name: string }) => row.product_name);
  },
  ["distinct-products"],
  { tags: [CACHE_TAGS.PRODUCTS] },
);
