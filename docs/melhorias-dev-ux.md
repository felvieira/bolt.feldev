# Melhorias para Dev UX, Interfaces, Animacoes e Landing Pages

---

## 1. Context7/MCP para Componentes e Templates Atualizados (PRIORIDADE MAXIMA)

**Problema**: Injetar snippets estaticos no prompt fica desatualizado. Bibliotecas como Magic UI, Aceternity e shadcn lancam componentes novos toda semana.

**Solucao**: Usar o MCP Context7 (ja integrado no bolt) para buscar documentacao atualizada das bibliotecas no momento da geracao.

### Fontes de Componentes Premium

**Bibliotecas de Componentes com Animacoes:**
- **Magic UI** (magicui.design) — marquee, bento grid, animated beam, globe, particles, blur fade, dock
- **Aceternity UI** (ui.aceternity.com) — spotlight, aurora, 3D cards, text effects, parallax scroll, meteors
- **shadcn/ui** (ui.shadcn.com) — base solida de componentes headless, extensivel
- **React Bits** (reactbits.dev) — animacoes e micro-interacoes
- **HyperUI** (hyperui.dev) — componentes Tailwind gratuitos
- **UIVerse** (uiverse.io) — botoes, cards, loaders com CSS puro

**Templates de Landing Page Open Source:**
- **Taxonomy** (shadcn) — SaaS template completo Next.js
- **HyperUI** — layouts de landing page prontos
- **Cruip** — templates React/Next.js para SaaS
- **Tailwind Starter Kit** — layouts prontos

### Como Implementar

1. **Configurar resolucao de bibliotecas no Context7**:
   - Quando o usuario pede uma landing page, o bolt resolve os IDs das bibliotecas via `resolve-library-id`
   - Busca docs atualizadas via `query-docs` para Magic UI, Aceternity, shadcn
   - Injeta os snippets relevantes no contexto do LLM

2. **Prompt inteligente que seleciona componentes**:
   - O system prompt instrui o LLM: "Quando gerar landing pages ou interfaces, consulte os componentes disponíveis via Context7 antes de criar do zero"
   - O LLM recebe a doc atualizada e usa os componentes reais da biblioteca
   - Resultado: codigo que usa imports reais (nao copia/cola) e esta sempre atualizado

3. **Mapping de intencao → biblioteca**:
   - "landing page" → Magic UI + Aceternity (hero sections, animacoes)
   - "dashboard" → shadcn/ui (tabelas, charts, forms)
   - "e-commerce" → shadcn/ui + Magic UI (product cards, carousels)
   - "portfolio" → Aceternity (3D effects, parallax)

---

## 2. Prompt Engineering para Landing Pages, SEO e Conversoes

**Problema**: O prompt atual foca em "codigo bonito" mas nao em resultados de negocio. Landing pages precisam converter, nao so ser bonitas.

**Solucao**: Adicionar instrucoes especificas de marketing/conversao no system prompt.

### Instrucoes de SEO

- Estrutura semantica: h1 unico, h2-h6 hierarquicos, meta description, title tag
- Open Graph e Twitter Cards meta tags
- Schema.org JSON-LD (Organization, Product, FAQ, BreadcrumbList)
- Canonical URL, hreflang para multi-idioma
- Performance: Core Web Vitals (LCP, FID, CLS) — lazy loading, font-display, image sizing
- Sitemap.xml e robots.txt template
- Alt text descritivo em todas as imagens
- URLs semanticas (slug-based)

### Instrucoes de Conversao (CRO)

- **Above the fold**: Headline + subheadline + CTA visivel sem scroll
- **Hierarquia visual**: F-pattern ou Z-pattern de leitura
- **CTAs**: Cor contrastante, texto acionavel ("Comece gratis" > "Saiba mais"), posicao repetida
- **Social proof**: Depoimentos, logos de clientes, numeros ("+10.000 usuarios")
- **Urgencia/Escassez**: Badges ("Mais popular"), timers, "Vagas limitadas"
- **Trust signals**: Selo SSL, garantia, logos de pagamento, politica de privacidade
- **Formularios**: Minimo de campos, validacao inline, progress indicator
- **Pricing**: 3 planos max, destaque no recomendado, toggle mensal/anual, ancoragem de preco

### Instrucoes de Marketing

- **Copywriting**: Beneficios > features, linguagem do usuario, verbos de acao
- **Storytelling**: Problema → Solucao → Resultado
- **Microcopy**: Labels claros, mensagens de erro uteis, empty states engajantes
- **Analytics-ready**: IDs em CTAs para tracking, data attributes para eventos, GTM-ready
- **A/B Testing**: Estrutura que permite variantes facilmente

