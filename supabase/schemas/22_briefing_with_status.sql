create or replace view "public"."briefing_with_status" as
select
  b.*,
  coalesce(stats.total, 0)             as assignment_count,
  coalesce(stats.pendente, 0)          as pending_count,
  coalesce(stats.em_andamento, 0)      as in_progress_count,
  coalesce(stats.concluido, 0)         as completed_count,
  coalesce(stats.cancelado, 0)         as cancelled_count,
  case
    when coalesce(stats.total, 0) = 0                          then 'nao_alocada'
    when stats.cancelado = stats.total                         then 'cancelada'
    when stats.concluido = stats.total                         then 'concluida'
    when stats.concluido > 0 and stats.concluido < stats.total then 'parcialmente_concluida'
    when stats.em_andamento > 0                                then 'em_andamento'
    else 'pendente'
  end as aggregate_status
from public.briefings b
left join lateral (
  select
    count(*) as total,
    count(*) filter (where status = 'pendente')      as pendente,
    count(*) filter (where status = 'em_andamento')  as em_andamento,
    count(*) filter (where status = 'concluido')     as concluido,
    count(*) filter (where status = 'cancelado')     as cancelado
  from public.briefing_assignments where briefing_id = b.id
) stats on true;
