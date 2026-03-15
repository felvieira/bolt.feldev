# bolt.feldev — Fase 2: Visual UX + OpenCode Features
> Data: 2026-03-15
> Fontes: Pesquisa UX (Bolt/Lovable/v0), análise OpenCode (sst/opencode)
> Objetivo: melhorias visuais e de experiência + features do OpenCode que fazem sentido para uso web

---

## Contexto

bolt.feldev é usado via **web** para criar landing pages, SaaS, e-commerce e sistemas web.
Os usuários **nunca usam terminal** — descrevem em linguagem natural, a IA gera, o preview aparece no browser.

WS-A (prompts) concluído. Esta fase foca em:
- Visual e experiência de uso (inspirado em Lovable/v0)
- Features do OpenCode adaptadas para web

---

## WS-V: Visual & UX (Alto Impacto, Esforço Médio)

> **Inspiração:** Lovable tem onboarding visual superior. v0 tem preview limpo e export. Bolt tem mais poder mas UX mais complexa.
> **Goal:** Parecer tão polido quanto Lovable/v0, mantendo o poder do Bolt.

### V1 — Chat mais limpo e focado (Esforço: 2h)

**Problema:** A sidebar de chat mostra muita informação — tokens, timestamps, IDs — distraindo do conteúdo.

**Fix:**
- Mensagens do usuário com bubble clean (sem metadados expostos)
- Respostas do assistente: apenas o texto, sem badges de model/provider no meio do chat
- Timestamp e info de modelo num tooltip/hover, não visível por padrão
- Indicador de carregamento mais elegante (skeleton do texto vs spinner genérico)

### V2 — Preview panel melhorado (Esforço: 3h)

**Problema:** O preview está funcional mas sem polimento. Lovable e v0 têm device frames e controles visuais.

**Fix:**
- Toggle Desktop / Tablet (375px) / Mobile (390px) com device frames SVG
- Zoom in/out (75%, 100%, 125%, 150%)
- Botão "Open in new tab" para ver em fullscreen
- Loading skeleton no iframe enquanto build roda
- Indicador visual de "app atualizado" (pulse verde no border por 2s após deploy)

### V3 — File tree mais intuitivo (Esforço: 2h)

**Problema:** Os usuários não sabem quais arquivos foram criados/modificados na última resposta.

**Fix:**
- Highlight nos arquivos modificados na última geração (badge "new" ou "modified" por 5s)
- Ícone de linguagem colorido por tipo (.tsx → azul React, .css → roxo, etc.)
- Collapse automático de node_modules e .git
- Count de arquivos no header da tree ("12 files")

### V4 — Error feedback visual (Esforço: 4h)

**Problema:** Quando o app quebra, o usuário vê erro no console mas não tem ação clara.

**Fix:**
- Banner vermelho no preview com "App crashed" + botão "Fix with AI"
- "Fix with AI" envia o erro do console automaticamente para o chat
- Error boundary no preview iframe que captura React errors
- Toast de sucesso quando o app volta a funcionar após fix

### V5 — Histórico de versões por projeto (Esforço: 6h)

**Inspiração OpenCode:** SQLite session persistence + undo/redo.
**Adaptado para web:** Checkpoints automáticos no localStorage/DB.

**Fix:**
- Checkpoint automático a cada mensagem do assistente (snapshot dos arquivos)
- Timeline visual no painel lateral: "v1 → v2 → v3" com timestamp
- "Restore to this version" com confirmação
- Máximo 10 versões por projeto (evitar bloat)
- Indica qual versão está ativa

### V6 — Onboarding e empty states (Esforço: 3h)

**Problema:** Tela inicial vazia sem orientação. Lovable tem sugestões contextuais.

**Fix:**
- Tela inicial: 4-6 cards de sugestão com categorias (Landing Page, SaaS, Portfolio, E-commerce)
- Cada card com exemplo de prompt clicável
- "Start from template" como CTA secundário
- Empty state no chat com exemplos de prompts populares
- Dica contextual na primeira vez: "💡 Tip: describe your app in 2-3 sentences for best results"

### V7 — Export melhorado (Esforço: 4h)

**Inspiração v0:** Export limpo e direto.

**Fix:**
- Botão "Export" no header (não enterrado em menu)
- Modal com opções: Download ZIP, Open in StackBlitz, Deploy to Netlify, Copy all files
- ZIP inclui README.md gerado automaticamente com instruções de setup
- Botão "Copy prompt" para reutilizar o prompt que gerou o projeto

---

## WS-O: OpenCode Features Adaptadas (Impacto Alto, Esforço Médio-Alto)

> Só features que fazem sentido sem terminal. Skipping: TUI, bash tool, git worktrees, IDE extensions.

### O1 — Modo "Review antes de aplicar" / Plan Mode (Esforço: 8h)

**Inspiração OpenCode:** `plan` agent é read-only — mostra o que vai fazer antes de fazer.
**Adaptado para web:** Toggle "Build" vs "Plan" no chat.

**Implementação:**
- Toggle no header: `[Build] [Plan]`
- Em Plan mode: LLM descreve o que vai criar/modificar em texto, SEM gerar código
- UI mostra lista de arquivos que seriam criados/modificados
- Botão "Apply" executa o plan, "Discard" descarta
- Custo menor: Plan usa modelo mais barato (Haiku/4o-mini), Apply usa o modelo principal

