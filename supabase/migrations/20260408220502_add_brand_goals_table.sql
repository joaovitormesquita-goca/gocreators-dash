
  create table "public"."brand_goals" (
    "id" uuid not null default gen_random_uuid(),
    "brand_id" bigint not null,
    "metric" text not null,
    "month" date not null,
    "value" numeric not null,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


CREATE UNIQUE INDEX brand_goals_brand_id_metric_month_key ON public.brand_goals USING btree (brand_id, metric, month);

CREATE UNIQUE INDEX brand_goals_pkey ON public.brand_goals USING btree (id);

alter table "public"."brand_goals" add constraint "brand_goals_pkey" PRIMARY KEY using index "brand_goals_pkey";

alter table "public"."brand_goals" add constraint "brand_goals_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE not valid;

alter table "public"."brand_goals" validate constraint "brand_goals_brand_id_fkey";

alter table "public"."brand_goals" add constraint "brand_goals_brand_id_metric_month_key" UNIQUE using index "brand_goals_brand_id_metric_month_key";

alter table "public"."brand_goals" add constraint "brand_goals_metric_check" CHECK ((metric = ANY (ARRAY['share_total'::text, 'share_recent'::text]))) not valid;

alter table "public"."brand_goals" validate constraint "brand_goals_metric_check";

alter table "public"."brand_goals" add constraint "brand_goals_value_check" CHECK (((value >= (0)::numeric) AND (value <= (100)::numeric))) not valid;

alter table "public"."brand_goals" validate constraint "brand_goals_value_check";

grant delete on table "public"."brand_goals" to "anon";

grant insert on table "public"."brand_goals" to "anon";

grant references on table "public"."brand_goals" to "anon";

grant select on table "public"."brand_goals" to "anon";

grant trigger on table "public"."brand_goals" to "anon";

grant truncate on table "public"."brand_goals" to "anon";

grant update on table "public"."brand_goals" to "anon";

grant delete on table "public"."brand_goals" to "authenticated";

grant insert on table "public"."brand_goals" to "authenticated";

grant references on table "public"."brand_goals" to "authenticated";

grant select on table "public"."brand_goals" to "authenticated";

grant trigger on table "public"."brand_goals" to "authenticated";

grant truncate on table "public"."brand_goals" to "authenticated";

grant update on table "public"."brand_goals" to "authenticated";

grant delete on table "public"."brand_goals" to "service_role";

grant insert on table "public"."brand_goals" to "service_role";

grant references on table "public"."brand_goals" to "service_role";

grant select on table "public"."brand_goals" to "service_role";

grant trigger on table "public"."brand_goals" to "service_role";

grant truncate on table "public"."brand_goals" to "service_role";

grant update on table "public"."brand_goals" to "service_role";


