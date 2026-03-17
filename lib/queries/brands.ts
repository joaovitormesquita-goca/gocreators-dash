import { createClient } from "@/lib/supabase/server";

export async function getBrands() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .order("name");

  if (error) throw new Error(error.message);
  return data;
}
