
  create table "public"."briefing_assignments" (
    "id" bigint generated always as identity not null,
    "briefing_id" bigint not null,
    "creator_id" bigint not null,
    "variante" text,
    "status" text not null default 'pendente'::text,
    "delivered_url" text,
    "assigned_at" timestamp with time zone not null default now(),
    "assigned_by" uuid,
    "updated_at" timestamp with time zone not null default now(),
    "updated_by" uuid
      );



  create table "public"."briefings" (
    "id" bigint generated always as identity not null,
    "brand_id" bigint not null,
    "briefing_number" integer not null,
    "semana" integer,
    "mes" integer,
    "ano" integer,
    "ref_url" text,
    "take_inicial" text,
    "fala_inicial" text,
    "conceito" text,
    "produtos" text[] not null default '{}'::text[],
    "source" text not null default 'docs'::text,
    "source_doc_id" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now()
      );


CREATE UNIQUE INDEX briefing_assignments_briefing_creator_key ON public.briefing_assignments USING btree (briefing_id, creator_id);

CREATE INDEX briefing_assignments_creator_status_idx ON public.briefing_assignments USING btree (creator_id, status);

CREATE UNIQUE INDEX briefing_assignments_pkey ON public.briefing_assignments USING btree (id);

CREATE INDEX briefing_assignments_status_idx ON public.briefing_assignments USING btree (status);

CREATE UNIQUE INDEX briefings_brand_number_key ON public.briefings USING btree (brand_id, briefing_number);

CREATE INDEX briefings_brand_period_idx ON public.briefings USING btree (brand_id, ano, mes);

CREATE UNIQUE INDEX briefings_pkey ON public.briefings USING btree (id);

alter table "public"."briefing_assignments" add constraint "briefing_assignments_pkey" PRIMARY KEY using index "briefing_assignments_pkey";

alter table "public"."briefings" add constraint "briefings_pkey" PRIMARY KEY using index "briefings_pkey";

alter table "public"."briefing_assignments" add constraint "briefing_assignments_briefing_creator_key" UNIQUE using index "briefing_assignments_briefing_creator_key";

alter table "public"."briefing_assignments" add constraint "briefing_assignments_briefing_id_fkey" FOREIGN KEY (briefing_id) REFERENCES public.briefings(id) ON DELETE CASCADE not valid;

alter table "public"."briefing_assignments" validate constraint "briefing_assignments_briefing_id_fkey";

alter table "public"."briefing_assignments" add constraint "briefing_assignments_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public.creators(id) ON DELETE RESTRICT not valid;

alter table "public"."briefing_assignments" validate constraint "briefing_assignments_creator_id_fkey";

alter table "public"."briefing_assignments" add constraint "briefing_assignments_status_check" CHECK ((status = ANY (ARRAY['pendente'::text, 'em_andamento'::text, 'concluido'::text, 'cancelado'::text]))) not valid;

alter table "public"."briefing_assignments" validate constraint "briefing_assignments_status_check";

alter table "public"."briefings" add constraint "briefings_brand_id_fkey" FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE not valid;

alter table "public"."briefings" validate constraint "briefings_brand_id_fkey";

alter table "public"."briefings" add constraint "briefings_brand_number_key" UNIQUE using index "briefings_brand_number_key";

alter table "public"."briefings" add constraint "briefings_mes_check" CHECK (((mes IS NULL) OR ((mes >= 1) AND (mes <= 12)))) not valid;

alter table "public"."briefings" validate constraint "briefings_mes_check";

alter table "public"."briefings" add constraint "briefings_source_check" CHECK ((source = ANY (ARRAY['docs'::text, 'native'::text]))) not valid;

alter table "public"."briefings" validate constraint "briefings_source_check";