### Secoes de Landing Page (ordem otimizada para conversao)

1. Hero (headline + CTA + visual)
2. Social proof (logos, numeros)
3. Problema/Dor
4. Solucao (features com beneficios)
5. Como funciona (3 passos)
6. Depoimentos
7. Pricing
8. FAQ
9. CTA final

---

## 3. Integracao com fal.ai para Geracao de Imagens

**Problema**: Landing pages precisam de imagens (hero, features, team, products) mas o LLM so gera codigo. O usuario precisa buscar imagens manualmente ou usar placeholders genericos.

**Solucao**: Integrar fal.ai como provider de imagens no bolt, gerando imagens automaticamente durante o build.

### Como Funciona

1. **Provider de imagens no bolt**:
   - Novo provider em `app/lib/modules/image/fal-provider.ts`
   - Configuracao de API key via settings (igual LLM providers)
   - Modelos: FLUX.1 [schnell] (rapido), FLUX.1 [dev] (qualidade), Stable Diffusion XL

2. **Integracao no fluxo de geracao**:
   - Quando o LLM gera uma landing page, ele usa uma action especial `<boltAction type="image">` com:
     - `prompt`: descricao da imagem desejada
     - `style`: "photo", "illustration", "3d", "icon", "abstract"
     - `size`: "hero" (1920x1080), "feature" (800x600), "avatar" (400x400), "icon" (256x256)
     - `placement`: onde no HTML a imagem sera inserida
   - O bolt intercepta essa action, chama fal.ai, recebe a imagem, salva no WebContainer
   - O HTML gerado referencia a imagem local

3. **Casos de uso**:
   - **Hero images**: Geradas com base no produto/servico descrito
   - **Feature illustrations**: Icones ou ilustracoes para cada feature
   - **Team/Avatar**: Fotos de perfil para secoes de equipe (com consentimento)
   - **Product mockups**: Screenshots ou mockups do produto
   - **Backgrounds**: Gradientes, patterns, texturas abstratas
   - **Blog thumbnails**: Imagens para posts de blog

4. **Fallback inteligente**:
   - Se fal.ai nao esta configurado: usar gradientes CSS, SVG patterns, ou Unsplash URLs
   - Se a geracao falha: placeholder com descricao alt text
   - Cache de imagens geradas para reutilizacao

5. **UI no bolt**:
   - Indicador de progresso "Generating image..." durante o build
   - Galeria de imagens geradas com opcao de regenerar
   - Ajuste de prompt da imagem sem regenerar o codigo

### API fal.ai

```
Endpoint: https://fal.run/fal-ai/flux/schnell
Headers: Authorization: Key $FAL_KEY
Body: { "prompt": "...", "image_size": "landscape_16_9", "num_images": 1 }
```

---

## 4. Preset de Animacoes no System Prompt

**Problema**: O LLM gera animacoes inconsistentes ou basicas demais.

**Solucao**: Definir uma biblioteca de animacoes padrao no prompt + buscar via Context7 os patterns mais recentes do Magic UI/Aceternity.

- Animacoes de entrada: fade-in, slide-up, scale-in, blur-in (com stagger para listas)
- Micro-interacoes: hover lift, button press, ripple, shimmer loading
- Scroll-triggered: reveal on scroll, parallax, counter animation
- Page transitions: crossfade, slide, morph
- Skeleton loading states para todo conteudo assincrono
- Instrucao: "Busque animacoes via Context7 para Magic UI/Aceternity antes de implementar"

---

## 5. Design System Tokens no Prompt

**Problema**: O usuario configura cores e fontes no Design Scheme do bolt, mas o LLM nem sempre respeita.

**Solucao**: Melhorar a injecao do design scheme no system prompt.

- Converter o design scheme do usuario em CSS custom properties
- Instruir o LLM a usar APENAS essas variaveis, nunca cores hardcoded
- Escala tipografica padrao (h1-h6, body, caption)
- Espacamento padrao (4px/8px grid)
- Border-radius padrao por tipo de componente
- Gerar `theme.css` automaticamente

---

## 6. Melhoria no Prompt de Design

**Problema**: O prompt atual menciona "Apple-level polish" mas nao da exemplos concretos.

**Solucao**: Adicionar instrucoes especificas e acionaveis.

- Tipografia: hierarquia visual, line-height 1.5-1.75, letter-spacing
- Espacamento: secoes com padding generoso (py-20+), whitespace
- Cor: max 3 cores + neutros, contrast ratio WCAG AA
- Imagens: gradientes/patterns quando nao ha imagens, ou gerar via fal.ai
- Responsividade: breakpoints especificos, mobile-first
- Performance: lazy loading, font-display swap, image optimization
- Acessibilidade: aria-labels, focus visible, skip navigation

