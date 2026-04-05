set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_cost_matrix(p_brand_id bigint, p_month_from date DEFAULT NULL::date, p_month_to date DEFAULT NULL::date)
 RETURNS TABLE(creator_name text, brand_name text, creator_brand_id bigint, month date, cost numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    c.full_name AS creator_name,
    b.name AS brand_name,
    cb.id AS creator_brand_id,
    m.month::date AS month,
    cc.cost
  FROM creator_brands cb
  JOIN creators c ON c.id = cb.creator_id
  JOIN brands b ON b.id = cb.brand_id
  CROSS JOIN LATERAL generate_series(
    date_trunc('month', cb.start_date)::date,
    date_trunc('month', COALESCE(cb.end_date, CURRENT_DATE))::date,
    '1 month'::interval
  ) AS m(month)
  LEFT JOIN creator_costs cc
    ON cc.creator_brand_id = cb.id
    AND cc.month = m.month::date
  WHERE cb.brand_id = p_brand_id
    AND (p_month_from IS NULL OR m.month >= p_month_from)
    AND (p_month_to IS NULL OR m.month <= p_month_to)
  ORDER BY c.full_name, m.month;
$function$
;


