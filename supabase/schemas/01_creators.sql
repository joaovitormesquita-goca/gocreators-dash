create table if not exists "public"."creators" (
  "id" bigint generated always as identity not null,
  "full_name" text not null,
  "email" text,
  "created_at" timestamptz not null default now(),

  constraint "creators_pkey" primary key ("id")
);
