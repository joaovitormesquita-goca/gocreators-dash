export interface AdAccount {
  id: number;
  brand_id: number;
  meta_account_id: string;
}

export interface CreatorBrand {
  id: number;
  brand_id: number;
  handles: string[];
}

export interface MetabaseRow {
  ad_id: string;
  ad_name: string;
  created_time: string;
  date: string;
  spend: number;
  revenue: number;
  link_clicks: number;
  impressions: number;
}

export interface AccountSpendRow {
  account_id: string;
  date: string;
  spend: number;
}

export interface SyncResult {
  account_id: string;
  status: "success" | "error";
  creatives_upserted: number;
  metrics_upserted: number;
  unmatched_ads: number;
  account_spend_upserted: number;
  error?: string;
}
