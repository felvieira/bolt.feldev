# Melhorias para Dev UX, Interfaces, Animacoes e Landing Pages

## 1. Biblioteca de Componentes Reutilizaveis no Prompt

**Problema**: O LLM gera codigo do zero toda vez, sem reaproveitar componentes. Cada landing page, cada form, cada navbar eh reescrita.

**Solucao**: Injetar no system prompt um catalogo de componentes prontos (design tokens, componentes base, patterns) que o LLM deve usar como referencia.

- Criar `app/lib/common/prompts/component-library.ts` com snippets de componentes padrao:
  - Navbar (responsiva com hamburger menu + animacao)
  - Hero section (com gradientes, animacao de entrada)
  - CTA buttons (com hover states, ripple effect)
  - Card grid (responsivo, com hover lift)
  - Footer (multi-coluna, responsivo)
  - Form components (com validacao visual, focus states)
  - Pricing table (com toggle mensal/anual, highlight no plano recomendado)
  - Testimonials (carousel com autoplay)
  - Feature grid (com icones animados)
- O prompt instrui o LLM a usar esses patterns como base em vez de inventar do zero
- Garante consistencia visual e DRY

---

## 2. Preset de Animacoes no System Prompt

**Problema**: O LLM gera animacoes inconsistentes ou basicas demais. Cada projeto tem um estilo diferente.

**Solucao**: Definir uma biblioteca de animacoes CSS/Framer Motion padrao no prompt.

- Animacoes de entrada: fade-in, slide-up, scale-in, blur-in (com stagger para listas)
- Micro-interacoes: hover lift, button press, ripple, shimmer loading
- Scroll-triggered: reveal on scroll, parallax, counter animation
- Page transitions: crossfade, slide, morph
- Skeleton loading states para todo conteudo assíncrono
- O prompt deve instruir: "Use estas animacoes padrao. Nao invente animacoes customizadas a menos que o usuario peca."

---

## 3. Templates de Landing Page Pre-Configurados

**Problema**: Gerar uma landing page boa do zero demora e o resultado varia muito.

**Solucao**: Criar templates de landing page como ponto de partida na interface do bolt.

- Templates disponiveis na tela inicial (junto com "Build a todo app", etc.):
  - **SaaS Landing**: Hero + Features + Pricing + FAQ + CTA
  - **Portfolio**: Hero + Projects grid + About + Contact
  - **E-commerce**: Hero + Products + Categories + Cart
  - **Blog/Content**: Hero + Featured + Grid + Newsletter
  - **Agency**: Hero + Services + Cases + Team + Contact
- Cada template inclui:
  - Estrutura HTML semantica
  - Tailwind com design system consistente
  - Animacoes de scroll e entrada
  - Responsivo (mobile-first)
  - Dark/light mode
  - SEO meta tags
- Armazenar como GitHub repos template ou inline no codigo

---

## 4. Design System Tokens Injected no Prompt

**Problema**: O usuario configura cores e fontes no Design Scheme do bolt, mas o LLM nem sempre respeita.

**Solucao**: Melhorar a injecao do design scheme no system prompt.

- Converter o design scheme do usuario em CSS custom properties (`--primary`, `--accent`, etc.)
- Instruir o LLM a usar APENAS essas variaveis, nunca cores hardcoded
- Incluir escala tipografica padrao (h1-h6, body, caption)
- Incluir espacamento padrao (4px grid)
- Incluir border-radius padrao por tipo de componente
- Gerar um `theme.css` automaticamente que eh importado em todo projeto

---

## 5. Modo "Landing Page" com UX Otimizado

**Problema**: O usuario tem que descrever tudo no chat. Para landing pages, seria melhor um formulario guiado.

**Solucao**: Criar um modo especial "Generate Landing Page" na interface.

- Formulario step-by-step:
  1. **Tipo**: SaaS / Portfolio / E-commerce / Blog / Custom
  2. **Conteudo**: Nome, tagline, descricao, CTA text
  3. **Estilo**: Minimalista / Bold / Glassmorphism / Gradiente / Corporativo
  4. **Cores**: Picker com paletas pre-definidas ou custom
  5. **Secoes**: Drag-and-drop para ordenar secoes (Hero, Features, Pricing, etc.)
  6. **Extras**: Dark mode, animacoes, newsletter form, analytics
