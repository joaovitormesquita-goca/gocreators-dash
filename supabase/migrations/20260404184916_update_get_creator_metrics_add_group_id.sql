drop function if exists "public"."get_creator_metrics"(p_brand_id bigint);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_creator_metrics(p_brand_id bigint)
 RETURNS TABLE(creator text, month timestamp with time zone, group_id bigint, spend_total numeric, roas_total numeric, ctr_total numeric, spend_recentes numeric, roas_recentes numeric, ctr_recentes numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    c.full_name AS creator,
    date_trunc('month', am.date) AS month,
    cb.group_id,
    SUM(am.spend) AS spend_total,
    CASE WHEN SUM(am.spend) > 0
      THEN ROUND(SUM(am.revenue) / SUM(am.spend), 2) ELSE 0
    END AS roas_total,
    CASE WHEN SUM(am.impressions) > 0
      THEN ROUND(SUM(am.link_clicks)::numeric / SUM(am.impressions) * 100, 2) ELSE 0
    END AS ctr_total,
    SUM(am.spend) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
      AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month') AS spend_recentes,
    CASE WHEN SUM(am.spend) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
      AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month') > 0
      THEN ROUND(
        SUM(am.revenue) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month')
        / SUM(am.spend) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month'), 2)
      ELSE 0
    END AS roas_recentes,
    CASE WHEN SUM(am.impressions) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
      AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month') > 0
      THEN ROUND(
        (SUM(am.link_clicks) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month'))::numeric
        / SUM(am.impressions) FILTER (WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month') * 100, 2)
      ELSE 0
    END AS ctr_recentes
  FROM ad_metrics am
  JOIN creatives cr ON cr.id = am.creative_id
  JOIN creator_brands cb ON cb.id = cr.creator_brand_id
  JOIN creators c ON c.id = cb.creator_id
  WHERE cb.brand_id = p_brand_id
  GROUP BY c.full_name, date_trunc('month', am.date), cb.group_id
  ORDER BY c.full_name, month DESC;
$function$
;


