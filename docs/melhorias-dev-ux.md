# Melhorias para bolt.feldev — Roadmap Completo

> Atualizado em: 2026-03-15
> Fontes: análise do codebase + repo [claude-skills-fv](https://github.com/felvieira/claude-skills-fv)

---

## PRIORIDADE 0 — Economia de Tokens (Impacto Imediato, Esforço Baixo)

> Baseado em `policies/token-efficiency.md` e `patterns/ai-integration/cost-efficiency.md` do repo de skills.

### 0.1 — Remover exemplos gigantes do system prompt

**Arquivo:** `app/lib/common/prompts/prompts.ts`

O prompt atual tem 709 linhas com exemplos completos de snake game e bouncing ball (package.json inteiro, código completo). Anti-pattern direto: "evitar exemplos grandes quando snippet curto resolve".

**Fix:** Substituir os `<examples>` (~150 linhas) por referência ao schema apenas (~20 linhas). Economia: ~400 tokens por request.

### 0.2 — Injeção condicional de instruções opcionais

**Arquivo:** `app/lib/common/prompts/prompts.ts`

- `<mobile_app_instructions>` (~200 linhas) — injetar SOMENTE quando mobile mode ativo. Economia: ~600 tokens em sessões não-mobile.
- `<database_instructions>` exemplos SQL (~300 linhas) — injetar SOMENTE quando Supabase conectado. Economia: ~300 tokens em sessões sem DB.

### 0.3 — Prompt Caching para partes estáticas

As seções `<system_constraints>` + `<artifact_info>` + `<code_formatting_info>` nunca mudam entre requests — candidatas a Anthropic prefix caching / OpenAI cached prompts.

- Estruturar como primeiro bloco do prompt (ordem importa para caching)
- Economia: ~90% do custo dos tokens de sistema em conversas longas
- **Arquivo alvo:** `app/lib/common/prompts/optimized.ts` (já mais compacto, base ideal)

### 0.4 — Eliminar repetição de marcadores de urgência

`CRITICAL` aparece 15+ vezes, `IMPORTANT` 20+ vezes, `ULTRA IMPORTANT` 3 vezes — dilui o peso semântico.

**Fix:** Declarar hierarquia única no início do prompt:
```
Rules: [ABSOLUTE] cannot be overridden. [IMPORTANT] applies unless context demands otherwise. Default behavior applies otherwise.
```
E referenciar essa hierarquia em vez de repetir `CRITICAL` em cada regra.

### 0.5 — CONTINUE_PROMPT com compressão de estado

**Arquivo:** `app/lib/common/prompts/prompts.ts` (linha ~711)

Atualmente só diz "continue from where you left off". Enriquecer com template de compressão:

```typescript
export const CONTINUE_PROMPT = stripIndents`
  Continue your prior response.
  - Do NOT repeat completed artifact content or tags
  - Do NOT re-explain what was done
  - Pick up exactly where the last action ended
`;
```

### 0.6 — LLM Selector por modo

Pattern da skill `16-llm-selector`: 3 níveis de modelo por complexidade.

| Modo bolt | Nível recomendado | Exemplos |
|-----------|------------------|---------|
| `discuss` (sem geração de código) | Rápido | Haiku, GPT-4o-mini, Llama-3-8B |
| `build` simples (1-3 arquivos) | Balanceado | Sonnet, GPT-4o, Llama-3-70B |
| `build` complexo (múltiplos arquivos/arquitetura) | Profundo | Opus, GPT-4.5, o3 |

Expor essa sugestão na UI do seletor de modelo baseada no modo ativo.

---

## PRIORIDADE 1 — Qualidade do Código Gerado (Impacto Alto, Esforço Baixo)

> Baseado em `GLOBAL.md`, `prompt-patterns.md` e skills de code standards do repo.

### 1.1 — Reestruturar system prompt no padrão instrução/contexto/input/output

Pattern de `prompt-patterns.md`: separar claramente os blocos.

```
1. <identity>              — quem é o Bolt (2-3 linhas)
2. <environment>           — constraints do WebContainer (estático → cacheável)
3. <output_schema>         — formato exato do boltArtifact (estático → cacheável)
4. <code_standards>        — regras de código sem repetição (estático → cacheável)
5. <context>               — Supabase/design/mobile (dinâmico, injetado condicionalmente)
```

O prompt atual mistura tudo sem hierarquia clara e usa muitas regras negativas ("NEVER", "DO NOT", "FORBIDDEN"). Reescrever preferindo formas positivas: "sempre faça X" > "nunca faça Y".

### 1.2 — Self-documenting code > comentários excessivos

De `GLOBAL.md`:
> Comentários apenas para contexto não óbvio, restrição externa ou workaround temporário. Nomes e estrutura devem carregar a explicação.

Adicionar ao prompt: "Generate self-documenting code. Add comments only for non-obvious context, external constraints, or temporary workarounds. Never comment obvious operations."

O bolt atualmente gera código com comentários em cada linha inflando os arquivos.

### 1.3 — Context7/MCP para componentes sempre atualizados

Quando o usuário pede landing page ou UI, o bolt resolve bibliotecas via Context7 antes de gerar:
- `resolve-library-id` → Magic UI, Aceternity UI, shadcn/ui
- `query-docs` → busca snippets reais e atualizados

Mapping de intenção → biblioteca:
- "landing page" → Magic UI + Aceternity (hero, animações)
- "dashboard" → shadcn/ui (tabelas, charts, forms)
- "e-commerce" → shadcn/ui + Magic UI
- "portfolio" → Aceternity (3D effects, parallax)

---

## PRIORIDADE 2 — Features de Geração (Impacto Alto, Esforço Médio)

### 2.1 — Prompt de SEO/Conversão no system prompt

Adicionar instruções de marketing/conversão para landing pages:

**SEO:**
- h1 único, h2-h6 hierárquicos, meta description, title tag
- Open Graph + Twitter Cards, Schema.org JSON-LD
- Core Web Vitals: lazy loading, font-display, image sizing
- Alt text descritivo, URLs semânticas

**CRO:**
- Above the fold: headline + subheadline + CTA visível sem scroll
- CTAs: cor contrastante, texto acionável ("Comece grátis" > "Saiba mais")
- Social proof: depoimentos, logos, números
- Pricing: 3 planos max, destaque no recomendado, toggle mensal/anual

### 2.2 — Integração fal.ai para geração de imagens

Novo provider de imagens em `app/lib/modules/image/fal-provider.ts`.

- Modelos: FLUX.1 [schnell] (rápido), FLUX.1 [dev] (qualidade)
- Nova action `<boltAction type="image">` com prompt, style, size, placement
- Fallback: gradientes CSS, SVG patterns, Unsplash URLs
- API: `https://fal.run/fal-ai/flux/schnell` com `Authorization: Key $FAL_KEY`

### 2.3 — Preset de animações no system prompt

- Entrada: fade-in, slide-up, scale-in, blur-in (com stagger para listas)
- Micro-interações: hover lift, button press, shimmer loading
- Scroll-triggered: reveal on scroll, parallax, counter animation
- Instrução: "Use Context7 para buscar animações do Magic UI/Aceternity antes de implementar do zero"

### 2.4 — Design System Tokens no prompt

- Converter design scheme do usuário em CSS custom properties
- Instruir LLM a usar APENAS essas variáveis, nunca cores hardcoded
- Escala tipográfica padrão (h1-h6, body, caption)
- Espaçamento 4px/8px grid, border-radius por tipo de componente

---

## PRIORIDADE 3 — Features de UX/Interface (Impacto Médio, Esforço Médio)

### 3.1 — Templates de Landing Page Pré-Configurados

Templates na tela inicial para ponto de partida:
- **SaaS Landing**: Hero + Features + Pricing + FAQ + CTA
- **Portfolio**: Hero + Projects grid + About + Contact
- **E-commerce**: Hero + Products + Categories + Cart
- **Blog**: Hero + Featured + Grid + Newsletter
- **Agency**: Hero + Services + Cases + Team + Contact

Cada template usa componentes do Magic UI/Aceternity via Context7.

### 3.2 — Modo "Landing Page" com UX Guiado

Formulário step-by-step:
1. Tipo: SaaS / Portfolio / E-commerce / Blog / Custom
2. Conteúdo: Nome, tagline, CTA text
3. Estilo: Minimalista / Bold / Glassmorphism / Gradiente
4. Cores: picker com paletas pré-definidas
5. Seções: ordem configurável
6. Imagens: gerar via fal.ai ou placeholders
7. SEO: keywords, meta description

### 3.3 — Preview com Device Frames

Toggle Desktop / Tablet / Mobile com device frames visuais. Zoom controls, Landscape/Portrait toggle.

### 3.4 — Export Melhorado

- Next.js (SSR/SSG), Vite + React, HTML estático
- Minificação, image optimization, bundle analysis
- Lighthouse score no preview

---

## Ordem de Implementação Recomendada

| # | Item | Impacto | Esforço | ROI |
|---|------|---------|---------|-----|
| 1 | **0.1** Remover exemplos gigantes do prompt | Alto | 1h | ⭐⭐⭐⭐⭐ |
| 2 | **0.2** Injeção condicional mobile/supabase | Alto | 2h | ⭐⭐⭐⭐⭐ |
| 3 | **1.2** Self-documenting code no prompt | Alto | 30min | ⭐⭐⭐⭐⭐ |
| 4 | **0.4** Eliminar CRITICAL/IMPORTANT repetido | Médio | 1h | ⭐⭐⭐⭐ |
| 5 | **0.5** CONTINUE_PROMPT melhorado | Médio | 30min | ⭐⭐⭐⭐ |
| 6 | **2.1** SEO/CRO no system prompt | Alto | 2h | ⭐⭐⭐⭐ |
| 7 | **1.1** Reestruturar prompt (instrução/contexto/output) | Alto | 4h | ⭐⭐⭐⭐ |
| 8 | **0.3** Prompt caching partes estáticas | Alto | 3h | ⭐⭐⭐⭐ |
| 9 | **1.3** Context7 para componentes | Alto | 4h | ⭐⭐⭐⭐ |
| 10 | **0.6** LLM Selector por modo | Médio | 3h | ⭐⭐⭐ |
| 11 | **2.2** Integração fal.ai | Alto | 8h | ⭐⭐⭐ |
| 12 | **2.3** Preset animações | Médio | 2h | ⭐⭐⭐ |
| 13 | **2.4** Design System Tokens | Médio | 2h | ⭐⭐⭐ |
| 14 | **3.1** Templates landing page | Alto | 8h | ⭐⭐⭐ |
| 15 | **3.2** Modo landing page guiado | Alto | 16h | ⭐⭐ |
| 16 | **3.3** Device frames preview | Médio | 4h | ⭐⭐ |
| 17 | **3.4** Export melhorado | Médio | 8h | ⭐⭐ |

**Começo imediato:** Items 1-5 são todos no system prompt (`prompts.ts`/`optimized.ts`) — podem ser feitos em uma sessão, economia imediata de tokens sem nenhuma feature nova.