- O formulario gera um prompt otimizado que eh enviado ao LLM
- O usuario ve a preview em tempo real e pode iterar

---

## 6. Melhoria no Prompt de Design

**Problema**: O prompt atual menciona "Apple-level polish" mas nao da exemplos concretos.

**Solucao**: Adicionar instrucoes mais especificas de design no system prompt.

- Instrucoes de tipografia: hierarquia visual, line-height, letter-spacing
- Instrucoes de espacamento: secoes com padding generoso (py-20+), whitespace
- Instrucoes de cor: usar no maximo 3 cores + neutros, contrast ratio minimo
- Instrucoes de imagens: usar gradientes/patterns quando nao ha imagens, placeholder com unsplash
- Instrucoes de responsividade: breakpoints especificos, mobile-first
- Instrucoes de performance: lazy loading, font-display swap, image optimization
- Instrucoes de acessibilidade: aria-labels, focus visible, skip navigation

---

## 7. Componentes Interativos Pre-Built

**Problema**: O LLM muitas vezes gera componentes interativos com bugs (modals, dropdowns, tabs).

**Solucao**: Incluir implementacoes prontas e testadas de componentes interativos.

- Modal/Dialog com focus trap e ESC
- Dropdown menu com keyboard navigation
- Tabs com aria-tablist
- Accordion/Collapsible
- Toast notifications
- Tooltip
- Carousel/Slider
- Infinite scroll
- Search com debounce
- O prompt instrui o LLM a usar esses patterns em vez de reimplementar

---

## 8. "Style Guide" Auto-Gerado

**Problema**: Projetos gerados nao tem consistencia visual quando o usuario pede mudancas.

**Solucao**: O bolt gera automaticamente um style guide apos criar o projeto.

- Arquivo `STYLE_GUIDE.md` gerado com:
  - Paleta de cores utilizada
  - Tipografia (fontes, tamanhos, pesos)
  - Espacamento padrao
  - Componentes e suas variantes
  - Animacoes utilizadas
- O LLM consulta esse style guide em iteracoes futuras
- Garante que mudancas posteriores mantêm consistencia

---

## 9. Preview com Device Frames

**Problema**: O preview mostra a pagina crua, sem contexto de como fica num celular ou tablet.

**Solucao**: Adicionar device frames no preview.

- Toggle para ver preview em: Desktop / Tablet / Mobile
- Device frames visuais (iPhone, iPad, MacBook)
- Zoom controls
- Landscape/Portrait toggle para mobile

---

## 10. Export Melhorado

**Problema**: O codigo gerado eh exportado como esta, sem otimizacao.

**Solucao**: Adicionar opcoes de export otimizado.

- Export como Next.js project (com SSR/SSG)
- Export como Vite + React
- Export como HTML estatico (single file, otimizado)
- Minificacao automatica
- Image optimization automatica
- Bundle analysis
- Lighthouse score no preview

---

## Prioridade Sugerida

| # | Melhoria | Impacto | Esforco |
|---|----------|---------|---------|
| 1 | Biblioteca de Componentes no Prompt | Alto | Medio |
| 2 | Preset de Animacoes | Alto | Baixo |
| 6 | Melhoria no Prompt de Design | Alto | Baixo |
| 3 | Templates de Landing Page | Alto | Medio |
| 4 | Design System Tokens | Medio | Baixo |
| 5 | Modo Landing Page | Alto | Alto |
| 7 | Componentes Interativos Pre-Built | Medio | Medio |
| 8 | Style Guide Auto-Gerado | Medio | Medio |
| 9 | Preview com Device Frames | Medio | Medio |
| 10 | Export Melhorado | Medio | Alto |

**Recomendacao**: Comecar pelos itens 2, 6, 1 (alto impacto, baixo/medio esforco) — sao mudancas no system prompt que melhoram drasticamente a qualidade do output sem grandes mudancas no codigo do bolt.
