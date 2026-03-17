alter table "public"."sync_logs" drop constraint "sync_logs_trigger_check";

alter table "public"."sync_logs" add column "ad_account_id" integer;

alter table "public"."sync_logs" add column "date_from" date;

alter table "public"."sync_logs" add column "date_to" date;

alter table "public"."sync_logs" add constraint "sync_logs_ad_account_id_fkey" FOREIGN KEY (ad_account_id) REFERENCES public.ad_accounts(id) ON DELETE SET NULL not valid;

alter table "public"."sync_logs" validate constraint "sync_logs_ad_account_id_fkey";

alter table "public"."sync_logs" add constraint "sync_logs_trigger_check" CHECK ((trigger = ANY (ARRAY['manual'::text, 'scheduled'::text, 'backfill'::text]))) not valid;

alter table "public"."sync_logs" validate constraint "sync_logs_trigger_check";


