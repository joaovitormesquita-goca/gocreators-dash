# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

Plataforma interna para gestores de tráfego e acompanhadores de creators monitorarem a performance de criativos UGC vinculados a múltiplas marcas/contas de anúncio no Meta Ads. Dados originados de um banco existente de Facebook Ads consultado via Metabase API.

## Stack

- **Framework:** Next.js 14 com App Router (template `with-supabase`)
- **UI:** Tailwind CSS + shadcn/ui
- **Gráficos:** Recharts
- **Backend:** Next.js Server Actions + API Routes
- **Auth:** Supabase Auth — perfil único, sem diferenciação de papéis (todos os usuários autenticados têm acesso total)
- **Banco:** Supabase (PostgreSQL) — sem Row Level Security por perfil
- **ETL:** Job agendado que consulta Metabase API e alimenta o Supabase

## Comandos

```bash
# Setup inicial
npx create-next-app -e with-supabase

# Dev
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## Arquitetura

### Camadas

1. **Frontend** — Next.js App Router, componentes shadcn/ui, tabelas ordenáveis e filtros por marca
2. **Backend/BFF** — Server Actions e API Routes com lógica de negócio desacoplada da apresentação
3. **Dados** — Supabase PostgreSQL, Storage (criativos), Edge Functions
4. **ETL** — Pipeline idempotente Metabase API → Supabase, com log de sincronização e alertas

### Modelo de dados

Entidades principais: `creators`, `brands`, `ad_accounts`, `creator_brands`, `creatives`, `ad_metrics`, `users`.

- `creator_brands.handles` (text[]) — array de @handles usados pelo creator naquela marca; o ETL faz match case-insensitive entre nome do anúncio e handles
- `creatives.created_time` — data de criação no Meta, **nunca sobrescrever** em re-sincronizações
- `ad_metrics` armazena valores brutos (`spend`, `revenue`, `link_clicks`, `impressions`) para recálculo de métricas derivadas (ROAS = revenue/spend, CTR = link_clicks/impressions)

### Visão "total" vs "recentes"

Cada métrica tem dois recortes: **total** (acumulado) e **recentes** (anúncios criados no mês atual ou anterior, baseado em `created_time`).

## Regras de negócio importantes

- ETL deve ser **idempotente** — re-execuções não duplicam dados
- Match de anúncios por handle: case-insensitive, tolerante a variações de formatação
- Sem score ou ranking automático no MVP
- Sem listagem de criativos individuais na tela do creator no MVP

## Supabase — Declarative Schemas

Gerenciamento do banco usa **declarative schemas** — nunca criar migration files manualmente.

### Fluxo

1. Declarar o estado desejado em arquivos `.sql` dentro de `supabase/schemas/`
2. Gerar migration automaticamente: `supabase db diff -f <nome>`
3. Aplicar localmente: `supabase migration up`
4. Deploy em produção: `supabase db push`

### Estrutura

```
supabase/
├── schemas/        # Estado declarado (editamos aqui)
│   ├── creators.sql
│   ├── brands.sql
│   ├── ad_accounts.sql
│   ├── creator_brands.sql
│   ├── creatives.sql
│   └── ad_metrics.sql
└── migrations/     # Gerado automaticamente — não editar manualmente
```

### Limitações do diff

Não rastreados pelo `supabase db diff`: DML (INSERT/UPDATE/DELETE), RLS policies, comments, materialized views, partitions. Como o projeto não usa RLS por perfil, isso não impacta o MVP.

### Regras

- Sempre adicionar novas colunas ao final das tabelas para evitar diffs confusos
- Nunca resetar uma versão já deployada em produção — reverter via novo schema + novo diff
- Configurar ordem de execução em `config.toml` via `[db.migrations] schema_paths` quando houver dependências entre tabelas

## Linguagem

O código e commits devem ser em **inglês**. A documentação do projeto e comunicação são em **português (BR)**.
