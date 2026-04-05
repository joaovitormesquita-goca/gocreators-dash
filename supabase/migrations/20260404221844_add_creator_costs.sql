drop function if exists "public"."get_creator_metrics"(p_brand_id bigint);


  create table "public"."creator_costs" (
    "id" bigint generated always as identity not null,
    "creator_brand_id" bigint not null,
    "month" date not null,
    "cost" numeric not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


CREATE UNIQUE INDEX creator_costs_pkey ON public.creator_costs USING btree (id);

CREATE UNIQUE INDEX creator_costs_unique ON public.creator_costs USING btree (creator_brand_id, month);

alter table "public"."creator_costs" add constraint "creator_costs_pkey" PRIMARY KEY using index "creator_costs_pkey";

alter table "public"."creator_costs" add constraint "creator_costs_cost_check" CHECK ((cost > (0)::numeric)) not valid;

alter table "public"."creator_costs" validate constraint "creator_costs_cost_check";

alter table "public"."creator_costs" add constraint "creator_costs_creator_brand_id_fkey" FOREIGN KEY (creator_brand_id) REFERENCES public.creator_brands(id) ON DELETE CASCADE not valid;

alter table "public"."creator_costs" validate constraint "creator_costs_creator_brand_id_fkey";

alter table "public"."creator_costs" add constraint "creator_costs_unique" UNIQUE using index "creator_costs_unique";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.get_creator_metrics(p_brand_id bigint)
 RETURNS TABLE(creator text, creator_brand_id bigint, month timestamp with time zone, spend_total numeric, roas_total numeric, ctr_total numeric, spend_recentes numeric, roas_recentes numeric, ctr_recentes numeric, cost numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    c.full_name AS creator,
    cb.id AS creator_brand_id,
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
    cc.cost AS cost
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
$function$
;

grant delete on table "public"."creator_costs" to "anon";

grant insert on table "public"."creator_costs" to "anon";

grant references on table "public"."creator_costs" to "anon";

grant select on table "public"."creator_costs" to "anon";

grant trigger on table "public"."creator_costs" to "anon";

grant truncate on table "public"."creator_costs" to "anon";

grant update on table "public"."creator_costs" to "anon";

grant delete on table "public"."creator_costs" to "authenticated";

grant insert on table "public"."creator_costs" to "authenticated";

grant references on table "public"."creator_costs" to "authenticated";

grant select on table "public"."creator_costs" to "authenticated";

grant trigger on table "public"."creator_costs" to "authenticated";

grant truncate on table "public"."creator_costs" to "authenticated";

grant update on table "public"."creator_costs" to "authenticated";

grant delete on table "public"."creator_costs" to "service_role";

grant insert on table "public"."creator_costs" to "service_role";

grant references on table "public"."creator_costs" to "service_role";

grant select on table "public"."creator_costs" to "service_role";

grant trigger on table "public"."creator_costs" to "service_role";

grant truncate on table "public"."creator_costs" to "service_role";

grant update on table "public"."creator_costs" to "service_role";


