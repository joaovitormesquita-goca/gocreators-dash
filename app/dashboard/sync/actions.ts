"use server";

import { unstable_cache } from "next/cache";
import { createStaticClient } from "@/lib/supabase/static";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type SyncLog = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  trigger: "manual" | "scheduled";
  creatives_upserted: number;
  metrics_upserted: number;
  unmatched_ads: number;
  account_spend_upserted: number;
  error_message: string | null;
};

export const getSyncLogs = unstable_cache(
  async (): Promise<SyncLog[]> => {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("sync_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["sync-logs"],
  { tags: [CACHE_TAGS.SYNC_LOGS] },
);
