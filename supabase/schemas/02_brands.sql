create table if not exists "public"."brands" (
  "id" bigint generated always as identity not null,
  "name" text not null,
  "created_at" timestamptz not null default now(),

  constraint "brands_pkey" primary key ("id")
);
