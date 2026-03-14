function escapeSQL(value: string): string {
  return value.replace(/'/g, "''");
}

export function buildMetabaseQuery(
  metaAccountId: string,
  handles: string[],
): string {
  const handleConditions = handles
    .map((h) => `ad_name ILIKE '%${escapeSQL(h)}%'`)
    .join(" OR ");

  return `
SELECT
  ad_id,
  ad_name,
  created_time,
  date_start::date AS date,
  SUM(COALESCE(spend, 0)) AS spend,
  SUM(COALESCE(purchase_value, 0)) AS revenue,
  SUM(COALESCE(inline_link_clicks, 0)) AS link_clicks,
  SUM(COALESCE(impressions, 0)) AS impressions
FROM raw.gogroup_ads_metrics
WHERE account_id = '${escapeSQL(metaAccountId)}'
  AND date_start >= CURRENT_DATE - INTERVAL '7 days'
  AND (${handleConditions})
GROUP BY ad_id, ad_name, created_time, date_start::date
  `.trim();
}
