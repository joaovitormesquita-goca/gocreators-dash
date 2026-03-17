import { createClient } from "@/lib/supabase/server";

export async function getCreatorsByBrand(brandId: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creator_brands")
    .select("creators(id, full_name)")
    .eq("brand_id", brandId);

  if (error) throw new Error(error.message);

  // Flatten the nested response and deduplicate by creator id
  const creatorsMap = new Map<number, string>();
  for (const row of data ?? []) {
    const creator = row.creators as unknown as {
      id: number;
      full_name: string;
    };
    if (creator && !creatorsMap.has(creator.id)) {
      creatorsMap.set(creator.id, creator.full_name);
    }
  }

  return Array.from(creatorsMap.entries()).map(([id, full_name]) => ({
    id,
    full_name,
  }));
}