**Arquivos:**
- `app/lib/common/prompts/prompts.ts` — novo `planModePrompt`
- `app/routes/api.chat.ts` — handle `chatMode: 'plan'`
- `app/components/chat/ChatInput.tsx` — toggle UI

### O2 — Project Rules (tipo AGENTS.md) (Esforço: 6h)

**Inspiração OpenCode:** AGENTS.md define regras do projeto que a IA sempre segue.
**Adaptado para web:** Painel de "Project Rules" por projeto.

**Implementação:**
- Ícone de settings no header do projeto
- Modal "Project Rules": textarea livre onde usuário escreve regras
  - Ex: "Always use TypeScript", "Use Tailwind for styling", "Company colors: #FF5733"
- Rules injetadas no system prompt como seção `<project_rules>`
- Salvo no localStorage por projeto (`project_{id}_rules`)
- Sugestões de rules baseadas no stack detectado

**Arquivos:**
- `app/lib/.server/llm/stream-text.ts` — injetar `projectRules` no prompt
- `app/routes/api.chat.ts` — receber `projectRules` do frontend
- Novo componente `ProjectRulesModal.tsx`

### O3 — LLM Selector por Contexto (Esforço: 4h)

**Inspiração OpenCode:** Modelos diferentes para tarefas diferentes (análise vs geração).
**Adaptado para web:** Sugestão automática + override manual.

**Implementação:**
- Detector de complexidade baseado em:
  - Modo: `discuss` → modelo rápido, `build` → modelo completo
  - File count: > 10 arquivos → modelo avançado
  - Keywords: "refactor", "architecture" → modelo avançado; "fix", "add button" → modelo rápido
- Badge na UI: "⚡ Using fast model" ou "🧠 Using advanced model" (clicável para override)
- Fallback: usuário sempre pode selecionar manualmente

**Arquivos:**
- `app/lib/hooks/useModelSuggestion.ts` — hook de detecção
- `app/components/chat/ModelSelector.tsx` — badge + override UI

### O4 — Context Window Visual (Esforço: 3h)

**Inspiração OpenCode:** Context compaction automático + usuário sabe quando ocorre.
**Adaptado para web:** Barra de uso de contexto visível.

**Implementação:**
- Barra horizontal no topo do chat: `[████████░░] 80% context used`
- Quando > 80%: aviso "Context getting full — some old messages may be summarized"
- Quando context é compactado: "📝 Chat history summarized to save context"
- Estimativa baseada em contagem de tokens das mensagens

**Arquivos:**
- Novo hook `useContextUsage.ts`
- `app/components/chat/ContextUsageBar.tsx`

### O5 — MCP Servers UI (Esforço: 8h)

**Inspiração OpenCode:** MCP servers para injetar docs externos no contexto.
**Adaptado para web:** Painel de integrações na UI.

**Implementação:**
- Tab "Integrations" nas settings
- Integrações pré-configuradas:
  - **Context7** (já temos): docs de bibliotecas em tempo real
  - **Figma** (via MCP): importar designs diretamente
  - **Unsplash**: imagens de placeholder para mockups
- Cada integração: toggle on/off, config fields, status indicator
- MCP requests feitos server-side (evitar CORS + expor API keys)

**Arquivos:**
- `app/lib/modules/mcp/` — novo módulo
- `app/components/@settings/tabs/Integrations.tsx`

---

## Ordem de Execução Recomendada

```
SPRINT 1 — Quick wins visuais (1-2 dias):
  V1 (chat limpo) + V3 (file tree) + V6 (onboarding/empty states)
  → Impacto visual imediato, baixo risco

SPRINT 2 — Preview e erros (2-3 dias):
  V2 (device frames) + V4 (error feedback) + V7 (export)
  → Completa o core loop de criação

SPRINT 3 — Features OpenCode simples (3-4 dias):
  O2 (project rules) + O3 (LLM selector) + O4 (context window)
  → Poder + transparência

SPRINT 4 — Features maiores (1 semana):
  V5 (version history) + O1 (plan mode) + O5 (MCP UI)
  → Diferenciação competitiva
```

---

## Resumo de Esforço

| Item | Esforço | Impacto | Sprint |
|------|---------|---------|--------|
| V1 Chat limpo | 2h | Alto | 1 |
| V3 File tree | 2h | Médio | 1 |
| V6 Onboarding | 3h | Alto | 1 |
| V2 Device frames | 3h | Alto | 2 |
| V4 Error feedback | 4h | Alto | 2 |
| V7 Export | 4h | Médio | 2 |
| O2 Project Rules | 6h | Alto | 3 |
| O3 LLM Selector | 4h | Médio | 3 |
| O4 Context Window | 3h | Médio | 3 |
| V5 Version History | 6h | Alto | 4 |
| O1 Plan Mode | 8h | Alto | 4 |
| O5 MCP UI | 8h | Médio | 4 |

**Total:** ~53h de trabalho, ~3-4 semanas

---

## Referências

- Plano master: `docs/master-plan.md`
- OpenCode: https://github.com/sst/opencode
- Lovable UX research: sessão anterior (chat history)
