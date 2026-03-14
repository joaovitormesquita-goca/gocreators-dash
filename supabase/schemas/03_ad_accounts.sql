create table if not exists "public"."ad_accounts" (
  "id" bigint generated always as identity not null,
  "brand_id" bigint not null,
  "name" text not null,
  "meta_account_id" text not null,
  "created_at" timestamptz not null default now(),

  constraint "ad_accounts_pkey" primary key ("id"),
  constraint "ad_accounts_brand_id_fkey" foreign key ("brand_id") references "public"."brands" ("id") on delete cascade
);
