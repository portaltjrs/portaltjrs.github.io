
## Visão geral

Portal público responsivo (azul institucional + cinzas, estilo TJRS) para gerenciar a fila dinâmica e a escolha de comarcas do concurso de Oficial de Justiça, a partir da **Ordem de nomeação 200**. Sem contas de usuário: o candidato apenas seleciona seu nome; o admin acessa por senha única.

## Decisões confirmadas

- **Identificação do candidato**: apenas seleção de nome, sem CPF/PIN. (Ciente do risco de outra pessoa responder — pode ser reforçado depois adicionando PIN.)
- **Ordem da fila**: coluna **Ordem nomeação**, a partir de 200.
- **Admin**: senha única em variável de ambiente.
- **Atualizações**: polling de 5 s (TanStack Query `refetchInterval`).

## Base de dados (Lovable Cloud / Supabase)

Migração inicial com tabelas:

- `candidates`
  - `id` uuid pk
  - `classificacao` int
  - `ordem_nomeacao` int único
  - `nome` text
  - `cota` text (`ampla` / `pcd` / `pne`) — derivada das colunas PCD/PNE
  - `notas` jsonb (LP, CE, MI, TOTAL — só leitura, para transparência)
  - `situacao_original` text (do CSV: "Aprovado" etc.)
  - `pretende_assumir_original` text (histórico do CSV)
  - `preferencia_original` text (histórico do CSV — texto livre da planilha atual)
  - `status` text (`pendente` / `sim` / `nao` / `talvez`, default `pendente`)
  - `comarca_id` uuid nullable → `comarcas.id`
  - `updated_at` timestamptz

- `comarcas`
  - `id` uuid pk
  - `nome` text único
  - `vagas_total` int
  - `vagas_ocupadas` int (default 0)
  - `updated_at` timestamptz

- `settings` (linha única, id fixo)
  - `fase` int (0 fechado, 1 intenção, 2 escolha)
  - `updated_at`

- **Fila efetiva** = view/consulta em `candidates` onde `ordem_nomeacao >= 200`, ordenada por `ordem_nomeacao`. Candidatos com `status = 'nao'` são exibidos "riscados" mas ignorados para a "vez atual".

RLS habilitado; SELECT público (anon) apenas em colunas seguras via views; todo INSERT/UPDATE passa por server functions com validação. GRANTs explícitos para `anon` e `authenticated`.

## Server functions (`createServerFn`) em `src/lib/*.functions.ts`

- `listCandidatesPublic()` — dropdown (id, nome, ordem_nomeacao) apenas com `ordem_nomeacao >= 200`.
- `enterAsCandidate({ candidateId })` — grava cookie de sessão criptografado (`useSession`, `CANDIDATE_SESSION_SECRET`) com o `candidateId`.
- `getMyCandidate()` — lê sessão e retorna dados.
- `logoutCandidate()`.
- `setIntent({ status })` — apenas se `settings.fase = 1`; atualiza `status` do candidato da sessão.
- `getQueueSnapshot()` — retorna: lista completa da fila (≥200) com status e comarca escolhida; `atualId` (primeiro na ordem com `status ∈ {sim, talvez, pendente}` e sem comarca); contadores (sim / nao / talvez / pendente).
- `listComarcas()` — todas com vagas restantes.
- `chooseComarca({ comarcaId })` — apenas se `settings.fase = 2` **e** `candidatoDaSessao.id === atualId` **e** comarca tem vaga. Transação: incrementa `vagas_ocupadas`, marca `comarca_id` no candidato.
- `adminLogin({ password })` / `adminLogout()` — cookie separado com `ADMIN_SESSION_SECRET`.
- `adminSetFase({ fase })`.
- `adminImportCandidatesCsv({ csv })` — parse tolerante das colunas da planilha atual (Classificação, Ordem nomeação, PCD, PNE, NOME, LP, CE, MI, TOTAL, SITUAÇÃO, PRETENDE ASSUMIR?, PREFERENCIA LOCAL/REGIÃO, ASSUMIU?, Atualização). Upsert por `ordem_nomeacao`. Deriva `cota` a partir de PCD/PNE.
- `adminImportComarcasCsv({ csv })` — cabeçalhos esperados: `nome,vagas_total`.
- `adminSetCandidateStatus({ id, status, comarcaId? })` — permite corrigir qualquer candidato manualmente.
- `adminExportFinalCsv()` — CSV na ordem de `ordem_nomeacao`: nome, ordem, classificação, cota, status, comarca escolhida.

