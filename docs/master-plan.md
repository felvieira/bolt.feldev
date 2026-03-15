# bolt.feldev — Master Plan Consolidado

> Consolidação de: `auth-plan.md` + `melhorias-dev-ux.md` + correções da sessão atual
> Data: 2026-03-15
> Objetivo: plano único com workstreams paralelizáveis via multi-agents

---

## Status Atual (já implementado nesta sessão)

| Fix | Status |
|-----|--------|
| TLS ca-certificates no Dockerfile (workerd) | ✅ Deployed |
| SSE streaming no codex-proxy | ✅ Deployed |
| Session persistence (arquivo em disco) | ✅ Deployed |
| AbortSignal.timeout (90s regular, 5min reasoning) | ✅ Pushed |
| Error format OpenAI-compatível no codex-proxy | ✅ Pushed |
| Mensagem "model not supported" para ChatGPT | ✅ Pushed |
| Thread reuse nativo por conversa (multi-turn Codex) | ✅ Pushed |

---

## FASE 1 — Fazer Agora (WS-A + WS-D)

> Prompts + UX — impacto direto na qualidade e experiência de uso.
> Executar em paralelo com 2 agentes.

### WS-A: Otimização de Prompts (Esforço: ~8h, Impacto: Alto)

> **Escopo:** Alterações apenas em `app/lib/common/prompts/` — sem features novas, sem mudanças de infra. Economia imediata de tokens e melhoria na qualidade do código gerado.
> **Dependências:** Nenhuma.
> **Agente:** Agent A (prompts)

| # | Tarefa | Arquivo Principal | Esforço |
|---|--------|-------------------|---------|
| A1 | Remover exemplos gigantes (snake game, bouncing ball ~150 linhas → ~20 linhas de schema) | `prompts.ts` | 1h |
| A2 | Injeção condicional: `<mobile_app_instructions>` só quando mobile mode ativo; `<database_instructions>` só quando Supabase conectado | `prompts.ts` | 2h |
| A3 | Eliminar repetição de CRITICAL/IMPORTANT (15+ e 20+ ocorrências) → hierarquia única no início | `prompts.ts` | 1h |
| A4 | CONTINUE_PROMPT melhorado com instruções de não-repetição | `prompts.ts` | 30min |
| A5 | Self-documenting code: instrução para gerar código sem comentários óbvios | `prompts.ts` | 30min |
| A6 | SEO/CRO no system prompt: meta tags, OG, CTA above-the-fold, social proof | `prompts.ts` | 2h |
| A7 | Reestruturar prompt: identity → environment → output_schema → code_standards → context (dinâmico) | `prompts.ts`, `optimized.ts` | 4h |
| A8 | Prompt caching: mover partes estáticas para o início do prompt (prefix caching Anthropic/OpenAI) | `prompts.ts` | 1h |
| A9 | Preset de animações: fade-in, slide-up, scroll-triggered, micro-interações | `prompts.ts` | 1h |
| A10 | Design system tokens: instruir LLM a usar CSS custom properties do design scheme, nunca hardcoded | `prompts.ts` | 1h |

**Economia estimada:** ~1000+ tokens por request (A1+A2+A3 juntos).

---

### WS-D: UX/Interface Avançada (Esforço: ~36h, Impacto: Médio-Alto)

> **Escopo:** Features de interface que melhoram a experiência de uso.
> **Dependências:** WS-A (prompts de landing page) para D1 e D2.
> **Agente:** Agent D (frontend/UX)

| # | Tarefa | Esforço | Detalhes |
|---|--------|---------|----------|
| D1 | Templates de Landing Page | 8h | 5 templates na tela inicial: SaaS, Portfolio, E-commerce, Blog, Agency. Cada um com seções pré-definidas usando Magic UI/Aceternity via Context7 |
| D2 | Modo "Landing Page" guiado | 16h | Formulário step-by-step: tipo → conteúdo → estilo → cores → seções → imagens → SEO. Gera prompt otimizado automaticamente |
| D3 | Device frames preview | 4h | Toggle Desktop/Tablet/Mobile com frames visuais. Zoom controls, landscape/portrait |
| D4 | Export melhorado | 8h | Next.js (SSR/SSG), Vite+React, HTML estático. Minificação, image optimization, Lighthouse score |

