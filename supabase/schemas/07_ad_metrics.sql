create table if not exists "public"."ad_metrics" (
  "id" bigint generated always as identity not null,
  "creative_id" bigint not null,
  "date" date not null,
  "spend" numeric not null default 0,
  "revenue" numeric not null default 0,
  "link_clicks" integer not null default 0,
  "impressions" integer not null default 0,
  "created_at" timestamptz not null default now(),

  constraint "ad_metrics_pkey" primary key ("id"),
  constraint "ad_metrics_creative_id_date_key" unique ("creative_id", "date"),
  constraint "ad_metrics_creative_id_fkey" foreign key ("creative_id") references "public"."creatives" ("id") on delete cascade
);
