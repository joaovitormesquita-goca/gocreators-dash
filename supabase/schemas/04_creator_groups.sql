create table if not exists "public"."creator_groups" (
  "id" bigint generated always as identity not null,
  "brand_id" bigint not null,
  "name" text not null,
  "created_at" timestamptz not null default now(),

  constraint "creator_groups_pkey" primary key ("id"),
  constraint "creator_groups_brand_id_fkey" foreign key ("brand_id")
    references "public"."brands" ("id") on delete cascade,
  constraint "creator_groups_brand_id_name_key" unique ("brand_id", "name")
);
