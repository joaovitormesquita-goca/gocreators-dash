import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const getCreatorsByBrand = unstable_cache(
  async (brandId: number) => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("creator_brands")
      .select("creators(id, full_name)")
      .eq("brand_id", brandId);

    if (error) throw new Error(error.message);

    const creatorsMap = new Map<number, string>();
    for (const row of data ?? []) {
      const creator = row.creators as unknown as { id: number; full_name: string };
      if (creator && !creatorsMap.has(creator.id)) {
        creatorsMap.set(creator.id, creator.full_name);
      }
    }

    return Array.from(creatorsMap.entries()).map(([id, full_name]) => ({
      id,
      full_name,
    }));
  },
  ["creators-by-brand"],
  { tags: [CACHE_TAGS.BRANDS] },
);
