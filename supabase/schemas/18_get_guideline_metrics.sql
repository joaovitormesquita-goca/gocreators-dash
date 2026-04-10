CREATE OR REPLACE FUNCTION get_guideline_metrics(p_brand_id bigint, p_month text DEFAULT NULL)
RETURNS TABLE (
  guideline_number integer,
  spend numeric,
  roas numeric,
  ctr numeric,
  creator_count bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    cr.guideline_number,
    SUM(am.spend) AS spend,
    CASE WHEN SUM(am.spend) > 0
      THEN ROUND(SUM(am.revenue) / SUM(am.spend), 2) ELSE 0
    END AS roas,
    CASE WHEN SUM(am.impressions) > 0
      THEN ROUND(SUM(am.link_clicks)::numeric / SUM(am.impressions) * 100, 2) ELSE 0
    END AS ctr,
    COUNT(DISTINCT cb.creator_id) AS creator_count
  FROM ad_metrics am
  JOIN creatives cr ON cr.id = am.creative_id
  JOIN creator_brands cb ON cb.id = cr.creator_brand_id
  WHERE cb.brand_id = p_brand_id
    AND cr.guideline_number IS NOT NULL
    AND (p_month IS NULL OR to_char(am.date, 'YYYY-MM') = p_month)
  GROUP BY cr.guideline_number
  ORDER BY roas DESC;
$$;

CREATE OR REPLACE FUNCTION get_guideline_available_months(p_brand_id bigint)
RETURNS TABLE (month text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT to_char(am.date, 'YYYY-MM') AS month
  FROM ad_metrics am
  JOIN creatives cr ON cr.id = am.creative_id
  JOIN creator_brands cb ON cb.id = cr.creator_brand_id
  WHERE cb.brand_id = p_brand_id
    AND cr.guideline_number IS NOT NULL
  ORDER BY month DESC;
$$;
