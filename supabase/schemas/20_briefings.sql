create table if not exists "public"."briefings" (
  "id" bigint generated always as identity not null,
  "brand_id" bigint not null,
  "briefing_number" integer not null,
  "semana" integer,
  "mes" integer,
  "ano" integer,
  "ref_url" text,
  "take_inicial" text,
  "fala_inicial" text,
  "headline" text,
  "construcao" text,
  "tempo_video" text,
  "produtos" text[] not null default '{}',
  "source" text not null default 'docs',
  "source_doc_id" text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),

  constraint "briefings_pkey" primary key ("id"),
  constraint "briefings_brand_number_key" unique ("brand_id", "briefing_number"),
  constraint "briefings_brand_id_fkey" foreign key ("brand_id")
    references "public"."brands" ("id") on delete cascade,
  constraint "briefings_source_check" check (source in ('docs', 'native')),
  constraint "briefings_mes_check" check (mes is null or (mes between 1 and 12))
);

create index if not exists "briefings_brand_period_idx"
  on "public"."briefings" ("brand_id", "ano", "mes");
