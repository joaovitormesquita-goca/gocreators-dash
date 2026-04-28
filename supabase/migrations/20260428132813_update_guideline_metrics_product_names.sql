drop function if exists "public"."get_guideline_metrics"(p_brand_id bigint, p_month text);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_guideline_metrics(p_brand_id bigint, p_month text DEFAULT NULL::text)
 RETURNS TABLE(guideline_number integer, spend numeric, revenue numeric, roas numeric, ctr numeric, creator_count bigint, ad_count bigint, prev_roas numeric, prev_month text, product_names text)
 LANGUAGE sql
 STABLE
AS $function$
  WITH monthly_roas AS (
    SELECT
      cr.guideline_number,
      to_char(am.date, 'YYYY-MM') AS month,
      CASE WHEN SUM(am.spend) > 0
        THEN ROUND(SUM(am.revenue) / SUM(am.spend), 2) ELSE 0
      END AS roas
    FROM ad_metrics am
    JOIN creatives cr ON cr.id = am.creative_id
    JOIN creator_brands cb ON cb.id = cr.creator_brand_id
    WHERE cb.brand_id = p_brand_id
      AND cr.guideline_number IS NOT NULL
    GROUP BY cr.guideline_number, to_char(am.date, 'YYYY-MM')
  ),
  prev_data AS (
    SELECT DISTINCT ON (mr.guideline_number)
      mr.guideline_number,
      mr.roas AS prev_roas,
      mr.month AS prev_month
    FROM monthly_roas mr
    WHERE p_month IS NOT NULL
      AND mr.month < p_month
    ORDER BY mr.guideline_number, mr.month DESC
  )
  SELECT
    cr.guideline_number,
    SUM(am.spend) AS spend,
    SUM(am.revenue) AS revenue,
    CASE WHEN SUM(am.spend) > 0
      THEN ROUND(SUM(am.revenue) / SUM(am.spend), 2) ELSE 0
    END AS roas,
    CASE WHEN SUM(am.impressions) > 0
      THEN ROUND(SUM(am.link_clicks)::numeric / SUM(am.impressions) * 100, 2) ELSE 0
    END AS ctr,
    COUNT(DISTINCT cb.creator_id) AS creator_count,
    COUNT(DISTINCT cr.meta_ad_id) AS ad_count,
    pd.prev_roas,
    pd.prev_month,
    STRING_AGG(DISTINCT cr.product_name, ', ') AS product_names
  FROM ad_metrics am
  JOIN creatives cr ON cr.id = am.creative_id
  JOIN creator_brands cb ON cb.id = cr.creator_brand_id
  LEFT JOIN prev_data pd ON pd.guideline_number = cr.guideline_number
  WHERE cb.brand_id = p_brand_id
    AND cr.guideline_number IS NOT NULL
    AND (p_month IS NULL OR to_char(am.date, 'YYYY-MM') = p_month)
  GROUP BY cr.guideline_number, pd.prev_roas, pd.prev_month
  ORDER BY roas DESC;
$function$
;


