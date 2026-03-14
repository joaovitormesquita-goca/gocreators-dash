# Elicitação — Plataforma de gerenciamento de UGC Creators (Meta Ads)

**Tipo:** Uso interno  
**Time:** Pequeno  
**Stack principal:** Next.js 14 + Supabase

---

## Visão geral

Plataforma interna para gestores de tráfego e acompanhadores de creators monitorarem a performance de criativos UGC vinculados a múltiplas marcas/contas de anúncio no Meta Ads. Os dados são originados de um banco existente de Facebook Ads consultado via Metabase API.

---

## Usuários

Dois perfis operacionais, ambos com as mesmas permissões na plataforma:

- **Gestores de tráfego** — responsáveis pela operação de mídia
- **Acompanhadores de creators** — trabalham ao lado do gestor monitorando os creators

Não há diferenciação de acesso entre perfis. Todos os usuários autenticados visualizam os dados de todas as marcas — o grupo opera com transparência total entre as empresas.

---

## Métricas

Três métricas exibidas no MVP, calculadas a partir de quatro valores brutos armazenados:

| Métrica exibida | Fórmula | Campos no banco |
|---|---|---|
| **Valor gasto** | — | `spend` |
| **ROAS** | `revenue / spend` | `revenue`, `spend` |
| **CTR** | `link_clicks / impressions` | `link_clicks`, `impressions` |

Guardar os valores brutos permite recalcular métricas derivadas na query e facilita a adição de novas métricas no futuro sem alteração de schema.

---

## Visão dupla: total vs. recentes

Para cada métrica existem dois recortes obrigatórios:

- **Total** — acumulado de todos os anúncios do creator para aquela marca
- **Recentes** — apenas anúncios cuja data de criação (`created_time`) seja do mês atual ou do mês anterior

A definição de "recente" é baseada na **data de criação do anúncio**, não na data de veiculação.

### Exemplo de visualização

| Creator | Gasto total | Gasto recentes | ROAS total | ROAS recentes | CTR total | CTR recentes |
|---|---|---|---|---|---|---|
| Fulana Silva | R$ 18.400 | R$ 6.200 | 3,8× | 4,1× | 1,9% | 2,3% |
| Ciclano Costa | R$ 11.200 | R$ 4.800 | 2,9× | 3,5× | 1,4% | 1,8% |

---

## Telas

### Tabela principal
Uma linha por creator. Filtro de marca/empresa no topo — ao selecionar uma marca, as métricas exibidas são apenas daquela marca. Sem filtro, exibe o consolidado global. Todas as colunas são ordenáveis. Sem score ou ranking automático no MVP.

### Tela do creator
Detalhe de um creator específico. Exibe os dados globais e um breakdown das métricas por marca. Sem listagem de criativos individuais no MVP.

---

## Arquitetura e stack

### Ponto de partida
Usar o template oficial `with-supabase` do Next.js, que já entrega auth completamente configurada para o App Router:

```bash
npx create-next-app -e with-supabase
```

O template já inclui Supabase Auth com cookies, middleware de proteção de rotas e helpers de servidor/cliente prontos para uso.

### Camada 1 — Frontend
- Next.js 14 com App Router
- Tailwind CSS + shadcn/ui
- Recharts ou Chart.js para visualizações

### Camada 2 — Backend / BFF
- Next.js Server Actions + API Routes
- Supabase Auth (via template `with-supabase`) — perfil único, sem diferenciação de papéis
- Lógica de negócio e queries isoladas em funções reutilizáveis, desacopladas da camada de apresentação

### Camada 3 — Dados
- **Supabase** (PostgreSQL) como banco principal da plataforma
- Sem Row Level Security por perfil — todos os usuários autenticados têm acesso total
- Supabase Storage (criativos) e Edge Functions

### Camada 4 — Pipeline de dados (ETL)
- Job agendado que consulta a Metabase API e alimenta o Supabase
- Deve ser **idempotente** — re-execuções não duplicam dados
- Campo `created_time` de cada anúncio deve ser importado e nunca sobrescrito em re-sincronizações
- O vínculo entre anúncio e creator é feito por match entre o nome do anúncio e os handles cadastrados em `creator_brands`
- Log de sincronização com alertas de falha via email ou Slack

