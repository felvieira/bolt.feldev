/**
 * Component Hints — C1
 *
 * Detects UI-building intent from the user message and injects curated
 * component-library guidance into the system prompt so the LLM produces
 * higher-quality, design-system-aligned output on the first try.
 */

interface HintRule {
  /** Regex tested against the lowercased user message */
  pattern: RegExp;
  /** Hint block injected when the pattern matches */
  hint: string;
}

const HINT_RULES: HintRule[] = [
  // ── Landing pages ──────────────────────────────────────────────
  {
    pattern: /\b(landing\s*page|hero\s*(section)?|pricing\s*(section|table|page)?|testimonial|cta|call.to.action|saas\s*(template|page)?)\b/,
    hint: `
**Landing Page Best Practices**
- Hero: full-width section with gradient or image background, large headline (h1, text-4xl to text-6xl), subheadline (text-lg to text-xl text-muted-foreground), and a prominent CTA button.
- Features grid: 3-4 cards with Lucide React icons (e.g. \`<Zap />\`, \`<Shield />\`, \`<Sparkles />\`), short title, one-liner description.
- Pricing: 3-tier card layout; highlight the recommended plan with a ring/border accent and "Popular" badge. Add a monthly/annual toggle with framer-motion AnimatePresence.
- Testimonials: avatar (rounded-full w-12 h-12), blockquote, name + role. Use a grid or horizontal scroll.
- FAQ: accordion using details/summary or a custom Accordion component with smooth height animation.
- Animations: fade-in on scroll (IntersectionObserver + opacity/translate transition), hover-lift on cards (hover:-translate-y-1 transition-transform), subtle gradient shifts.
- Always use Tailwind CSS utility classes. Prefer semantic section elements (<header>, <section>, <footer>).
`,
  },

  // ── Dashboards / Admin ─────────────────────────────────────────
  {
    pattern: /\b(dashboard|admin\s*panel|analytics|table|data\s*grid|chart|sidebar\s*nav|stat\s*card)\b/,
    hint: `
**Dashboard / Admin Panel Patterns**
- Layout: fixed or collapsible sidebar (w-64) with icon + label nav items; main content area with top header bar.
- Stat cards: grid of 4 cards each showing icon, metric value (text-2xl font-bold), label, and a trend indicator (up/down arrow + percentage in green/red).
- Charts: use the Recharts library (\`<LineChart>\`, \`<BarChart>\`, \`<PieChart>\`) — it works well inside WebContainer.
- Tables: use \`<table>\` with sticky header, alternating row colors, sortable column headers (click to toggle asc/desc), pagination controls, and a search/filter input.
- Consistent spacing scale: p-4/p-6 for card padding, gap-4/gap-6 for grids, rounded-lg + shadow-sm for cards.
`,
  },

  // ── Portfolio / Gallery / Creative ─────────────────────────────
  {
    pattern: /\b(portfolio|gallery|parallax|3d|creative|showcase|photography)\b/,
    hint: `
**Portfolio / Creative Site Patterns**
- Hero: full-viewport height (min-h-screen), large bold name/title with a subtle animated gradient text effect (bg-clip-text text-transparent bg-gradient-to-r).
- Project grid: masonry or CSS grid with hover overlay showing title + "View Project" link. Use aspect-ratio utilities for consistent thumbnails.
- Parallax: use CSS \`background-attachment: fixed\` for simple parallax or a lightweight scroll-based transform for sections.
- Smooth transitions between sections with IntersectionObserver fade-in.
- Use a minimal, sans-serif font stack (Inter, system-ui) and generous whitespace.
`,
  },

  // ── E-commerce ─────────────────────────────────────────────────
  {
    pattern: /\b(e-?commerce|product\s*(page|card|list)?|cart|checkout|shop|store\s*front)\b/,
    hint: `
**E-commerce UI Patterns**
- Product card: image (aspect-square object-cover rounded-lg), title, price (font-semibold), rating stars, "Add to Cart" button.
- Product page: image gallery (thumbnail strip + main image), title, price, size/color selectors, quantity input, description tabs.
- Cart: list of items with thumbnail, name, quantity stepper, line total, remove button. Sticky order summary sidebar.
- Checkout: multi-step form (Shipping → Payment → Review) with step indicator. Use form validation with clear error states.
- Search/filter sidebar: category checkboxes, price range slider, sort dropdown.
`,
  },

  // ── Animation / Motion ─────────────────────────────────────────
  {
    pattern: /\b(animation|animate|motion|framer|transition|micro.?interaction)\b/,
    hint: `
**Animation & Motion Patterns**
- Use Framer Motion for React: \`<motion.div initial={{...}} animate={{...}} transition={{...}}>\`.
- Common animations: fade-in (opacity 0→1), slide-up (y: 20→0), scale-in (scale: 0.95→1), stagger children (variants + staggerChildren).
- Page transitions: AnimatePresence + exit prop for route changes.
- Hover effects: whileHover={{ scale: 1.05 }} on cards/buttons.
- Scroll-triggered: useInView hook from framer-motion to animate elements as they enter viewport.
- Keep durations short (0.2-0.5s) and use ease-out or spring for natural feel.
- Prefer CSS transitions for simple hover/focus states; use Framer Motion for orchestrated sequences.
`,
  },

  // ── Forms ──────────────────────────────────────────────────────
  {
    pattern: /\b(form|input|login|signup|register|contact\s*form|wizard|multi.?step)\b/,
    hint: `
**Form UI Patterns**
- Input fields: labeled with <label>, consistent height (h-10), rounded-md border, focus ring (focus:ring-2 ring-ring).
- Validation: inline error messages below each field in text-sm text-destructive. Show success checkmark for valid fields.
- Login/signup: centered card (max-w-md mx-auto), logo at top, social login buttons, divider ("or continue with"), email/password fields, submit button full-width.
- Multi-step wizard: step indicator bar at top, "Back"/"Next" buttons, form state preserved across steps.
`,
  },

  // ── Blog / Content ─────────────────────────────────────────────
  {
    pattern: /\b(blog|article|post|content\s*page|markdown|cms|reading)\b/,
    hint: `
**Blog / Content Patterns**
- Article layout: max-w-prose mx-auto for readable line length (~65ch), generous line-height (leading-relaxed).
- Blog list: card grid or stacked list with featured image, title, excerpt, date, author avatar + name, read-time estimate.
- Typography: clear heading hierarchy (text-3xl for h1, text-2xl for h2, etc.), prose class for body content.
- Table of contents: sticky sidebar on desktop, collapsible on mobile, auto-generated from headings.
`,
  },
];

/**
 * Scan the user message for UI-building intent and return relevant component
 * hints to inject into the system prompt. Returns an empty string when no
 * intent is detected so callers can simply concatenate the result.
 */
export function getComponentHints(userMessage: string): string {
  const msg = userMessage.toLowerCase();
  const matched: string[] = [];

  for (const rule of HINT_RULES) {
    if (rule.pattern.test(msg)) {
      matched.push(rule.hint.trim());
    }
  }

  if (matched.length === 0) {
    return '';
  }

  return `\n<component_hints>\nThe following design guidance is relevant to what the user is asking for. Use these patterns as a starting point — adapt them to the specific request:\n\n${matched.join('\n\n')}\n</component_hints>\n`;
}
