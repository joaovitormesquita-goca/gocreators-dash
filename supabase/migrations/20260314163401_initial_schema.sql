
  create table "public"."ad_accounts" (
    "id" bigint generated always as identity not null,
    "brand_id" bigint not null,
    "name" text not null,
    "meta_account_id" text not null,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."ad_metrics" (
    "id" bigint generated always as identity not null,
    "creative_id" bigint not null,
    "date" date not null,
    "spend" numeric not null default 0,
    "revenue" numeric not null default 0,
    "link_clicks" integer not null default 0,
    "impressions" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."brands" (
    "id" bigint generated always as identity not null,
    "name" text not null,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."creatives" (
    "id" bigint generated always as identity not null,
    "creator_brand_id" bigint not null,
    "ad_account_id" bigint not null,
    "meta_ad_id" text not null,
    "created_time" timestamp with time zone not null,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."creator_brands" (
    "id" bigint generated always as identity not null,
    "creator_id" bigint not null,
    "brand_id" bigint not null,
    "handles" text[] not null default '{}'::text[],
    "start_date" date not null,
    "end_date" date,
    "created_at" timestamp with time zone not null default now()
      );



  create table "public"."creators" (
    "id" bigint generated always as identity not null,
    "full_name" text not null,
    "email" text,
    "created_at" timestamp with time zone not null default now()
      );


CREATE UNIQUE INDEX ad_accounts_pkey ON public.ad_accounts USING btree (id);

CREATE UNIQUE INDEX ad_metrics_creative_id_date_key ON public.ad_metrics USING btree (creative_id, date);

CREATE UNIQUE INDEX ad_metrics_pkey ON public.ad_metrics USING btree (id);

CREATE UNIQUE INDEX brands_pkey ON public.brands USING btree (id);

CREATE UNIQUE INDEX creatives_meta_ad_id_key ON public.creatives USING btree (meta_ad_id);

CREATE UNIQUE INDEX creatives_pkey ON public.creatives USING btree (id);

CREATE UNIQUE INDEX creator_brands_pkey ON public.creator_brands USING btree (id);

CREATE UNIQUE INDEX creators_pkey ON public.creators USING btree (id);

alter table "public"."ad_accounts" add constraint "ad_accounts_pkey" PRIMARY KEY using index "ad_accounts_pkey";

alter table "public"."ad_metrics" add constraint "ad_metrics_pkey" PRIMARY KEY using index "ad_metrics_pkey";

alter table "public"."brands" add constraint "brands_pkey" PRIMARY KEY using index "brands_pkey";

alter table "public"."creatives" add constraint "creatives_pkey" PRIMARY KEY using index "creatives_pkey";

alter table "public"."creator_brands" add constraint "creator_brands_pkey" PRIMARY KEY using index "creator_brands_pkey";

alter table "public"."creators" add constraint "creators_pkey" PRIMARY KEY using index "creators_pkey";

alter table "public"."ad_accounts" add constraint "ad_accounts_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE not valid;

alter table "public"."ad_accounts" validate constraint "ad_accounts_brand_id_fkey";

alter table "public"."ad_metrics" add constraint "ad_metrics_creative_id_date_key" UNIQUE using index "ad_metrics_creative_id_date_key";

alter table "public"."ad_metrics" add constraint "ad_metrics_creative_id_fkey" FOREIGN KEY (creative_id) REFERENCES public.creatives(id) ON DELETE CASCADE not valid;

alter table "public"."ad_metrics" validate constraint "ad_metrics_creative_id_fkey";

alter table "public"."creatives" add constraint "creatives_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES public.ad_accounts(id) ON DELETE CASCADE not valid;

alter table "public"."creatives" validate constraint "creatives_ad_account_id_fkey";

alter table "public"."creatives" add constraint "creatives_creator_brand_id_fkey" FOREIGN KEY (creator_brand_id) REFERENCES public.creator_brands(id) ON DELETE CASCADE not valid;

alter table "public"."creatives" validate constraint "creatives_creator_brand_id_fkey";

alter table "public"."creatives" add constraint "creatives_meta_ad_id_key" UNIQUE using index "creatives_meta_ad_id_key";

alter table "public"."creator_brands" add constraint "creator_brands_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE not valid;

alter table "public"."creator_brands" validate constraint "creator_brands_brand_id_fkey";

alter table "public"."creator_brands" add constraint "creator_brands_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE CASCADE not valid;

alter table "public"."creator_brands" validate constraint "creator_brands_creator_id_fkey";

grant delete on table "public"."ad_accounts" to "anon";

grant insert on table "public"."ad_accounts" to "anon";

grant references on table "public"."ad_accounts" to "anon";

grant select on table "public"."ad_accounts" to "anon";

grant trigger on table "public"."ad_accounts" to "anon";

grant truncate on table "public"."ad_accounts" to "anon";

grant update on table "public"."ad_accounts" to "anon";

grant delete on table "public"."ad_accounts" to "authenticated";

grant insert on table "public"."ad_accounts" to "authenticated";

grant references on table "public"."ad_accounts" to "authenticated";

grant select on table "public"."ad_accounts" to "authenticated";

grant trigger on table "public"."ad_accounts" to "authenticated";

grant truncate on table "public"."ad_accounts" to "authenticated";

grant update on table "public"."ad_accounts" to "authenticated";

grant delete on table "public"."ad_accounts" to "service_role";

grant insert on table "public"."ad_accounts" to "service_role";

grant references on table "public"."ad_accounts" to "service_role";

grant select on table "public"."ad_accounts" to "service_role";

grant trigger on table "public"."ad_accounts" to "service_role";

grant truncate on table "public"."ad_accounts" to "service_role";

grant update on table "public"."ad_accounts" to "service_role";

grant delete on table "public"."ad_metrics" to "anon";

grant insert on table "public"."ad_metrics" to "anon";

grant references on table "public"."ad_metrics" to "anon";

grant select on table "public"."ad_metrics" to "anon";

grant trigger on table "public"."ad_metrics" to "anon";

grant truncate on table "public"."ad_metrics" to "anon";

grant update on table "public"."ad_metrics" to "anon";

grant delete on table "public"."ad_metrics" to "authenticated";

grant insert on table "public"."ad_metrics" to "authenticated";

grant references on table "public"."ad_metrics" to "authenticated";

grant select on table "public"."ad_metrics" to "authenticated";

grant trigger on table "public"."ad_metrics" to "authenticated";

grant truncate on table "public"."ad_metrics" to "authenticated";

grant update on table "public"."ad_metrics" to "authenticated";

grant delete on table "public"."ad_metrics" to "service_role";

grant insert on table "public"."ad_metrics" to "service_role";

grant references on table "public"."ad_metrics" to "service_role";

grant select on table "public"."ad_metrics" to "service_role";

grant trigger on table "public"."ad_metrics" to "service_role";

grant truncate on table "public"."ad_metrics" to "service_role";

grant update on table "public"."ad_metrics" to "service_role";

grant delete on table "public"."brands" to "anon";

grant insert on table "public"."brands" to "anon";

grant references on table "public"."brands" to "anon";

grant select on table "public"."brands" to "anon";

grant trigger on table "public"."brands" to "anon";

grant truncate on table "public"."brands" to "anon";

grant update on table "public"."brands" to "anon";

grant delete on table "public"."brands" to "authenticated";

grant insert on table "public"."brands" to "authenticated";

grant references on table "public"."brands" to "authenticated";

grant select on table "public"."brands" to "authenticated";

grant trigger on table "public"."brands" to "authenticated";

grant truncate on table "public"."brands" to "authenticated";

grant update on table "public"."brands" to "authenticated";

grant delete on table "public"."brands" to "service_role";

grant insert on table "public"."brands" to "service_role";

grant references on table "public"."brands" to "service_role";

grant select on table "public"."brands" to "service_role";

grant trigger on table "public"."brands" to "service_role";

grant truncate on table "public"."brands" to "service_role";

grant update on table "public"."brands" to "service_role";

grant delete on table "public"."creatives" to "anon";

grant insert on table "public"."creatives" to "anon";

grant references on table "public"."creatives" to "anon";

grant select on table "public"."creatives" to "anon";

grant trigger on table "public"."creatives" to "anon";

grant truncate on table "public"."creatives" to "anon";

grant update on table "public"."creatives" to "anon";

grant delete on table "public"."creatives" to "authenticated";

grant insert on table "public"."creatives" to "authenticated";

grant references on table "public"."creatives" to "authenticated";

grant select on table "public"."creatives" to "authenticated";

grant trigger on table "public"."creatives" to "authenticated";

grant truncate on table "public"."creatives" to "authenticated";

grant update on table "public"."creatives" to "authenticated";

grant delete on table "public"."creatives" to "service_role";

grant insert on table "public"."creatives" to "service_role";

grant references on table "public"."creatives" to "service_role";

grant select on table "public"."creatives" to "service_role";

grant trigger on table "public"."creatives" to "service_role";

grant truncate on table "public"."creatives" to "service_role";

grant update on table "public"."creatives" to "service_role";

grant delete on table "public"."creator_brands" to "anon";

grant insert on table "public"."creator_brands" to "anon";

grant references on table "public"."creator_brands" to "anon";

grant select on table "public"."creator_brands" to "anon";

grant trigger on table "public"."creator_brands" to "anon";

grant truncate on table "public"."creator_brands" to "anon";

grant update on table "public"."creator_brands" to "anon";

grant delete on table "public"."creator_brands" to "authenticated";

grant insert on table "public"."creator_brands" to "authenticated";

grant references on table "public"."creator_brands" to "authenticated";

grant select on table "public"."creator_brands" to "authenticated";

grant trigger on table "public"."creator_brands" to "authenticated";

grant truncate on table "public"."creator_brands" to "authenticated";

grant update on table "public"."creator_brands" to "authenticated";

grant delete on table "public"."creator_brands" to "service_role";

grant insert on table "public"."creator_brands" to "service_role";

grant references on table "public"."creator_brands" to "service_role";

grant select on table "public"."creator_brands" to "service_role";

grant trigger on table "public"."creator_brands" to "service_role";

grant truncate on table "public"."creator_brands" to "service_role";

grant update on table "public"."creator_brands" to "service_role";

grant delete on table "public"."creators" to "anon";

grant insert on table "public"."creators" to "anon";

grant references on table "public"."creators" to "anon";

grant select on table "public"."creators" to "anon";

grant trigger on table "public"."creators" to "anon";

grant truncate on table "public"."creators" to "anon";

grant update on table "public"."creators" to "anon";

grant delete on table "public"."creators" to "authenticated";

grant insert on table "public"."creators" to "authenticated";

grant references on table "public"."creators" to "authenticated";

grant select on table "public"."creators" to "authenticated";

grant trigger on table "public"."creators" to "authenticated";

grant truncate on table "public"."creators" to "authenticated";

grant update on table "public"."creators" to "authenticated";

grant delete on table "public"."creators" to "service_role";

grant insert on table "public"."creators" to "service_role";

grant references on table "public"."creators" to "service_role";

grant select on table "public"."creators" to "service_role";

grant trigger on table "public"."creators" to "service_role";

grant truncate on table "public"."creators" to "service_role";

grant update on table "public"."creators" to "service_role";


