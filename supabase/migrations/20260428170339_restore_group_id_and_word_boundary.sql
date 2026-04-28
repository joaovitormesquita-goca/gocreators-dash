drop function if exists "public"."get_creator_metrics"(p_brand_id bigint, p_view_mode text);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_creator_metrics(p_brand_id bigint, p_view_mode text DEFAULT 'creator'::text)
 RETURNS TABLE(creator text, creator_brand_id bigint, group_id bigint, product_name text, month timestamp with time zone, spend_total numeric, roas_total numeric, ctr_total numeric, spend_recentes numeric, roas_recentes numeric, ctr_recentes numeric, cost numeric, yearly_spend numeric)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
  IF p_view_mode = 'product' THEN
    RETURN QUERY
      SELECT
        NULL::text AS creator,
        NULL::bigint AS creator_brand_id,
        NULL::bigint AS group_id,
        cr.product_name AS product_name,
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
        END AS ctr_recentes,
        NULL::numeric AS cost,
        NULL::numeric AS yearly_spend
      FROM ad_metrics am
      JOIN creatives cr ON cr.id = am.creative_id
      JOIN creator_brands cb ON cb.id = cr.creator_brand_id
      WHERE cb.brand_id = p_brand_id
        AND cr.product_name IS NOT NULL
      GROUP BY cr.product_name, date_trunc('month', am.date)
      ORDER BY cr.product_name, month DESC;

  ELSIF p_view_mode = 'granular' THEN
    RETURN QUERY
      SELECT
        c.full_name AS creator,
        cb.id AS creator_brand_id,
        cb.group_id AS group_id,
        cr.product_name AS product_name,
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
        END AS ctr_recentes,
        NULL::numeric AS cost,
        NULL::numeric AS yearly_spend
      FROM ad_metrics am
      JOIN creatives cr ON cr.id = am.creative_id
      JOIN creator_brands cb ON cb.id = cr.creator_brand_id
      JOIN creators c ON c.id = cb.creator_id
      WHERE cb.brand_id = p_brand_id
      GROUP BY c.full_name, cb.id, cr.product_name, date_trunc('month', am.date)
      ORDER BY c.full_name, cr.product_name NULLS LAST, month DESC;

  ELSE
    RETURN QUERY
      SELECT
        c.full_name AS creator,
        cb.id AS creator_brand_id,
        cb.group_id AS group_id,
        NULL::text AS product_name,
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
        END AS ctr_recentes,
        cc.cost AS cost,
        SUM(SUM(am.spend)) OVER (
          PARTITION BY cb.id, EXTRACT(YEAR FROM date_trunc('month', am.date))
          ORDER BY date_trunc('month', am.date)
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS yearly_spend
      FROM ad_metrics am
      JOIN creatives cr ON cr.id = am.creative_id
      JOIN creator_brands cb ON cb.id = cr.creator_brand_id
      JOIN creators c ON c.id = cb.creator_id
      LEFT JOIN creator_costs cc
        ON cc.creator_brand_id = cb.id
        AND cc.month = date_trunc('month', am.date)::date
      WHERE cb.brand_id = p_brand_id
      GROUP BY c.full_name, cb.id, date_trunc('month', am.date), cc.cost
      ORDER BY c.full_name, month DESC;
  END IF;
END;
$function$
;


