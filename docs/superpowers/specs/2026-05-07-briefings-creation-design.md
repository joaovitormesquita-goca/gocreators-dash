# Briefings — Criação Nativa & Split de Páginas

**Data:** 2026-05-07
**Status:** Approved (brainstorming)
**Autor:** GoCreators team + Claude
**Spec anterior relacionado:** [2026-05-06-gestao-pautas-design.md](2026-05-06-gestao-pautas-design.md)

## Contexto

A primeira fase (PR #45) entregou:
- Tabela `briefings`, `briefing_assignments`, view `briefing_with_status`
- Edge Function `ingest-briefing` (Docs → Supabase via Apps Script)
- Página `/dashboard/briefings` (gestão de alocação + status)

O time decidiu (após análise interna) que pautas devem **também** ser criáveis na própria dashboard, não só sincronizadas do Docs. Motivações:
- Edição rápida sem precisar abrir Docs
- Onboarding de novos membros sem ter que aprender Docs+Apps Script
- Caminho pra eventualmente abandonar o Docs (não obrigatório agora)

## Objetivo

Adicionar criação/edição/exclusão nativa de pautas na dashboard, separando claramente as responsabilidades:

- **`/dashboard/briefings`** — criação editorial (pauta como conteúdo)
- **`/dashboard/alocacao`** — gestão operacional (alocação + status)

## Restrição

PR #45 ainda está aberto e validado pelo time. **Esta nova feature deve ser bundled no mesmo PR** (extensão do escopo) ou ser um PR follow-up encadeado, mas o usuário decide. Por padrão, assumir same PR (mais simples pra revisar mudanças relacionadas juntas).

## Decisões consolidadas (do brainstorming)

| ID | Decisão | Escolha |
|---|---|---|
| 1 | Schema fields | Rename `conceito` → `construcao`, adicionar `headline` e `tempo_video` |
| 2 | Pauta number na criação | Auto-sugerido (`MAX(briefing_number)+1` da brand), editável |
| 3 | Layout da lista | Cards Notion-style, grid responsivo |
| 4 | Layout do form | Tabela mirror do Docs (label esquerda, valor direita), textareas auto-expansivas |
| D1 | Roteamento | `/dashboard/briefings` = NOVA (criação), `/dashboard/alocacao` = renomeada (gestão) |
| D2 | Edit/delete pra pautas Docs-sourced | Dashboard edita/deleta qualquer; badge informativo `docs`/`nativa`; edits sobrescritos no próximo Docs sync |
| D3 | Save behavior | Explícito (botão + Cmd/Ctrl+S); confirmação ao sair com mudanças não salvas; sem auto-save |
| D4 | Estilo visual | shadcn/ui + Tailwind v4 mantidos; polimento de tipografia, espaçamento, animações sutis |

## 1. Modelo de dados — alterações ao `briefings`

### `supabase/schemas/20_briefings.sql` (atualizado)

```sql
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
  "headline" text,                            -- NOVO
  "construcao" text,                          -- RENAME de conceito
  "tempo_video" text,                         -- NOVO
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
```

**Mudanças vs schema anterior:**
- ❌ `conceito` REMOVIDO
- ✅ `construcao text` ADICIONADO (substitui `conceito`)
- ✅ `headline text` NOVO
- ✅ `tempo_video text` NOVO

### Migration

`supabase db diff -f rename_conceito_add_briefing_fields` deve gerar:

```sql
ALTER TABLE public.briefings
  ADD COLUMN headline text,
  ADD COLUMN construcao text,
  ADD COLUMN tempo_video text;

UPDATE public.briefings SET construcao = conceito WHERE conceito IS NOT NULL;

ALTER TABLE public.briefings DROP COLUMN conceito;
```

(O CLI pode gerar diferente — auditar o output. Em produção, como rolamos back, o estado é "fresh apply": gerar nova migration consolidada com schema atualizado.)

### Edge Function `ingest-briefing` — atualização

`supabase/functions/ingest-briefing/types.ts`:
- Substituir `conceito?: string | null` por `construcao?: string | null`
- Adicionar `headline?: string | null` e `tempo_video?: string | null`

`supabase/functions/ingest-briefing/index.ts` — `toRow()`:
- Trocar `conceito: b.conceito ?? null` por `construcao: b.construcao ?? null`
- Adicionar `headline: b.headline ?? null` e `tempo_video: b.tempo_video ?? null`

### Apps Script template — atualização

`scripts/sync-briefings-gocreators.gs` — atualizar comentário JSDoc do `extractBriefingsFromDoc_` pra refletir o shape novo. Lógica de parsing (a ser colada pelo user) precisa retornar:

```javascript
{
  briefing_number: number,
  semana, mes, ano: number | null,
  ref_url, take_inicial, fala_inicial: string | null,
  headline: string | null,                 // NOVO
  construcao: string | null,               // antes era conceito
  tempo_video: string | null,              // NOVO
  produtos: string[]
}
```

### Backfill script — atualização

`scripts/backfill-briefings.ts`:
- Coluna CSV "Conceito" (se existir) mapeia pra `construcao`
- Headline e tempo_video, se existirem como colunas, mapeiam direto. Se não, ficam null.

### Lib schemas — atualização

`lib/schemas/briefing.ts`:
- `Briefing` type: substituir `conceito` por `construcao`, adicionar `headline` e `tempo_video`
- `BriefingWithStatus`: idem (extends Briefing)
- Adicionar Zod schemas pra criar/editar (próxima seção)

## 2. Roteamento

### Mover existente
- `app/dashboard/briefings/{page,actions,loading}.tsx` → `app/dashboard/alocacao/{page,actions,loading}.tsx`
- Atualizar imports relativos (e.g., `@/app/dashboard/briefings/actions` → `@/app/dashboard/alocacao/actions`)
- Componentes em `components/briefing-management-table.tsx`, `briefing-detail-sheet.tsx`, etc. — manter prefixo `briefing-` (são do mesmo domínio); só atualizar imports do `actions` interno.

### Novo
- `app/dashboard/briefings/page.tsx` — lista de cards
- `app/dashboard/briefings/loading.tsx`
- `app/dashboard/briefings/actions.ts` — CRUD de briefings
- `app/dashboard/briefings/new/page.tsx` — form de criação
- `app/dashboard/briefings/[id]/page.tsx` — form de edição (server component que carrega + renderiza form com dados)

### Sidebar (`components/app-sidebar.tsx`)

```typescript
{
  label: "Gestão",
  items: [
    { title: "Briefings",            href: "/dashboard/briefings",  icon: FileText },
    { title: "Alocação de Pautas",   href: "/dashboard/alocacao",   icon: ScrollText },
    { title: "Gerenciar Creators",   href: "/dashboard/creators/list", icon: UserPlus },
    { title: "Marcas",                href: "/dashboard/brands",      icon: Building2 },
    { title: "Central de Custos",     href: "/dashboard/costs",       icon: DollarSign },
    { title: "Sincronização",         href: "/dashboard/sync",        icon: History },
  ],
}
```

(Ícone `FileText` pra Briefings, `ScrollText` continua pra Alocação. Imports da `lucide-react`.)

## 3. Página de listagem `/dashboard/briefings`

### Estrutura

```
┌──────────────────────────────────────────────────────────────┐
│ Briefings                                  [+ Nova pauta]     │
│ [Brand: Apice ▾]  [Mês: 5/2026 ▾]  [🔎 Buscar...]            │
├──────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│ │ 1297    │ │ 1298    │ │ 1303    │ │ 1322    │              │
│ │ headline│ │ headline│ │ headline│ │ headline│              │
│ │ truncada│ │ truncada│ │ truncada│ │ truncada│              │
│ │ • Livre │ │ • Livre │ │ • Nutri │ │ • Livre │              │
│ │ Pendente│ │ —       │ │ —       │ │ Concluí │              │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│ ┌─────────┐ ...                                               │
└──────────────────────────────────────────────────────────────┘
```

### Comportamento

- **Brand selector** padrão: primeira brand. Search params (`?brand=2`).
- **Filtro Mês**: padrão mês atual. Search param `?mes=5&ano=2026`.
- **Search box**: filtra por `briefing_number` (se numérico) ou ILIKE em `headline`/`take_inicial`/`fala_inicial` (se texto).
- **Botão "+ Nova pauta"** → navega pra `/dashboard/briefings/new`.
- **Click no card** → navega pra `/dashboard/briefings/[id]` (edit).
- **Sem alocação visível na card** — esse é o domínio da página de Alocação. Mostra apenas um badge agregado pequeno (ou nenhum, se ainda não alocada). Decisão: mostrar badge agregado pequeno pra dar contexto, mas sem destaque.

### Card design

Cada card mostra:
- **Número** (header destacado: `PAUTA 1297`)
- **Headline** (texto grande, 2 linhas truncadas)
- **Take inicial** (texto pequeno secundário, 1 linha truncada)
- **Produto** (badge pequeno)
- **Source** (badge pequeno: `Docs` ou `Nativa`)
- **Aggregate status** (badge pequeno se houver alocação)
- **Sem/Mês** (footer pequeno)

Hover: sutil shadow lift + border accent. Click: navega.

### Componente

`components/briefing-content-card.tsx` — recebe `BriefingWithStatus` e renderiza o card.
`components/briefings-grid.tsx` — recebe array de briefings + filtros, renderiza grid responsivo (1 col mobile / 2 cols tablet / 3-4 cols desktop).

## 4. Form de criação/edição (`/dashboard/briefings/new` e `/dashboard/briefings/[id]`)

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ← Briefings                                  [Salvar (⌘S)]  │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    PAUTA 1322                           │  │
│  ├────────────┬────────────────────────────────────────────┤  │
│  │ Fala       │ "O que você tá fazendo?" "Finalizando..."  │  │
│  │ inicial    │                                             │  │
│  ├────────────┼────────────────────────────────────────────┤  │
│  │ Take       │ Personagem 1 tentando finalizar cabelo     │  │
│  │ inicial    │ e personagem 2 assistindo chocada          │  │
│  ├────────────┼────────────────────────────────────────────┤  │
│  │ Headline   │ POV: você acha que sabe como finalizar...  │  │
│  ├────────────┼────────────────────────────────────────────┤  │
│  │ Construção │ - A ideia é uma espécie de teatrinho...    │  │
│  │            │ - A personagem 1 segue as instruções...    │  │
│  │            │ - Crie uma headline que chame atenção      │  │
│  ├────────────┼────────────────────────────────────────────┤  │
│  │ Referência │ https://www.instagram.com/reel/DV9tGZRj... │  │
│  ├────────────┼────────────────────────────────────────────┤  │
│  │ Produto    │ [Livre × ] [+ adicionar produto]           │  │
│  ├────────────┼────────────────────────────────────────────┤  │
│  │ Tempo de   │ Até 1:00s                                  │  │
│  │ Vídeo      │                                             │  │
│  ├────────────┼────────────────────────────────────────────┤  │
│  │ Nomeie o   │ @insta - mai 26 - pauta 1322 - semana 2    │  │
│  │ vídeo com  │ - <Produto> - sem/com headline  (read-only)│  │
│  └────────────┴────────────────────────────────────────────┘  │
│                                                                │
│  Marca: [Apice ▾]  Sem: [2]  Mês: [5]  Ano: [2026]            │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

### Comportamento

- Header com botão **← Briefings** (navegação volta) e **Salvar** (sticky direito; primary button + atalho Cmd/Ctrl+S).
- Tabela 2 colunas: label cinza esquerda, valor branco direita.
- Cada valor é um **textarea auto-expansivo** (cresce com conteúdo, sem scrollbar interno; min 2 linhas, sem max).
  - Exceção: `ref_url` é input single-line (URL).
  - `produtos` é input com chips: usuário digita produto e pressiona Enter pra adicionar como tag, X em cada tag pra remover. Sem combobox/dropdown (produtos são free-form text, não enum). Implementação custom em `briefing-products-input.tsx`.
  - `Nomeie o vídeo com` é uma row **read-only** (não editável) que mostra o template computado em runtime: `@<creator-handle-placeholder> - <mes-pt> <ano-2digits> - pauta <number> - semana <semana> - <produtos[0] || "ProdutoFocoDoVideo"> - sem headline/com headline`. Ajuda o time a saber a convenção sem ter que decorar.
- Pauta number aparece grande no header (`PAUTA 1322`). Editável via botão "editar nº" sutil ao lado, ou clicando.
- Default de novo briefing:
  - `briefing_number` = MAX+1 da brand selecionada (busca async ao montar)
  - `semana`, `mes`, `ano` = data atual
  - `produtos` = []
  - Outros campos vazios
- Campos abaixo da tabela: **Marca, Semana, Mês, Ano** — formato compacto. Default: brand do query param ou primeira brand.
- Confirmação `beforeunload` se houver mudanças não salvas.
- Toast feedback via `sonner`: success "Pauta salva", error com mensagem do server.
- Após salvar criação → navega pra `/dashboard/briefings/[id]` (modo edit). Após salvar edit → fica na mesma página, toast.

### Validações (Zod)

```typescript
export const briefingFormSchema = z.object({
  brand_id: z.number().int().positive(),
  briefing_number: z.number().int().positive("Número deve ser positivo"),
  semana: z.number().int().min(1).max(53).nullable().optional(),
  mes: z.number().int().min(1).max(12).nullable().optional(),
  ano: z.number().int().min(2020).max(2050).nullable().optional(),
  ref_url: z.string().url("URL inválida").nullable().optional().or(z.literal("")),
  take_inicial: z.string().max(2000).nullable().optional(),
  fala_inicial: z.string().max(2000).nullable().optional(),
  headline: z.string().max(500).nullable().optional(),
  construcao: z.string().max(5000).nullable().optional(),
  tempo_video: z.string().max(100).nullable().optional(),
  produtos: z.array(z.string().max(100)).max(20).default([]),
});
```

Server-side validation duplica via `safeParse` na Server Action. Erros voltam estruturados (campo + mensagem).

### Auto-resize textarea component

Implementação: usar [`react-textarea-autosize`](https://github.com/Andarist/react-textarea-autosize) (popular, leve, ~3kb gz). Adicionar à dependency:
```bash
npm install react-textarea-autosize
```

OU implementar manualmente (~30 linhas de useEffect que mede scrollHeight e seta height). **Recomendado: lib** — manutenção zero, atalho conhecido pelo time React.

Wrapper: `components/ui/auto-textarea.tsx` envolvendo a lib + estilos shadcn.

### Componentes

```
app/dashboard/briefings/new/page.tsx
app/dashboard/briefings/[id]/page.tsx
components/briefing-form.tsx              # form principal (client component)
components/briefing-form-row.tsx          # 1 row da tabela (label + value)
components/briefing-products-input.tsx    # multi-tag input pros produtos
components/ui/auto-textarea.tsx           # wrapper sobre react-textarea-autosize
```

## 5. Server Actions (`app/dashboard/briefings/actions.ts`)

```typescript
// READS
getBrands()
getBriefings(brandId, filters)             // já existe
getBriefingDetail(briefingId)              // já existe

// CRUD novo
suggestNextBriefingNumber(brandId)          → number          // MAX+1
createBriefing(input)                       → {success, id} | {success: false, error}
updateBriefing(input)                       → {success} | {success: false, error}
deleteBriefing(briefingId)                  → {success} | {success: false, error}
```

### Regras

- `createBriefing`/`updateBriefing`: `safeParse` via `briefingFormSchema`, retorna primeira issue ou erro DB.
- `createBriefing` força `source: 'native'`.
- `updateBriefing` preserva `source` original (não permite trocar `docs` → `native` ou vice-versa).
- `deleteBriefing` cascateia em `briefing_assignments` (FK ON DELETE CASCADE já existe).
- Toda mutation: `revalidateTag(BRIEFINGS)` + `revalidatePath('/dashboard/briefings')` + `revalidatePath('/dashboard/alocacao')`.

## 6. Cache

Sem mudanças na estratégia. Usa tag `briefings` existente. Os queries de leitura `getBriefings` e `getBriefingDetail` em `lib/queries/briefings.ts` continuam idênticos — só os tipos `Briefing` e `BriefingWithStatus` ganham os campos novos (incluído via update no `lib/schemas/briefing.ts`).

## 7. Auto-save? Não.

Decisão D3: save explícito. Razões:
- Reduz complexidade backend (sem endpoints de draft, sem state machine de versions)
- Reduz risco de "salvei sem querer"
- Browser nativo `beforeunload` cobre o "saí sem salvar"

Atalho Cmd/Ctrl+S salvar via listener nativo no form: `useEffect` registra `keydown` listener no `document`, intercepta `(e.metaKey || e.ctrlKey) && e.key === 's'`, chama `e.preventDefault()` e dispara o save action. Sem libs adicionais.

## 8. Pautas Docs-sourced — comportamento

Quando o time eventualmente reativar o Apps Script (após secrets serem setados em prod):

- Pautas com `source='docs'` aparecem nos cards normalmente, com badge **`Docs`**
- Click → form de edição funciona idêntico
- **WARNING visível** no topo do form de edição quando `source='docs'`:
  > "Esta pauta foi sincronizada do Google Docs. Edits aqui podem ser sobrescritos no próximo sync."

(Banner amarelo, ícone aviso, dismissível só naquela sessão.)

- `deleteBriefing` deleta. Se Docs sync rodar depois, recria a pauta (idempotente upsert) — operacional, não bug.

## 9. Visual / aesthetic guidelines (D4)

### Cards (lista)

- Background: `bg-card` (white claro)
- Border: 1px `border-border` neutro
- Hover: `hover:shadow-md hover:-translate-y-0.5 transition-all`
- Padding interno: `p-5`
- Headline: `text-base font-semibold leading-snug line-clamp-2`
- Take inicial: `text-sm text-muted-foreground line-clamp-1 mt-1`
- Footer com badges: `flex gap-2 mt-4`
- Aspect ratio livre — altura pelo conteúdo (mas similares por causa do `line-clamp`)

### Form

- Container: `max-w-3xl mx-auto` (não usa toda a tela; foco no conteúdo)
- Título PAUTA grande: `text-2xl font-bold tracking-tight font-mono` (mono pra remeter ao número como ID)
- Tabela: `border rounded-lg overflow-hidden`
  - Cell label: `bg-muted/50 px-4 py-3 font-medium text-sm text-muted-foreground border-r`
  - Cell value: `px-4 py-3` com auto-textarea sem border interna
- Save button: sticky no header, `Button` shadcn primary
- Spacing entre seções: `space-y-6`
- Tipografia: `font-feature-settings: 'cv11'` se Inter (mais elegante)

### Animações

- Drawer/sheet abre com slide (já vem do shadcn Sheet)
- Toast: padrão sonner
- Cards: hover lift sutil
- Save success: pulse rápido no botão + toast

### Cores

- Sem custom palette
- Status badges usando o que já existe (`BriefingAggregateBadge` reusado)
- Source badge: cinza neutro (`Docs`) e azul claro (`Nativa`) — sutil, informativo

## 10. Garantias de não-impacto

- ✅ `/dashboard/pautas` (analytics existente) — intacta
- ✅ `components/pautas-table.tsx` — intacto
- ✅ Tabelas existentes (creators, brands, ad_metrics, etc.) — intactas
- ✅ Edge Function `sync-ad-metrics` — intacta
- ✅ Sidebar mantém entradas existentes (Visão Geral, Tabela Mensal, etc.) intocadas — apenas a entrada "Pautas (Gestão)" do PR #45 será **renomeada e duplicada** (vira "Briefings" + "Alocação de Pautas")

## 11. Migração das mudanças sobre PR #45

### Estrutura de commits

Adicionar à branch `feat/briefings-management` (mesma do PR #45):

1. `refactor(schema): rename conceito to construcao, add headline + tempo_video`
2. `chore(schema): generate migration for new briefing fields`
3. `refactor(routing): rename /dashboard/briefings to /dashboard/alocacao`
4. `feat(actions): add briefing CRUD server actions`
5. `feat(ui): add briefing-form, auto-textarea, products-input components`
6. `feat(ui): add briefings list page (cards) and create/edit pages`
7. `feat(ui): update sidebar with split Briefings + Alocação entries`
8. `feat(edge): update ingest-briefing payload schema for new fields`
9. `chore(scripts): update Apps Script template + backfill for new shape`

Cada commit é independente e atômico. PR description atualizada pra refletir o escopo expandido.

### Migration consolidation — Estratégia A (decidido)

PR #45 tem migration `20260506183422_add_briefings_tables.sql` que **não está em prod** (rolamos back). Como o PR ainda não foi mergeado e é o único histórico, vamos **editar a migration original in-place** (Estratégia A):

1. Atualizar `supabase/schemas/20_briefings.sql` com schema final (com `construcao`, `headline`, `tempo_video`)
2. Deletar a migration antiga `supabase/migrations/20260506183422_add_briefings_tables.sql`
3. Rodar `supabase db reset --local` (zera local DB, re-aplica todas migrations do zero)
4. Rodar `supabase db diff -f add_briefings_tables` (gera nova migration consolidada)
5. `supabase migration up` aplica
6. Verificar: nova migration tem o schema final, sem ALTERs em-place pra rename de coluna

Resultado: 1 só migration na branch, schema final correto, histórico limpo. Em prod: quando merge for aprovado, `supabase db push` aplica tudo de uma vez.

**Custo pra outros devs locais:** rodar `supabase db reset --local` uma vez ao puxar a branch. Aceitável (a feature ainda não foi shippada — só os 2 desenvolvedores envolvidos no PR têm estado local).

## 12. Testing/verification

- `npm run lint` + `npm run build`: pass
- Migration aplicada local: `supabase db diff` deve mostrar empty (schema sync)
- Browser walkthrough manual:
  - [ ] Criar pauta nova: número auto-sugerido, todos campos editáveis, save persiste, redirect pra edit
  - [ ] Editar pauta existente: campos populam, save updates, navegar fora confirma se houver changes
  - [ ] Deletar pauta com assignments: cascade remove (verificar via SQL ou UI Alocação)
  - [ ] Auto-resize textarea: digitar texto longo, ver crescer sem scrollbar
  - [ ] Cmd+S salva sem submit do form padrão
  - [ ] Lista filtra por marca/mês/search
  - [ ] Card click navega pra edit
  - [ ] Página /dashboard/alocacao renderiza igual a /dashboard/briefings antigo
  - [ ] Sidebar mostra 2 entradas no grupo Gestão

## 13. Future hooks (fora deste escopo)

- **Histórico de versões** — log de quem editou o quê e quando
- **Comments inline** — review collaborativo no form
- **Templates de pauta** — começar nova baseada numa anterior
- **Geração de "Nomeie o vídeo com"** automaticamente (template + dados)
- **Markdown rendering em Construção** — bullets renderizados, não só texto raw
- **Integração com /dashboard/alocacao** via deep-link "Alocar agora" no header do form
