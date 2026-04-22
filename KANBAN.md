# Kanban — PS5 Pro Tracker

> Gerado a partir da análise técnica de 2026-04-22.
> Colunas: **Backlog → Em Progresso → Concluído**

---

## 🔴 Crítico

| ID | Tarefa | Arquivo | Notas |
|----|--------|---------|-------|
| C-01 | **Remover `clearOffers()` do ciclo do crawler** | `server/crawler.ts:156` | Cada execução apaga todos os registros de `priceHistory` via cascade delete. O fluxo `createOrUpdateOffer()` já trata upsert corretamente — basta remover a chamada. A função `isDuplicateOffer()` (linha 60) vira dead code e também deve ser removida. |
| C-02 | **Proteger `runCrawler` com autenticação** | `server/routers/offers.ts:47` | Mutation está em `publicProcedure`. Trocar para `adminProcedure` (já exportado em `_core/trpc.ts`). Rate limit de 5 req/min mitiga mas não substitui auth. |

---

## 🟡 Médio

| ID | Tarefa | Arquivo | Notas |
|----|--------|---------|-------|
| ~~M-01~~ | ~~**Exibir nome da loja no card de oferta**~~ | Resolvido junto com redesign dos cards | |
| M-02 | **Consolidar interface `ScrapedOffer` duplicada** | `server/crawler.ts`, `server/scrapers/*.ts` | A interface está definida 4 vezes com conteúdo idêntico. Mover para `shared/types.ts` ou `server/scrapers/types.ts` e importar nos 4 arquivos. |
| M-03 | **Usar `AXIOS_TIMEOUT_MS` da constante** | `server/scrapers/*.ts`, `shared/const.ts:5` | `AXIOS_TIMEOUT_MS = 30_000` definido mas ignorado; scrapers usam `timeout: 15000` hardcoded. Importar e usar a constante para centralizar o valor. |

---

## 🟢 Baixo

| ID | Tarefa | Arquivo | Notas |
|----|--------|---------|-------|
| L-01 | **Remover bloco de comentário morto no HTML** | `client/index.html:10-14` | Bloco comentado sobre Google Fonts (marcado para deleção) nunca foi removido. |
| L-02 | **Corrigir `lang` do HTML para `pt-BR`** | `client/index.html:2` | `<html lang="en">` em app 100% em português. Trocar para `lang="pt-BR"`. |
| L-03 | **Remover campo `description` redundante** | `server/crawler.ts:116`, `drizzle/schema.ts` | Campo `description` na tabela `offers` é sempre preenchido com o valor de `title`. Remover da inserção ou usar o campo para algo distinto de `title`. |
| ~~L-04~~ | ~~**Ampliar rotação de User-Agents**~~ | resolvido como parte do fix do 503 | |

---

## ✅ Concluído

| ID | Tarefa |
|----|--------|
| C-01 | **Remover `clearOffers()` do ciclo do crawler** — `clearOffers()`, `isDuplicateOffer()` e a chamada em `runCrawler()` removidos de `server/crawler.ts` |
| EXTRA | **Aumentar acertividade do filtro de produtos** — corrigido bug de term-length (`>3`→`>=3`), adicionada detecção de intenção de console (exige "console" no título quando query indica console), blocklist expandida. 18 testes em `server/scrapers/filters.test.ts`. |
| EXTRA | **Fix 503 Amazon / headers realistas + retry** — criado `server/scrapers/http.ts` com 8 user-agents, headers `sec-ch-ua`/`sec-fetch-*`/`Cache-Control`/`Accept-Encoding: br` e retry automático em 503/429 (delays 1.5s e 4s). Os três scrapers migrados para usar `fetchHtml`. L-04 resolvido como consequência. |
| EXTRA | **Fix preço incorreto nos scrapers** — Amazon: seletor trocado para `span.a-price:not(.a-text-price) span.a-offscreen` evitando capturar preço riscado. Mercado Livre: prioriza `[itemprop="price"]` content (preço total machine-readable), fallback para parsing textual. |
| EXTRA | **Fix URL instável causando link perdido + preço trocado** — Amazon: URL normalizada para `/dp/ASIN` canônico (o `ref=sr_1_N` fica no path, não na query string, e varia por posição). Mercado Livre: query params de posição/sessão removidos, mas `wid` preservado — sem ele o link vai para a página de catálogo que exibe um vendedor diferente com preço diferente. |

---

## Dependências entre tarefas

```
C-01 ──► M-01   (remover clearOffers antes de testar histórico com nome da loja)
M-02 ──► M-03   (consolidar tipos antes de ajustar timeouts para evitar retrabalho)
```
