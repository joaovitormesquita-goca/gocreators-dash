
  create table "public"."ad_account_daily_spend" (
    "id" bigint generated always as identity not null,
    "ad_account_id" bigint not null,
    "date" date not null,
    "spend" numeric not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."sync_logs" add column "account_spend_upserted" integer not null default 0;

CREATE UNIQUE INDEX ad_account_daily_spend_ad_account_id_date_key ON public.ad_account_daily_spend USING btree (ad_account_id, date);

CREATE UNIQUE INDEX ad_account_daily_spend_pkey ON public.ad_account_daily_spend USING btree (id);

alter table "public"."ad_account_daily_spend" add constraint "ad_account_daily_spend_pkey" PRIMARY KEY using index "ad_account_daily_spend_pkey";

alter table "public"."ad_account_daily_spend" add constraint "ad_account_daily_spend_ad_account_id_date_key" UNIQUE using index "ad_account_daily_spend_ad_account_id_date_key";

alter table "public"."ad_account_daily_spend" add constraint "ad_account_daily_spend_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES public.ad_accounts(id) ON DELETE CASCADE not valid;

alter table "public"."ad_account_daily_spend" validate constraint "ad_account_daily_spend_ad_account_id_fkey";

grant delete on table "public"."ad_account_daily_spend" to "anon";

grant insert on table "public"."ad_account_daily_spend" to "anon";

grant references on table "public"."ad_account_daily_spend" to "anon";

grant select on table "public"."ad_account_daily_spend" to "anon";

grant trigger on table "public"."ad_account_daily_spend" to "anon";

grant truncate on table "public"."ad_account_daily_spend" to "anon";

grant update on table "public"."ad_account_daily_spend" to "anon";

grant delete on table "public"."ad_account_daily_spend" to "authenticated";

grant insert on table "public"."ad_account_daily_spend" to "authenticated";

grant references on table "public"."ad_account_daily_spend" to "authenticated";

grant select on table "public"."ad_account_daily_spend" to "authenticated";

grant trigger on table "public"."ad_account_daily_spend" to "authenticated";

grant truncate on table "public"."ad_account_daily_spend" to "authenticated";

grant update on table "public"."ad_account_daily_spend" to "authenticated";

grant delete on table "public"."ad_account_daily_spend" to "service_role";

grant insert on table "public"."ad_account_daily_spend" to "service_role";

grant references on table "public"."ad_account_daily_spend" to "service_role";

grant select on table "public"."ad_account_daily_spend" to "service_role";

grant trigger on table "public"."ad_account_daily_spend" to "service_role";

grant truncate on table "public"."ad_account_daily_spend" to "service_role";

grant update on table "public"."ad_account_daily_spend" to "service_role";


