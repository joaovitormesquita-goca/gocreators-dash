# Próximos passos — Issues planejadas

**Data:** 2026-03-15
**Repo:** `joaovitormesquita-goca/gocreators-dash`
**Total de issues:** 8

> **Para agentes/Claude Code:** As issues completas estão no GitHub. Para puxar a descrição de qualquer issue, use:
> ```bash
> gh issue view <número> --json title,body,labels,state
> ```
> Para listar todas: `gh issue list --state open --json number,title,url`

## Índice de issues

| # | Issue | Link |
|---|-------|------|
| 1 | Tela de gerenciamento de marcas com ad accounts | [#1](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/1) |
| 2 | Agendamento diário do ETL (antes das 6h) | [#2](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/2) |
| 3 | Tabela e tela de histórico de sincronização | [#3](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/3) |
| 4 | Nova tabela e ETL de gasto total diário por ad account | [#4](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/4) |
| 5 | Renomear dashboard de Creators para Tabela Mensal | [#5](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/5) |
| 6 | Visão Mensal com gráficos de gasto e share % | [#6](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/6) |
| 7 | Visão Diária com gráfico de gasto e share % | [#7](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/7) |
| 8 | Tela de dados individuais por creator (draft) | [#8](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/8) |

---

## Mapa de dependências

```
#1 Marcas/Ad Accounts ──────────────────────── (independente)

#2 Agendamento ETL ─────────┐
                             ├── complementares (#2 registra na tabela que #3 cria)
#3 Histórico de Sync ────────┘

#4 Gasto total por ad account ──┬── bloqueia
                                ├── #6 Visão Mensal
                                └── #7 Visão Diária

#5 Renomear para Tabela Mensal ─── (independente, fazer antes de #6/#7)

#8 Tela individual creator ──────── (draft, sem dependência)
```

## Trilhas paralelas

| Trilha | Issues | Ordem |
|--------|--------|-------|
| **A — Gestão** | #1 | Independente |
| **B — ETL/Sync** | #3 → #2 → #4 | #3 cria `sync_logs` e atualiza Edge Function, #2 agenda, #4 expande ETL |
| **C — Dashboards** | #5 → #6 → #7 | #5 reorganiza navegação, #6 e #7 dependem de #4 |

Trilhas A e B podem começar em paralelo. Trilha C começa com #5 (rápida) e depende de #4 (trilha B) para #6 e #7.

---

## Issues

### [#1](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/1) — Tela de gerenciamento de marcas com ad accounts

**Labels:** `frontend`, `backend`, `enhancement`
**Dependências:** nenhuma

**Contexto:** Marcas e ad accounts existem no banco mas não têm interface de gestão.

**Requisitos:**
- Página `/dashboard/brands`
- Listagem de marcas com expansão para ver ad accounts vinculadas (`meta_account_id`)
- CRUD de marcas: criar, editar, remover (dialog)
- CRUD de ad accounts dentro de cada marca: criar, editar, desvincular (inline ou dialog)
- Validação com Zod
- Server actions seguindo padrão de `/dashboard/creators/list`

**Referência:**
- UI: `CreateCreatorDialog`, `EditCreatorDialog`
- Server actions: `/app/dashboard/creators/list/actions.ts`
- Schemas: `supabase/schemas/brands.sql`, `supabase/schemas/ad_accounts.sql`

**Critérios de aceite:**
- [ ] Listar marcas com suas ad accounts
- [ ] Criar nova marca
- [ ] Editar marca existente
- [ ] Remover marca (com confirmação)
- [ ] Adicionar ad account a uma marca
- [ ] Editar ad account
- [ ] Remover ad account de uma marca

---

### [#2](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/2) — Agendamento diário do ETL (antes das 6h)

**Labels:** `etl`, `backend`, `enhancement`
**Dependências:** #3 (para registrar execuções no histórico)

**Contexto:** ETL roda apenas manualmente via botão de sync. Precisa rodar automaticamente todo dia antes das 6h BRT.

**Requisitos:**
- Configurar execução automática diária da Edge Function `sync-ad-metrics`
- Rodar antes das 6h (horário de Brasília)
- Opções de implementação: `pg_cron` no Supabase ou cron externo (GitHub Actions, Supabase scheduled functions)
- Falhas não devem bloquear execuções futuras
- Manter botão de sync manual funcionando em paralelo

**Critérios de aceite:**
- [ ] ETL roda automaticamente todo dia antes das 6h BRT
- [ ] Falhas são isoladas (não bloqueiam próxima execução)
- [ ] Sync manual continua funcionando

---

### [#3](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/3) — Tabela e tela de histórico de sincronização

**Labels:** `etl`, `frontend`, `backend`, `enhancement`
**Dependências:** nenhuma

**Contexto:** Não há registro das execuções do ETL. Precisamos de audit trail e tela dedicada.

**Requisitos:**

*Backend/Schema:*
- Nova tabela `sync_logs`:
  - `id` (uuid, PK)
  - `started_at` (timestamptz)
  - `finished_at` (timestamptz)
  - `status` (text: 'success', 'error', 'running')
  - `trigger` (text: 'manual', 'scheduled')
  - `creatives_upserted` (integer)
  - `metrics_upserted` (integer)
  - `unmatched_ads` (integer)
  - `error_message` (text, nullable)
- Declarar schema em `supabase/schemas/sync_logs.sql`
- Edge Function `sync-ad-metrics` deve registrar cada execução nessa tabela

*Frontend:*
- Página `/dashboard/sync`
- Listagem do histórico: data/hora, status (badge), duração, registros processados, ads não matchados
- Ordenação por data (mais recente primeiro)

**Critérios de aceite:**
- [ ] Schema `sync_logs` criado
- [ ] Edge Function registra execuções (sucesso e erro)
- [ ] Tela de histórico exibe logs com status e detalhes
- [ ] Sync manual e agendado são diferenciados no log

---

### [#4](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/4) — Nova tabela e ETL de gasto total diário por ad account

**Labels:** `etl`, `backend`, `enhancement`
**Dependências:** nenhuma (mas bloqueia #6 e #7)

**Contexto:** Para calcular o share % (gasto em creators / gasto total da marca), precisamos do gasto total de cada ad account por dia. Dado disponível no Metabase.

**Requisitos:**

*Schema:*
- Nova tabela `ad_account_daily_spend`:
  - `id` (uuid, PK)
  - `ad_account_id` (uuid, FK → ad_accounts)
  - `date` (date)
  - `spend` (numeric)
  - Constraint UNIQUE em `(ad_account_id, date)`
- Declarar schema em `supabase/schemas/ad_account_daily_spend.sql`

*ETL:*
- Adicionar query ao Metabase que puxa gasto total diário por conta de anúncio
- Upsert na tabela `ad_account_daily_spend` (idempotente, on conflict update)
- Incluir no fluxo da Edge Function `sync-ad-metrics` ou em function separada

**Critérios de aceite:**
- [ ] Schema criado e migration gerada
- [ ] ETL puxa e upserta gasto total diário por ad account
- [ ] Dados disponíveis para cálculo de share %

---

### [#5](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/5) — Renomear dashboard de Creators para Tabela Mensal

**Labels:** `frontend`, `enhancement`
**Dependências:** nenhuma (mas fazer antes de #6 e #7)

**Contexto:** O dashboard atual será uma das várias visões. Renomear para diferenciar das novas visões com gráficos.

**Requisitos:**
- Renomear título da página de "Creators" para "Tabela Mensal"
- Atualizar item no sidebar
- Reorganizar navegação para acomodar novas visões (Visão Mensal, Visão Diária)
- Ajustar rota conforme necessário

**Critérios de aceite:**
- [ ] Título e sidebar refletem "Tabela Mensal"
- [ ] Navegação organizada para acomodar futuras visões

---

### [#6](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/6) — Visão Mensal com gráficos de gasto e share %

**Labels:** `dashboard`, `frontend`, `backend`, `enhancement`
**Dependências:** #4 (gasto total por ad account), #5 (reorganização da navegação)

**Contexto:** Nova tela de dashboard com gráficos Recharts mostrando gasto em creators e share % por mês.

**Requisitos:**

*Filtros:*
- Filtro de marca (dropdown)
- Filtro de creators (multi-select, todas selecionadas por padrão, 1-n)

*Gráfico 1 — Gasto total em creators:*
- ComposedChart (Recharts) com Bar + Line
- Eixo X: mês
- Eixo Y esquerdo: gasto em creators (R$) — colunas
- Eixo Y direito: share % (gasto em creators / gasto total da marca no mês) — linha

*Gráfico 2 — Gasto em conteúdo recente de creators:*
- Mesmo formato do Gráfico 1
- Usa apenas gasto de anúncios com `created_time` no mês atual ou anterior

*Backend:*
- Server action/RPC que retorna dados agregados por mês:
  - Gasto total em creators (filtrado por creators selecionados)
  - Gasto total da marca (da tabela `ad_account_daily_spend`)
  - Gasto em conteúdo recente de creators

**Critérios de aceite:**
- [ ] Página com filtro de marca e multi-select de creators
- [ ] Gráfico 1: colunas de gasto + linha de share % por mês
- [ ] Gráfico 2: mesmo formato, filtrando por conteúdo recente
- [ ] Filtro de creators altera os valores dos gráficos
- [ ] Formatação em R$ e % correta

---

### [#7](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/7) — Visão Diária com gráfico de gasto e share %

**Labels:** `dashboard`, `frontend`, `backend`, `enhancement`
**Dependências:** #4 (gasto total por ad account), #5 (reorganização da navegação)

**Contexto:** Nova tela com gráfico de gasto diário em creators e share % em relação ao gasto total da empresa no dia.

**Requisitos:**

*Filtros:*
- Filtro de marca (dropdown)
- Filtro de creators (multi-select, todas selecionadas por padrão, 1-n)

*Gráfico:*
- ComposedChart (Recharts) com Bar + Line
- Eixo X: dia
- Eixo Y esquerdo: gasto diário em creators (R$) — colunas
- Eixo Y direito: share % (gasto em creators / gasto total da empresa no dia) — linha

*Backend:*
- Server action/RPC que retorna dados agregados por dia:
  - Gasto em creators no dia (filtrado por creators selecionados)
  - Gasto total da empresa no dia (da tabela `ad_account_daily_spend`)

**Critérios de aceite:**
- [ ] Página com filtro de marca e multi-select de creators
- [ ] Gráfico: colunas de gasto diário + linha de share %
- [ ] Filtro de creators altera os valores do gráfico
- [ ] Formatação em R$ e % correta

---

### [#8](https://github.com/joaovitormesquita-goca/gocreators-dash/issues/8) — Tela de dados individuais por creator (draft)

**Labels:** `dashboard`, `frontend`, `draft`
**Dependências:** nenhuma por agora

**Status:** 🟡 Draft — requisitos a serem elicitados.

**Ideias iniciais:**
- Página `/dashboard/creators/[id]`
- Métricas individuais do creator ao longo do tempo
- Performance por marca
- Gráficos de evolução

**Próximos passos:**
- Definir quais métricas e visualizações são prioritárias
- Detalhar requisitos antes de iniciar implementação
