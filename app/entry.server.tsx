// app/entry.server.tsx
// Import environment bridge 
import './utils/env-bridge.server.js';

import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from './lib/stores/theme';

export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  remixContext,
  loadContext
) {
  // Ensure we have access to Express context
  if (loadContext) {
    // Log environment variables status without exposing values
    console.log('Entry server environment check:');
    
    if (loadContext.env) {
      console.log('- SUPABASE_URL in loadContext.env:', !!loadContext.env.SUPABASE_URL);
      console.log('- SUPABASE_ANON_KEY in loadContext.env:', !!loadContext.env.SUPABASE_ANON_KEY);
    }
    
    // Make environment variables available globally
    if (typeof globalThis !== 'undefined' && !globalThis.env && loadContext.env) {
      globalThis.env = loadContext.env;
    }
  }

  // Create React stream
  const stream = await renderToReadableStream(
    <RemixServer context={remixContext} url={request.url} />,
    {
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    }
  );
  
  // Wait for stream to be ready for bots
  if (isbot(request.headers.get('user-agent') || '')) {
    await stream.allReady;
  }
  
  // Set appropriate headers
  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Create transform stream to inject HTML structure and DOCTYPE
  const transformStream = new TransformStream({
    start(controller) {
      const head = renderHeadToString({ request, remixContext, Head });
      controller.enqueue(new TextEncoder().encode('<!DOCTYPE html>\n'));
      controller.enqueue(
        new TextEncoder().encode(`<html lang="en" data-theme="${themeStore.value}">\n`)
      );
      controller.enqueue(new TextEncoder().encode(`<head>${head}</head>\n`));
      controller.enqueue(
        new TextEncoder().encode('<body><div id="root" class="w-full h-full">')
      );
    },
    async transform(chunk, controller) {
      controller.enqueue(chunk);
    },
    flush(controller) {
      controller.enqueue(new TextEncoder().encode('</div></body></html>'));
    },
  });
  
  // Pipe React stream through transformer
  const responseStream = stream.pipeThrough(transformStream);
  
  return new Response(responseStream, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
