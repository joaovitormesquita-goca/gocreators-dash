create table if not exists "public"."ad_account_daily_spend" (
  "id" bigint generated always as identity not null,
  "ad_account_id" bigint not null,
  "date" date not null,
  "spend" numeric not null default 0,
  "created_at" timestamptz not null default now(),

  constraint "ad_account_daily_spend_pkey" primary key ("id"),
  constraint "ad_account_daily_spend_ad_account_id_date_key" unique ("ad_account_id", "date"),
  constraint "ad_account_daily_spend_ad_account_id_fkey" foreign key ("ad_account_id") references "public"."ad_accounts" ("id") on delete cascade
);
