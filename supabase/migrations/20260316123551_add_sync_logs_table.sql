
  create table "public"."sync_logs" (
    "id" uuid not null default gen_random_uuid(),
    "started_at" timestamp with time zone not null default now(),
    "finished_at" timestamp with time zone,
    "status" text not null default 'running'::text,
    "trigger" text not null default 'manual'::text,
    "creatives_upserted" integer not null default 0,
    "metrics_upserted" integer not null default 0,
    "unmatched_ads" integer not null default 0,
    "error_message" text
      );


CREATE UNIQUE INDEX sync_logs_pkey ON public.sync_logs USING btree (id);

alter table "public"."sync_logs" add constraint "sync_logs_pkey" PRIMARY KEY using index "sync_logs_pkey";

alter table "public"."sync_logs" add constraint "sync_logs_status_check" CHECK ((status = ANY (ARRAY['running'::text, 'success'::text, 'error'::text]))) not valid;

alter table "public"."sync_logs" validate constraint "sync_logs_status_check";

alter table "public"."sync_logs" add constraint "sync_logs_trigger_check" CHECK ((trigger = ANY (ARRAY['manual'::text, 'scheduled'::text]))) not valid;

alter table "public"."sync_logs" validate constraint "sync_logs_trigger_check";

grant delete on table "public"."sync_logs" to "anon";

grant insert on table "public"."sync_logs" to "anon";

grant references on table "public"."sync_logs" to "anon";

grant select on table "public"."sync_logs" to "anon";

grant trigger on table "public"."sync_logs" to "anon";

grant truncate on table "public"."sync_logs" to "anon";

grant update on table "public"."sync_logs" to "anon";

grant delete on table "public"."sync_logs" to "authenticated";

grant insert on table "public"."sync_logs" to "authenticated";

grant references on table "public"."sync_logs" to "authenticated";

grant select on table "public"."sync_logs" to "authenticated";

grant trigger on table "public"."sync_logs" to "authenticated";

grant truncate on table "public"."sync_logs" to "authenticated";

grant update on table "public"."sync_logs" to "authenticated";

grant delete on table "public"."sync_logs" to "service_role";

grant insert on table "public"."sync_logs" to "service_role";

grant references on table "public"."sync_logs" to "service_role";

grant select on table "public"."sync_logs" to "service_role";

grant trigger on table "public"."sync_logs" to "service_role";

grant truncate on table "public"."sync_logs" to "service_role";

grant update on table "public"."sync_logs" to "service_role";