Middlewares `requireCandidate` e `requireAdmin` validando o cookie correspondente.

## Rotas (TanStack Router)

- `/` — landing pública com faixa azul institucional, explicação e dois CTAs: **Sou candidato** (→ `/entrar`) e **Ver fila pública** (→ `/fila`).
- `/entrar` — combobox (shadcn Command) com busca dos nomes (≥200) → botão "Entrar". Grava sessão.
- `/portal` (requer sessão candidato):
  - Header com nome + Ordem de nomeação + botão "Sair".
  - **Fase 0**: mensagem "Chamada ainda não aberta / encerrada".
  - **Fase 1 (Intenção)**: três botões grandes SIM / NÃO / TALVEZ, com estado atual destacado. Editável a qualquer momento.
  - **Fase 2 (Escolha)**: lista de comarcas (cards com vagas restantes). Botão "Confirmar escolha" habilitado apenas quando `getQueueSnapshot().atualId === myId`; caso contrário, mostra "Você é o Nº X da fila — aguarde sua vez". Uma vez escolhida, comarca fica bloqueada.
- `/fila` — dashboard público:
  - Cards de proporção SIM / NÃO / TALVEZ / PENDENTE + gráfico (recharts pie/bar).
  - Tabela da fila (≥200), riscando `nao`, badge da comarca escolhida, destaque no próximo a escolher.
  - Tabela de comarcas com vagas restantes.
- `/admin` — form de senha.
- `/admin/painel` (requer sessão admin):
  - Controles de fase (Fase 1 / Fase 2 / Encerrar).
  - Upload CSV de candidatos (drag & drop, preview, confirmar).
  - Upload CSV de comarcas.
  - Tabela editável de candidatos (mudar status manualmente, atribuir comarca em casos especiais).
  - Botão **Exportar Relatório Final (CSV)**.

Todas as views usam `useQuery` com `refetchInterval: 5000`.

## Design

- Tokens em `src/styles.css` (oklch):
  - `--primary` azul institucional profundo (ex: oklch(0.32 0.11 255)).
  - `--secondary` cinza claro; superfícies neutras; texto em cinza escuro.
  - `--accent` azul mais claro para destaques (próximo a escolher, badges).
- Header fixo com faixa azul, título "TJRS — Chamada de Oficial de Justiça" e navegação (Início / Fila pública / Sou candidato).
- Componentes shadcn: Card, Button, Table, Dialog, Command (autocomplete de nomes), Badge, Progress, Tabs, Toast.
- Layout responsivo mobile-first; tabelas com scroll horizontal em telas pequenas.

## Segurança e integridade

- Todas as mutações validam servidor-side: sessão + fase atual + regra da vez.
- Cookies httpOnly, secure, sameSite lax, assinados com `useSession`.
- `chooseComarca` roda em transação para evitar corrida entre dois candidatos.
- Rate limit simples (in-memory por IP) em `enterAsCandidate` e `adminLogin`.
- CSV parse com validação (colunas obrigatórias, tipos numéricos), sem executar nada além de upsert.

## Secrets a criar

- `ADMIN_PASSWORD` — pedida ao usuário.
- `ADMIN_SESSION_SECRET` — gerada automaticamente (32+).
- `CANDIDATE_SESSION_SECRET` — gerada automaticamente (32+).

## Ordem de implementação

1. Habilitar Lovable Cloud; criar as 3 secrets.
2. Migração SQL: tabelas + enums + RLS + grants + `settings` inicial (fase=0).
3. Design system (tokens azul/cinza) + layout base (`__root` com header/nav).
4. Server functions + middlewares.
5. Rotas públicas (`/`, `/entrar`, `/fila`) com dashboard e polling.
6. Portal do candidato (`/portal`) — Fase 1 e Fase 2.
7. Painel admin (`/admin`, `/admin/painel`) — CSV import, edição, export.
8. Seed inicial: importar CSV real da planilha compartilhada para teste (opcional).
9. Verificação end-to-end via Playwright: entrar como candidato ≥200, marcar intenção, alternar fase, escolher comarca.

## Pendências para depois do plano

- Você fornece a **senha do admin** (ou aceito uma gerada e te envio).
- Você importa o **CSV de comarcas** pelo painel quando estiver pronto (cabeçalhos: `nome,vagas_total`).
- CSV de candidatos: usarei o formato exato da planilha compartilhada; se mudar de layout depois, só re-importa.
