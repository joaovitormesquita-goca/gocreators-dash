"use server";

import { createClient } from "@/lib/supabase/server";

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

export async function getSyncLogs(): Promise<SyncLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sync_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data ?? [];
}
