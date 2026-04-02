create table if not exists "public"."creatives" (
  "id" bigint generated always as identity not null,
  "creator_brand_id" bigint not null,
  "ad_account_id" bigint not null,
  "meta_ad_id" text not null,
  "created_time" timestamptz not null,
  "ad_name" text,
  "created_at" timestamptz not null default now(),

  constraint "creatives_pkey" primary key ("id"),
  constraint "creatives_meta_ad_id_key" unique ("meta_ad_id"),
  constraint "creatives_creator_brand_id_fkey" foreign key ("creator_brand_id") references "public"."creator_brands" ("id") on delete cascade,
  constraint "creatives_ad_account_id_fkey" foreign key ("ad_account_id") references "public"."ad_accounts" ("id") on delete cascade
);
