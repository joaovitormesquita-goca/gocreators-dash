export const CACHE_TAGS = {
  BRANDS: "brands",
  METRICS: "metrics",
  COSTS: "costs",
  PRODUCTS: "products",
  SYNC_LOGS: "sync-logs",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
