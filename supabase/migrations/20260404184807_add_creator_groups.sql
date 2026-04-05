
  create table "public"."creator_groups" (
    "id" bigint generated always as identity not null,
    "brand_id" bigint not null,
    "name" text not null,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."creator_brands" add column "group_id" bigint;

CREATE UNIQUE INDEX creator_groups_brand_id_name_key ON public.creator_groups USING btree (brand_id, name);

CREATE UNIQUE INDEX creator_groups_pkey ON public.creator_groups USING btree (id);

alter table "public"."creator_groups" add constraint "creator_groups_pkey" PRIMARY KEY using index "creator_groups_pkey";

alter table "public"."creator_brands" add constraint "creator_brands_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.creator_groups(id) ON DELETE SET NULL not valid;

alter table "public"."creator_brands" validate constraint "creator_brands_group_id_fkey";

alter table "public"."creator_groups" add constraint "creator_groups_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE not valid;

alter table "public"."creator_groups" validate constraint "creator_groups_brand_id_fkey";

alter table "public"."creator_groups" add constraint "creator_groups_brand_id_name_key" UNIQUE using index "creator_groups_brand_id_name_key";

grant delete on table "public"."creator_groups" to "anon";

grant insert on table "public"."creator_groups" to "anon";

grant references on table "public"."creator_groups" to "anon";

grant select on table "public"."creator_groups" to "anon";

grant trigger on table "public"."creator_groups" to "anon";

grant truncate on table "public"."creator_groups" to "anon";

grant update on table "public"."creator_groups" to "anon";

grant delete on table "public"."creator_groups" to "authenticated";

grant insert on table "public"."creator_groups" to "authenticated";

grant references on table "public"."creator_groups" to "authenticated";

grant select on table "public"."creator_groups" to "authenticated";

grant trigger on table "public"."creator_groups" to "authenticated";

grant truncate on table "public"."creator_groups" to "authenticated";

grant update on table "public"."creator_groups" to "authenticated";

grant delete on table "public"."creator_groups" to "service_role";

grant insert on table "public"."creator_groups" to "service_role";

grant references on table "public"."creator_groups" to "service_role";

grant select on table "public"."creator_groups" to "service_role";

grant trigger on table "public"."creator_groups" to "service_role";

grant truncate on table "public"."creator_groups" to "service_role";

grant update on table "public"."creator_groups" to "service_role";


