import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const getBrands = unstable_cache(
  async () => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("brands")
      .select("id, name")
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  },
  ["brands-list"],
  { tags: [CACHE_TAGS.BRANDS] },
);