create or replace view "public"."briefing_with_status" as  SELECT b.id,
    b.brand_id,
    b.briefing_number,
    b.semana,
    b.mes,
    b.ano,
    b.ref_url,
    b.take_inicial,
    b.fala_inicial,
    b.conceito,
    b.produtos,
    b.source,
    b.source_doc_id,
    b.created_at,
    b.updated_at,
    COALESCE(stats.total, (0)::bigint) AS assignment_count,
    COALESCE(stats.pendente, (0)::bigint) AS pending_count,
    COALESCE(stats.em_andamento, (0)::bigint) AS in_progress_count,
    COALESCE(stats.concluido, (0)::bigint) AS completed_count,
    COALESCE(stats.cancelado, (0)::bigint) AS cancelled_count,
        CASE
            WHEN (COALESCE(stats.total, (0)::bigint) = 0) THEN 'nao_alocada'::text
            WHEN (stats.cancelado = stats.total) THEN 'cancelada'::text
            WHEN (stats.concluido = stats.total) THEN 'concluida'::text
            WHEN ((stats.concluido > 0) AND (stats.concluido < stats.total)) THEN 'parcialmente_concluida'::text
            WHEN (stats.em_andamento > 0) THEN 'em_andamento'::text
            ELSE 'pendente'::text
        END AS aggregate_status
   FROM (public.briefings b
     LEFT JOIN LATERAL ( SELECT count(*) AS total,
            count(*) FILTER (WHERE (briefing_assignments.status = 'pendente'::text)) AS pendente,
            count(*) FILTER (WHERE (briefing_assignments.status = 'em_andamento'::text)) AS em_andamento,
            count(*) FILTER (WHERE (briefing_assignments.status = 'concluido'::text)) AS concluido,
            count(*) FILTER (WHERE (briefing_assignments.status = 'cancelado'::text)) AS cancelado
           FROM public.briefing_assignments
          WHERE (briefing_assignments.briefing_id = b.id)) stats ON (true));


grant delete on table "public"."briefing_assignments" to "anon";

grant insert on table "public"."briefing_assignments" to "anon";

grant references on table "public"."briefing_assignments" to "anon";

grant select on table "public"."briefing_assignments" to "anon";

grant trigger on table "public"."briefing_assignments" to "anon";

grant truncate on table "public"."briefing_assignments" to "anon";

grant update on table "public"."briefing_assignments" to "anon";

grant delete on table "public"."briefing_assignments" to "authenticated";

grant insert on table "public"."briefing_assignments" to "authenticated";

grant references on table "public"."briefing_assignments" to "authenticated";

grant select on table "public"."briefing_assignments" to "authenticated";

grant trigger on table "public"."briefing_assignments" to "authenticated";

grant truncate on table "public"."briefing_assignments" to "authenticated";

grant update on table "public"."briefing_assignments" to "authenticated";

grant delete on table "public"."briefing_assignments" to "service_role";

grant insert on table "public"."briefing_assignments" to "service_role";

grant references on table "public"."briefing_assignments" to "service_role";

grant select on table "public"."briefing_assignments" to "service_role";

grant trigger on table "public"."briefing_assignments" to "service_role";

grant truncate on table "public"."briefing_assignments" to "service_role";

grant update on table "public"."briefing_assignments" to "service_role";

grant delete on table "public"."briefings" to "anon";

grant insert on table "public"."briefings" to "anon";

grant references on table "public"."briefings" to "anon";

grant select on table "public"."briefings" to "anon";

grant trigger on table "public"."briefings" to "anon";

grant truncate on table "public"."briefings" to "anon";

grant update on table "public"."briefings" to "anon";

grant delete on table "public"."briefings" to "authenticated";

grant insert on table "public"."briefings" to "authenticated";

grant references on table "public"."briefings" to "authenticated";

grant select on table "public"."briefings" to "authenticated";

grant trigger on table "public"."briefings" to "authenticated";

grant truncate on table "public"."briefings" to "authenticated";

grant update on table "public"."briefings" to "authenticated";

grant delete on table "public"."briefings" to "service_role";

grant insert on table "public"."briefings" to "service_role";

grant references on table "public"."briefings" to "service_role";

grant select on table "public"."briefings" to "service_role";

grant trigger on table "public"."briefings" to "service_role";

grant truncate on table "public"."briefings" to "service_role";

grant update on table "public"."briefings" to "service_role";


