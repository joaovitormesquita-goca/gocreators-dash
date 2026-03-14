create table if not exists "public"."creator_brands" (
  "id" bigint generated always as identity not null,
  "creator_id" bigint not null,
  "brand_id" bigint not null,
  "handles" text[] not null default '{}',
  "start_date" date not null,
  "end_date" date,
  "created_at" timestamptz not null default now(),

  constraint "creator_brands_pkey" primary key ("id"),
  constraint "creator_brands_creator_id_fkey" foreign key ("creator_id") references "public"."creators" ("id") on delete cascade,
  constraint "creator_brands_brand_id_fkey" foreign key ("brand_id") references "public"."brands" ("id") on delete cascade
);
