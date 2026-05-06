create table if not exists "public"."briefing_assignments" (
  "id" bigint generated always as identity not null,
  "briefing_id" bigint not null,
  "creator_id" bigint not null,
  "variante" text,
  "status" text not null default 'pendente',
  "delivered_url" text,
  "assigned_at" timestamptz not null default now(),
  "assigned_by" uuid,
  "updated_at" timestamptz not null default now(),
  "updated_by" uuid,

  constraint "briefing_assignments_pkey" primary key ("id"),
  constraint "briefing_assignments_briefing_creator_key" unique ("briefing_id", "creator_id"),
  constraint "briefing_assignments_briefing_id_fkey" foreign key ("briefing_id")
    references "public"."briefings" ("id") on delete cascade,
  constraint "briefing_assignments_creator_id_fkey" foreign key ("creator_id")
    references "public"."creators" ("id") on delete restrict,
  constraint "briefing_assignments_status_check"
    check (status in ('pendente', 'em_andamento', 'concluido', 'cancelado'))
);

create index if not exists "briefing_assignments_creator_status_idx"
  on "public"."briefing_assignments" ("creator_id", "status");

create index if not exists "briefing_assignments_status_idx"
  on "public"."briefing_assignments" ("status");
