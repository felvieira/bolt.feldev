import type { AppLoadContext } from '@remix-run/cloudflare';
import { RemixServer } from '@remix-run/react';
import { renderToReadableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

interface Env {
  SESSION_SECRET?: string;
}

/**
 * Helper function to generate a random string using Web Crypto API
 * This works in Cloudflare Workers environment
 */
async function generateSecureRandom(length = 32) {
  // Create array of random values
  const array = new Uint8Array(length);

  // Fill with random values using Web Crypto API
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for extremely old browsers (should never happen in Cloudflare)
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  // Convert to hex string
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  loadContext: AppLoadContext,
) {
  const env = loadContext.env as Env;

  // Get SESSION_SECRET from the environment or context
  let sessionSecret = env?.SESSION_SECRET || process.env.SESSION_SECRET;

  // Fallback mechanism: Generate a random SESSION_SECRET if not found
  if (!sessionSecret) {
    console.warn(
      'WARNING: SESSION_SECRET not found in environment! Using a randomly generated value for this session only.',
    );
    console.warn('Sessions will not persist across application restarts!');

    try {
      // Generate a random session secret using Web Crypto API
      sessionSecret = await generateSecureRandom(32);

      // Try to set it in the environment if possible
      if (typeof process !== 'undefined' && process.env) {
        process.env.SESSION_SECRET = sessionSecret;
      }

      console.log('Generated temporary SESSION_SECRET for this session');
    } catch (error) {
      console.error('Error generating fallback SESSION_SECRET:', error);

      // Last resort fallback
      sessionSecret = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      console.log('Using simple random string as SESSION_SECRET fallback');
    }
  } else {
    console.log('SESSION_SECRET status: Set ✓');
  }

  const readable = await renderToReadableStream(<RemixServer context={remixContext} url={request.url} />, {
    signal: request.signal,
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  // Ensure proper content type with charset and force standards mode
  responseHeaders.set('Content-Type', 'text/html; charset=UTF-8');
  responseHeaders.set('X-UA-Compatible', 'IE=edge');
  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Create response with encoding declaration in HTML
  const body = new ReadableStream({
    start(controller) {
      const head = renderHeadToString({ request, remixContext, Head });
      const encoder = new TextEncoder();
      const initialHtml = encoder.encode(
        `<!DOCTYPE html>\n<html lang="en" data-theme="${themeStore.value}"><head><meta charset="utf-8" />${head}</head><body><div id="root" class="w-full h-full">`,
      );

      controller.enqueue(initialHtml);

      const reader = readable.getReader();

      function read() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              const endHtml = encoder.encode('</div></body></html>');
              controller.enqueue(endHtml);
              controller.close();

              return;
            }

            controller.enqueue(value);
            read();
          })
          .catch((error) => {
            controller.error(error);
            readable.cancel();
          });
      }
      read();
    },
    cancel() {
      readable.cancel();
    },
  });

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
