/**
 * Context7 Runtime Client — C1
 *
 * Calls the Context7 REST API at runtime to fetch real, up-to-date component
 * documentation for libraries detected in the user message. Falls back
 * gracefully (returns empty string) on any failure so static component-hints
 * remain the baseline.
 *
 * Enable by setting CONTEXT7_ENABLED=true in the environment.
 */

import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('context7-client');

/** Libraries to look up per detected intent keyword */
const INTENT_TO_LIBRARIES: Record<string, string[]> = {
  landing: ['magicui', 'aceternity-ui', 'shadcn-ui'],
  dashboard: ['shadcn-ui', 'recharts'],
  portfolio: ['aceternity-ui', 'framer-motion'],
  ecommerce: ['shadcn-ui', 'stripe'],
  form: ['react-hook-form', 'zod'],
  animation: ['framer-motion', 'gsap'],
  chart: ['recharts'],
  table: ['shadcn-ui'],
};

/** Explicit library name mentions that map to Context7 library IDs */
const EXPLICIT_LIBRARY_MENTIONS: [RegExp, string][] = [
  [/\btailwind/i, 'tailwindcss'],
  [/\bshadcn/i, 'shadcn-ui'],
  [/\bmagic\s*ui/i, 'magicui'],
  [/\bframer/i, 'framer-motion'],
  [/\brecharts/i, 'recharts'],
  [/\breact.hook.form/i, 'react-hook-form'],
  [/\bzod\b/i, 'zod'],
  [/\bgsap/i, 'gsap'],
  [/\baceternity/i, 'aceternity-ui'],
];

const CONTEXT7_BASE = 'https://context7.com/api/v1';

function extractTopic(message: string, library: string): string {
  if (library.includes('shadcn')) return 'components usage examples';
  if (library.includes('magic')) return 'animated components hero sections';
  if (library.includes('aceternity')) return 'ui components animations';
  if (library.includes('framer')) return 'animation variants transitions';
  if (library.includes('recharts')) return 'chart components responsive';
  if (library.includes('hook-form')) return 'useForm register validation';
  if (library.includes('zod')) return 'schema validation parse';
  if (library.includes('tailwind')) return 'utility classes responsive dark mode';
  return 'getting started components';
}

function detectLibraries(message: string): string[] {
  const msg = message.toLowerCase();
  const matched: string[] = [];

  for (const [intent, libs] of Object.entries(INTENT_TO_LIBRARIES)) {
    if (msg.includes(intent)) {
      matched.push(...libs);
    }
  }

  for (const [pattern, lib] of EXPLICIT_LIBRARY_MENTIONS) {
    if (pattern.test(message)) {
      matched.push(lib);
    }
  }

  return [...new Set(matched)].slice(0, 3);
}

/**
 * Fetch real documentation snippets from Context7 for libraries detected in
 * the user message. Returns a prompt-injectable string, or empty string on
 * failure / no matches.
 *
 * Total wall-clock time is bounded: each HTTP call has an individual timeout
 * and we cap at 3 libraries, so worst-case is ~13 s (but typically <3 s).
 */
export async function getContext7Docs(userMessage: string, env?: any): Promise<string> {
  // Gate: only run when explicitly enabled
  const enabled = env?.CONTEXT7_ENABLED ?? (typeof process !== 'undefined' && process.env?.CONTEXT7_ENABLED);

  if (!enabled || enabled === 'false') {
    return '';
  }

  const libraries = detectLibraries(userMessage);

  if (libraries.length === 0) {
    return '';
  }

  logger.info(`Context7: resolving docs for [${libraries.join(', ')}]`);

  const results: string[] = [];

  for (const lib of libraries) {
    try {
      // 1. Resolve library ID
      const resolveRes = await fetch(`${CONTEXT7_BASE}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryName: lib }),
        signal: AbortSignal.timeout(5000),
      });

      if (!resolveRes.ok) {
        logger.warn(`Context7 resolve failed for "${lib}": ${resolveRes.status}`);
        continue;
      }

      const resolveData = (await resolveRes.json()) as { libraryId?: string };
      const { libraryId } = resolveData;

      if (!libraryId) {
        continue;
      }

      // 2. Query docs
      const topic = extractTopic(userMessage, lib);
      const docsRes = await fetch(`${CONTEXT7_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId, query: topic, maxTokens: 2000 }),
        signal: AbortSignal.timeout(8000),
      });

      if (!docsRes.ok) {
        logger.warn(`Context7 query failed for "${lib}": ${docsRes.status}`);
        continue;
      }

      const docsData = (await docsRes.json()) as { content?: string };

      if (docsData.content) {
        results.push(`### ${lib}\n${docsData.content}`);
        logger.info(`Context7: got docs for "${lib}" (${docsData.content.length} chars)`);
      }
    } catch (err: any) {
      // Timeout or network error — skip, don't block
      logger.warn(`Context7 error for "${lib}": ${err?.message ?? err}`);
      continue;
    }
  }

  if (results.length === 0) {
    return '';
  }

  return `\n<context7_docs>\nThe following are real, up-to-date documentation snippets for relevant libraries. Use these patterns and APIs:\n\n${results.join('\n\n')}\n</context7_docs>`;
}