### Integrações externas
- **Meta Ads DB** — banco existente acessado via Metabase API (origem dos dados)
- **Notificações** — alertas de falha no ETL via email/Slack

---

## Modelo de dados

### `creators`
Entidade raiz de cada creator. Identificado pelo nome completo no MVP, com email opcional para facilitar migração futura.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid | chave primária |
| `full_name` | text | identificador principal no MVP |
| `email` | text | opcional — para migração futura |
| `created_at` | timestamp | |

### `brands`
Cadastradas manualmente pela plataforma.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid | chave primária |
| `name` | text | |
| `created_at` | timestamp | |

### `ad_accounts`
Cada marca pode ter múltiplas ad_accounts (1:N). Cadastradas manualmente pela plataforma. O campo `meta_account_id` é usado pelo ETL para fazer o match com os dados vindos do Metabase.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid | chave primária |
| `brand_id` | uuid | FK → brands |
| `name` | text | |
| `meta_account_id` | text | identificador da conta no Meta |
| `created_at` | timestamp | |

### `creator_brands`
Mapeamento explícito entre creators e marcas. Registra o ciclo de vida do relacionamento e os handles usados pelo creator naquela marca.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid | chave primária |
| `creator_id` | uuid | FK → creators |
| `brand_id` | uuid | FK → brands |
| `handles` | text[] | array de @handles usados pelo creator nessa marca |
| `start_date` | date | início do relacionamento |
| `end_date` | date | fim do relacionamento (null = ativo) |
| `created_at` | timestamp | |

O ETL usa `handles` para vincular anúncios ao creator correto — faz match entre o nome do anúncio e qualquer handle do array.

### `creatives`
Um registro por anúncio importado do Meta. O `created_time` é o pivô da lógica de recentes e nunca deve ser sobrescrito.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid | chave primária |
| `creator_brand_id` | uuid | FK → creator_brands |
| `ad_account_id` | uuid | FK → ad_accounts |
| `meta_ad_id` | text | identificador do anúncio no Meta |
| `created_time` | timestamp | data de criação no Meta — nunca sobrescrever |
| `created_at` | timestamp | data de importação no Supabase |

### `ad_metrics`
Métricas diárias por criativo. Valores brutos para permitir recálculo de ROAS e CTR.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid | chave primária |
| `creative_id` | uuid | FK → creatives |
| `date` | date | data de referência das métricas |
| `spend` | numeric | valor gasto |
| `revenue` | numeric | receita gerada |
| `link_clicks` | integer | cliques no link |
| `impressions` | integer | impressões |
| `created_at` | timestamp | |

### `users`
Espelha os usuários do Supabase Auth. Todos têm as mesmas permissões.

| Campo | Tipo | Observação |
|---|---|---|
| `id` | uuid | chave primária (espelha Supabase Auth) |
| `email` | text | |
| `full_name` | text | |
| `created_at` | timestamp | |

---

## Requisitos não funcionais

- Pipeline ETL idempotente com retry automático em falhas de conexão com a Metabase API
- `created_time` em `creatives` nunca sobrescrito em re-sincronizações
- Match de anúncios por handle deve ser case-insensitive e tolerante a variações de formatação
- Autenticação obrigatória, todos os usuários com acesso total
- Sistema não precisa escalar para grande volume de usuários simultâneos
- Lógica de negócio desacoplada da apresentação para facilitar exposição futura via API

---

## Próximos passos

1. Iniciar projeto com `npx create-next-app -e with-supabase`
2. Mapear os campos disponíveis na Metabase API (`created_time`, `spend`, `revenue`, `link_clicks`, `impressions`)
3. Validar a lógica de match por handle com exemplos reais de nomes de anúncios
4. Criar migrations do schema no Supabase
5. Implementar ETL básico conectando na Metabase API
6. Prototipar o dashboard principal com a tabela ordenável e o filtro de marca

---

## Fora do escopo do MVP

- Listagem de criativos individuais na tela do creator
- Score ou ranking automático de creators
- API pública para integração com plataforma externa de dados (decisão futura)
