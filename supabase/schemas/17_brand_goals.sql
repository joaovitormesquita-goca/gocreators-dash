-- supabase/schemas/17_brand_goals.sql
create table if not exists "public"."brand_goals" (
  "id" uuid not null default gen_random_uuid(),
  "brand_id" bigint not null,
  "metric" text not null,
  "month" date not null,
  "value" numeric not null,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),

  constraint "brand_goals_pkey" primary key ("id"),
  constraint "brand_goals_brand_id_fkey" foreign key ("brand_id") references "public"."brands"("id") on delete cascade,
  constraint "brand_goals_metric_check" check ("metric" in ('share_total', 'share_recent')),
  constraint "brand_goals_value_check" check ("value" >= 0 and "value" <= 100),
  constraint "brand_goals_brand_id_metric_month_key" unique ("brand_id", "metric", "month")
);
