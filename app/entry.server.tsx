import type { AppLoadContext } from '@remix-run/cloudflare';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';
import crypto from 'crypto';

interface Env {
  SESSION_SECRET?: string;
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
    console.warn("WARNING: SESSION_SECRET not found in environment! Using a randomly generated value for this session only.");
    console.warn("Sessions will not persist across application restarts!");
    
    try {
      // Generate a random session secret as fallback
      sessionSecret = crypto.randomBytes(32).toString('hex');
      
      // Try to set it in the environment if possible
      if (typeof process !== 'undefined' && process.env) {
        process.env.SESSION_SECRET = sessionSecret;
      }
      
      console.log("Generated temporary SESSION_SECRET for this session");
    } catch (error) {
      console.error("Error generating fallback SESSION_SECRET:", error);
      
      // Last resort fallback
      sessionSecret = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
      console.log("Using simple random string as SESSION_SECRET fallback");
    }
  } else {
    console.log("SESSION_SECRET status: Set ✓");
  }

  const readable = await renderToReadableStream(<RemixServer context={remixContext} url={request.url} />, {
    signal: request.signal,
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  const body = new ReadableStream({
    start(controller) {
      const head = renderHeadToString({ request, remixContext, Head });

      controller.enqueue(
        new Uint8Array(
          new TextEncoder().encode(
            `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
          ),
        ),
      );

      const reader = readable.getReader();

      function read() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.enqueue(new Uint8Array(new TextEncoder().encode('</div></body></html>')));
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

  if (isbot(request.headers.get('user-agent') || '')) {
    await readable.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}