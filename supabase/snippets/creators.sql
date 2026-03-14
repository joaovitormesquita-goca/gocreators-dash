SELECT
  c.full_name AS creator,
  am.date,
  -- Total
  SUM(am.spend) AS spend_total,
  SUM(am.revenue) AS revenue_total,
  SUM(am.link_clicks) AS link_clicks_total,
  SUM(am.impressions) AS impressions_total,
  CASE WHEN SUM(am.spend) > 0
    THEN ROUND(SUM(am.revenue) / SUM(am.spend), 2) ELSE 0
  END AS roas_total,
  CASE WHEN SUM(am.impressions) > 0
    THEN ROUND(SUM(am.link_clicks)::numeric / SUM(am.impressions) * 100, 2) ELSE 0
  END AS ctr_total,
  -- Recentes (criativos criados no mês atual ou anterior)
  SUM(am.spend) FILTER (WHERE cr.created_time >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month') AS spend_recentes,
  SUM(am.revenue) FILTER (WHERE cr.created_time >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month') AS revenue_recentes,
  SUM(am.link_clicks) FILTER (WHERE cr.created_time >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month') AS link_clicks_recentes,
  SUM(am.impressions) FILTER (WHERE cr.created_time >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month') AS impressions_recentes,
  CASE WHEN SUM(am.spend) FILTER (WHERE cr.created_time >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month') > 0
    THEN ROUND(
      SUM(am.revenue) FILTER (WHERE cr.created_time >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')
      / SUM(am.spend) FILTER (WHERE cr.created_time >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'), 2)
    ELSE 0
  END AS roas_recentes,
  CASE WHEN SUM(am.impressions) FILTER (WHERE cr.created_time >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month') > 0
    THEN ROUND(
      (SUM(am.link_clicks) FILTER (WHERE cr.created_time >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'))::numeric
      / SUM(am.impressions) FILTER (WHERE cr.created_time >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month') * 100, 2)
    ELSE 0
  END AS ctr_recentes
FROM ad_metrics am
JOIN creatives cr ON cr.id = am.creative_id
JOIN creator_brands cb ON cb.id = cr.creator_brand_id
JOIN creators c ON c.id = cb.creator_id
GROUP BY c.full_name, am.date
ORDER BY c.full_name, am.date DESC ;