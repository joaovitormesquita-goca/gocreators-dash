function escapeSQL(value: string): string {
  return value.replace(/'/g, "''");
}

export function buildMetabaseQuery(
  metaAccountId: string,
  handles: string[],
  dateFrom?: string,
  dateTo?: string,
): string {
  const handleConditions = handles
    .map((h) => `ad_name ILIKE '%${escapeSQL(h)}%'`)
    .join(" OR ");

  const dateCondition =
    dateFrom && dateTo
      ? `date_start >= '${escapeSQL(dateFrom)}' AND date_start < '${escapeSQL(dateTo)}'`
      : `date_start >= CURRENT_DATE - INTERVAL '7 days'`;

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
  AND ${dateCondition}
  AND (${handleConditions})
GROUP BY ad_id, ad_name, created_time, date_start::date
  `.trim();
}

export function buildAccountSpendQuery(
  metaAccountId: string,
  dateFrom?: string,
  dateTo?: string,
): string {
  const dateCondition =
    dateFrom && dateTo
      ? `date_start >= '${escapeSQL(dateFrom)}' AND date_start < '${escapeSQL(dateTo)}'`
      : `date_start >= CURRENT_DATE - INTERVAL '7 days'`;

  return `
SELECT
  account_id,
  date_start::date AS date,
  SUM(COALESCE(spend, 0)) AS spend
FROM raw.gogroup_ads_metrics
WHERE account_id = '${escapeSQL(metaAccountId)}'
  AND ${dateCondition}
GROUP BY account_id, date_start::date
  `.trim();
}