---

### WS-FIX: Persistência do Login ChatGPT/Codex (Esforço: ~4h, Impacto: Crítico)

> **Problema atual:** Toda vez que o usuário dá refresh na página, o botão "Login with ChatGPT" aparece de novo. A sessão não persiste entre page loads.
> **Causa raiz:** O `activeSessionToken` do codex-proxy é salvo em arquivo (sobrevive restart do container) mas quando o container é REBUILDED no Coolify o arquivo some. Além disso, o cookie `codexSession` no browser tem 7 dias mas o codex-proxy não restaura a sessão corretamente em todos os cenários.
> **Agente:** Agent A ou D (quem terminar primeiro)

| # | Tarefa | Detalhes |
|---|--------|----------|
| FIX1 | Volume Docker para session token | Montar `/app/.session_token` como Docker volume no Coolify para sobreviver rebuilds |
| FIX2 | Restauração robusta no startup | `restoreSession()` no codex-proxy deve tentar `account/read` com `refreshToken: true` E `false`, e logar detalhes de cada tentativa |
| FIX3 | Frontend: não limpar cookie se proxy offline | `checkStatus()` no `ChatGPTLoginSection.tsx` deve distinguir "proxy retornou authenticated:false" de "proxy inacessível/timeout" — só limpar cookie no primeiro caso |
| FIX4 | Heartbeat de sessão | codex-proxy expor `GET /codex/session-health` que retorna se o sidecar Codex ainda está autenticado. Frontend chama periodicamente ao invés de depender só do cookie |

---

## FASE 2 — Fazer Depois (WS-B + WS-C)

> Auth multi-usuário + integrações novas. Dependem da Fase 1 estar estável.

### WS-B: Autenticação Multi-Usuário (Esforço: ~40h, Impacto: Crítico)

> **Escopo:** Sistema completo de auth com PostgreSQL, auth-service sidecar, JWT, UI de login/registro, localStorage isolado por usuário, codex-proxy multi-sessão.
> **Dependências:** Nenhuma externa. WS-FIX (persistência de login) precisa estar resolvido antes.
> **Agente ideal:** 2-3 agentes em paralelo (infra, backend auth, frontend auth).

#### Fase B1 — Infraestrutura (agente 1)
| # | Tarefa | Detalhes |
|---|--------|----------|
| B1.1 | Criar `auth-service/` | `package.json`, `server.js`, `Dockerfile` (express + pg + bcrypt + jose) |
| B1.2 | PostgreSQL no docker-compose | Imagem `postgres:16-alpine`, volume `postgres_data`, porta 5432 |
| B1.3 | auth-service no docker-compose | Porta 3200, `DATABASE_URL`, `JWT_SECRET` |
| B1.4 | Schema SQL + migration | Tabela `users` (UUID, email, password bcrypt, display_name, timestamps) |
| B1.5 | Variáveis de ambiente | `DATABASE_URL`, `JWT_SECRET`, `AUTH_SERVICE_URL` no Coolify |

#### Fase B2 — Backend Auth (agente 2, após B1.4)
| # | Tarefa | Detalhes |
|---|--------|----------|
| B2.1 | `POST /auth/register` | Validação email, bcrypt hash (rounds ≥ 12), INSERT, retorna JWT |
| B2.2 | `POST /auth/login` | Verifica bcrypt, retorna JWT (jose) com { userId, email, displayName } |
| B2.3 | `GET /auth/me` | Valida JWT, retorna dados do usuário |
| B2.4 | Rate limiting | `express-rate-limit` em /auth/login e /auth/register |
| B2.5 | `app/lib/auth.server.ts` | `requireUser()`, `verifyJWT()` com jose (compatível workerd) |

#### Fase B3 — Frontend Auth (agente 3, após B2.5)
| # | Tarefa | Detalhes |
|---|--------|----------|
| B3.1 | Rotas `/login`, `/register`, `/logout` | Formulários Remix, cookie httpOnly `bolt_session` |
| B3.2 | Componente `UserMenu` no header | Avatar/iniciais, email, botão "Sair" |
| B3.3 | `getUserStorage()` utility | Prefix `user_{userId}_` em todas as chaves localStorage |
| B3.4 | Migrar localStorage existente | Todos os usos atuais de localStorage usar prefix por usuário |

