set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_creator_metrics(p_brand_id bigint)
 RETURNS TABLE(creator text, month timestamp with time zone, spend_total numeric, roas_total numeric, ctr_total numeric, spend_recentes numeric, roas_recentes numeric, ctr_recentes numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    c.full_name AS creator,
    date_trunc('month', am.date) AS month,
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
  GROUP BY c.full_name, date_trunc('month', am.date)
  ORDER BY c.full_name, month DESC;
$function$
;

CREATE OR REPLACE FUNCTION public.get_daily_spend_view(p_brand_id bigint, p_creator_ids bigint[] DEFAULT NULL::bigint[], p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(day date, spend_total numeric, spend_recentes numeric, brand_total_spend numeric)
 LANGUAGE sql
 STABLE
AS $function$
  WITH creator_spend AS (
    SELECT
      am.date AS day,
      COALESCE(SUM(am.spend), 0) AS spend_total,
      COALESCE(SUM(am.spend) FILTER (
        WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month'
      ), 0) AS spend_recentes
    FROM ad_metrics am
    JOIN creatives cr ON cr.id = am.creative_id
    JOIN creator_brands cb ON cb.id = cr.creator_brand_id
    JOIN creators c ON c.id = cb.creator_id
    WHERE cb.brand_id = p_brand_id
      AND (p_creator_ids IS NULL OR c.id = ANY(p_creator_ids))
      AND (p_start_date IS NULL OR am.date >= p_start_date)
      AND (p_end_date IS NULL OR am.date <= p_end_date)
    GROUP BY am.date
  ),
  brand_spend AS (
    SELECT
      ds.date AS day,
      COALESCE(SUM(ds.spend), 0) AS brand_total_spend
    FROM ad_account_daily_spend ds
    JOIN ad_accounts aa ON aa.id = ds.ad_account_id
    WHERE aa.brand_id = p_brand_id
      AND (p_start_date IS NULL OR ds.date >= p_start_date)
      AND (p_end_date IS NULL OR ds.date <= p_end_date)
    GROUP BY ds.date
  )
  SELECT
    COALESCE(cs.day, bs.day) AS day,
    COALESCE(cs.spend_total, 0) AS spend_total,
    COALESCE(cs.spend_recentes, 0) AS spend_recentes,
    COALESCE(bs.brand_total_spend, 0) AS brand_total_spend
  FROM creator_spend cs
  FULL OUTER JOIN brand_spend bs ON cs.day = bs.day
  ORDER BY day;
$function$
;

CREATE OR REPLACE FUNCTION public.get_monthly_spend_view(p_brand_id bigint, p_creator_ids bigint[] DEFAULT NULL::bigint[], p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(month date, spend_total numeric, spend_recentes numeric, brand_total_spend numeric)
 LANGUAGE sql
 STABLE
AS $function$
  WITH creator_spend AS (
    SELECT
      date_trunc('month', am.date)::date AS month,
      COALESCE(SUM(am.spend), 0) AS spend_total,
      COALESCE(SUM(am.spend) FILTER (
        WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month'
      ), 0) AS spend_recentes
    FROM ad_metrics am
    JOIN creatives cr ON cr.id = am.creative_id
    JOIN creator_brands cb ON cb.id = cr.creator_brand_id
    JOIN creators c ON c.id = cb.creator_id
    WHERE cb.brand_id = p_brand_id
      AND (p_creator_ids IS NULL OR c.id = ANY(p_creator_ids))
      AND (p_start_date IS NULL OR am.date >= p_start_date)
      AND (p_end_date IS NULL OR am.date <= p_end_date)
    GROUP BY date_trunc('month', am.date)::date
  ),
  brand_spend AS (
    SELECT
      date_trunc('month', ds.date)::date AS month,
      COALESCE(SUM(ds.spend), 0) AS brand_total_spend
    FROM ad_account_daily_spend ds
    JOIN ad_accounts aa ON aa.id = ds.ad_account_id
    WHERE aa.brand_id = p_brand_id
      AND (p_start_date IS NULL OR ds.date >= p_start_date)
      AND (p_end_date IS NULL OR ds.date <= p_end_date)
    GROUP BY date_trunc('month', ds.date)::date
  )
  SELECT
    COALESCE(cs.month, bs.month) AS month,
    COALESCE(cs.spend_total, 0) AS spend_total,
    COALESCE(cs.spend_recentes, 0) AS spend_recentes,
    COALESCE(bs.brand_total_spend, 0) AS brand_total_spend
  FROM creator_spend cs
  FULL OUTER JOIN brand_spend bs ON cs.month = bs.month
  ORDER BY month;
$function$
;


