create table if not exists "public"."sync_logs" (
  "id" uuid primary key default gen_random_uuid(),
  "started_at" timestamptz not null default now(),
  "finished_at" timestamptz,
  "status" text not null default 'running'
    check ("status" in ('running', 'success', 'error')),
  "trigger" text not null default 'manual'
    check ("trigger" in ('manual', 'scheduled', 'backfill')),
  "creatives_upserted" integer not null default 0,
  "metrics_upserted" integer not null default 0,
  "unmatched_ads" integer not null default 0,
  "error_message" text,
  "account_spend_upserted" integer not null default 0,
  "ad_account_id" integer references "public"."ad_accounts"("id") on delete set null,
  "date_from" date,
  "date_to" date
);