#### Fase B4 — codex-proxy Multi-Sessão (agente 2, após B2.5)
| # | Tarefa | Detalhes |
|---|--------|----------|
| B4.1 | Refatorar `activeSessionToken` → `Map<userId, SessionState>` | Cada usuário com seu próprio CodexManager |
| B4.2 | Header `x-user-id` do Remix → codex-proxy | JWT decodificado no Remix, userId passado no header |
| B4.3 | Login/logout ChatGPT por usuário | Cada usuário loga independentemente no ChatGPT |

#### Fase B5 — Polimento (qualquer agente, após B3+B4)
| # | Tarefa | Detalhes |
|---|--------|----------|
| B5.1 | Página de perfil | Alterar nome/senha |
| B5.2 | Boas-vindas primeiro acesso | Onboarding modal |
| B5.3 | Renovação automática JWT | "Lembrar-me" |
| B5.4 | Testes básicos de auth | Happy path register → login → use → logout |

---

### WS-C: Integrações & Provider (Esforço: ~16h, Impacto: Alto)

> **Escopo:** Novas integrações que expandem as capacidades do bolt.
> **Dependências:** WS-A (prompts) para C1 e C3.
> **Agente ideal:** 1 agente por integração.

| # | Tarefa | Esforço | Detalhes |
|---|--------|---------|----------|
| C1 | Context7/MCP para componentes | 4h | Quando user pede "landing page" → resolve-library-id (Magic UI, Aceternity, shadcn) → query-docs → snippets reais no prompt. Mapping: landing→MagicUI, dashboard→shadcn, portfolio→Aceternity |
| C2 | fal.ai para geração de imagens | 8h | Novo provider `app/lib/modules/image/fal-provider.ts`. Modelos: FLUX.1 schnell/dev. Nova action `<boltAction type="image">`. API: `https://fal.run/fal-ai/flux/schnell`. Fallback: gradientes CSS |
| C3 | LLM Selector por modo | 4h | Sugestão na UI: discuss→modelo rápido (Haiku, 4o-mini), build simples→balanceado (Sonnet, 4o), build complexo→profundo (Opus, o3). Baseado em chatMode + file count |

---

## Ordem de Execução

```
FASE 1 — Agora (paralelo):
  ├── Agent A: WS-A (prompts) + WS-FIX (persistência login) — 12h
  └── Agent D: WS-D (UX/templates/preview) — 36h

FASE 2 — Depois (paralelo, após Fase 1 estável):
  ├── Agent B1: WS-B Fase 1+2 (infra + backend auth) — 16h
  ├── Agent B2: WS-B Fase 3+4 (frontend auth + codex multi-session) — 16h
  ├── Agent B3: WS-B Fase 5 (polimento) — 8h
  └── Agent C: WS-C (Context7 + fal.ai + LLM selector) — 16h
```

**Fase 1:** ~44h de trabalho, ~2 semanas com 2 agentes
**Fase 2:** ~56h de trabalho, ~2 semanas com 3 agentes
**Total:** ~100h, ~4 semanas

---

## Regras para Execução Multi-Agent

1. **Cada agente trabalha em workstream isolado** — sem conflito de arquivos
2. **WS-A (prompts)** só toca `app/lib/common/prompts/` — sem risco de conflito
3. **WS-D (UX)** toca componentes de UI — independente na Fase 1
4. **WS-B (auth)** cria novos diretórios (`auth-service/`, rotas de auth) — mínimo conflito
5. **WS-C (integrações)** cria novos providers/módulos — independente
6. **Branch por workstream:** `ws-a/prompt-optimization`, `ws-d/ux-improvements`, `ws-b/multi-user-auth`, `ws-c/integrations`
7. **Review checkpoint** ao final de cada fase antes de merge

---

## Referências

- Plano detalhado de auth: `docs/auth-plan.md`
- Roadmap de melhorias: `docs/melhorias-dev-ux.md`
- Fixes da sessão atual: commits `e1af186..5d05ffe` no branch `main`