---

## 7. Templates de Landing Page Pre-Configurados

**Problema**: Gerar landing page do zero demora e o resultado varia.

**Solucao**: Templates como ponto de partida na tela inicial do bolt.

- Templates na tela inicial:
  - **SaaS Landing**: Hero + Features + Pricing + FAQ + CTA
  - **Portfolio**: Hero + Projects grid + About + Contact
  - **E-commerce**: Hero + Products + Categories + Cart
  - **Blog/Content**: Hero + Featured + Grid + Newsletter
  - **Agency**: Hero + Services + Cases + Team + Contact
- Cada template usa componentes do Magic UI/Aceternity via Context7
- Responsivo, dark/light mode, SEO-ready, animacoes incluidas

---

## 8. Modo "Landing Page" com UX Guiado

**Problema**: O usuario tem que descrever tudo no chat.

**Solucao**: Formulario step-by-step para landing pages.

- Passos:
  1. Tipo: SaaS / Portfolio / E-commerce / Blog / Custom
  2. Conteudo: Nome, tagline, descricao, CTA text
  3. Estilo: Minimalista / Bold / Glassmorphism / Gradiente / Corporativo
  4. Cores: Picker com paletas pre-definidas ou custom
  5. Secoes: Drag-and-drop para ordenar
  6. Imagens: Gerar via fal.ai ou usar placeholders
  7. SEO: Keywords, meta description, schema type
- Gera prompt otimizado enviado ao LLM com Context7

---

## 9. Componentes Interativos Pre-Built

**Problema**: O LLM gera componentes interativos com bugs.

**Solucao**: Incluir implementacoes testadas via Context7 (shadcn/ui).

- Modal/Dialog com focus trap e ESC
- Dropdown menu com keyboard navigation
- Tabs com aria-tablist
- Accordion/Collapsible
- Toast notifications
- Tooltip, Carousel, Search com debounce
- Context7 busca a versao mais recente do shadcn/ui

---

## 10. "Style Guide" Auto-Gerado

**Problema**: Projetos gerados perdem consistencia visual ao iterar.

**Solucao**: Gerar `STYLE_GUIDE.md` automaticamente.

- Paleta de cores utilizada
- Tipografia (fontes, tamanhos, pesos)
- Espacamento padrao
- Componentes e variantes
- Animacoes utilizadas
- O LLM consulta em iteracoes futuras

---

## 11. Preview com Device Frames

**Problema**: Preview sem contexto de dispositivo.

**Solucao**: Device frames no preview.

- Toggle: Desktop / Tablet / Mobile
- Device frames visuais (iPhone, iPad, MacBook)
- Zoom controls, Landscape/Portrait toggle

---

## 12. Export Melhorado

**Problema**: Codigo exportado sem otimizacao.

**Solucao**: Opcoes de export.

- Next.js (SSR/SSG), Vite + React, HTML estatico
- Minificacao, image optimization, bundle analysis
- Lighthouse score no preview

---

## Prioridade Sugerida (Atualizada)

| # | Melhoria | Impacto | Esforco | Categoria |
|---|----------|---------|---------|-----------|
| 1 | Context7/MCP para componentes atualizados | Muito Alto | Medio | Infra |
| 2 | Prompt de SEO/Conversao/Marketing | Muito Alto | Baixo | Prompt |
| 3 | Integracao fal.ai para imagens | Muito Alto | Medio | Feature |
| 4 | Preset de Animacoes | Alto | Baixo | Prompt |
| 6 | Melhoria no Prompt de Design | Alto | Baixo | Prompt |
| 5 | Design System Tokens | Medio | Baixo | Prompt |
| 7 | Templates de Landing Page | Alto | Medio | Feature |
| 8 | Modo Landing Page guiado | Alto | Alto | Feature |
| 9 | Componentes Interativos | Medio | Medio | Prompt |
| 10 | Style Guide Auto-Gerado | Medio | Medio | Feature |
| 11 | Preview com Device Frames | Medio | Medio | UI |
| 12 | Export Melhorado | Medio | Alto | Feature |

**Recomendacao**: Comecar por 2 (prompt SEO/conversao — esforco baixo, impacto imediato), depois 1 (Context7 — ja tem infra pronta), depois 3 (fal.ai — diferencial competitivo enorme).

**Stack de integracao**:
- Context7 MCP → Magic UI, Aceternity UI, shadcn/ui docs
- fal.ai API → FLUX.1 schnell/dev para geracao de imagens
- System prompt → instrucoes de SEO, CRO, copywriting, marketing
