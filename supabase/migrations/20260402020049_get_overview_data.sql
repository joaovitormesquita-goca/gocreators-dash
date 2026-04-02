set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_overview_data(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(month date, brand_id bigint, brand_name text, spend_total numeric, spend_recentes numeric, brand_total_spend numeric)
 LANGUAGE sql
 STABLE
AS $function$
  WITH creator_spend AS (
    SELECT
      date_trunc('month', am.date)::date AS month,
      cb.brand_id,
      COALESCE(SUM(am.spend), 0) AS spend_total,
      COALESCE(SUM(am.spend) FILTER (
        WHERE cr.created_time >= date_trunc('month', am.date) - INTERVAL '1 month'
          AND cr.created_time < date_trunc('month', am.date) + INTERVAL '1 month'
      ), 0) AS spend_recentes
    FROM ad_metrics am
    JOIN creatives cr ON cr.id = am.creative_id
    JOIN creator_brands cb ON cb.id = cr.creator_brand_id
    WHERE (p_start_date IS NULL OR am.date >= p_start_date)
      AND (p_end_date IS NULL OR am.date <= p_end_date)
    GROUP BY date_trunc('month', am.date)::date, cb.brand_id
  ),
  brand_spend AS (
    SELECT
      date_trunc('month', ds.date)::date AS month,
      aa.brand_id,
      COALESCE(SUM(ds.spend), 0) AS brand_total_spend
    FROM ad_account_daily_spend ds
    JOIN ad_accounts aa ON aa.id = ds.ad_account_id
    WHERE (p_start_date IS NULL OR ds.date >= p_start_date)
      AND (p_end_date IS NULL OR ds.date <= p_end_date)
    GROUP BY date_trunc('month', ds.date)::date, aa.brand_id
  )
  SELECT
    COALESCE(cs.month, bs.month) AS month,
    b.id AS brand_id,
    b.name AS brand_name,
    COALESCE(cs.spend_total, 0) AS spend_total,
    COALESCE(cs.spend_recentes, 0) AS spend_recentes,
    COALESCE(bs.brand_total_spend, 0) AS brand_total_spend
  FROM creator_spend cs
  FULL OUTER JOIN brand_spend bs
    ON cs.month = bs.month AND cs.brand_id = bs.brand_id
  JOIN brands b ON b.id = COALESCE(cs.brand_id, bs.brand_id)
  ORDER BY month DESC, brand_name;
$function$
;


