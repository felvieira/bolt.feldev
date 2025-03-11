// app/entry.server.tsx
// Import environment bridge 
import './utils/env-bridge.server.js';

import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import * as ReactDOMServer from 'react-dom/server';
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

  // Use renderToPipeableStream for modern SSR
  const { pipe, abort } = ReactDOMServer.renderToPipeableStream(
    <RemixServer context={remixContext} url={request.url} />,
    {
      onAllReady() {
        responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
        responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
        responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
      },
      onShellError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    }
  );

  // Create the full HTML document
  const head = renderHeadToString({ request, remixContext, Head });
  const doctype = '<!DOCTYPE html>\n';
  const htmlOpen = `<html lang="en" data-theme="${themeStore.value}">\n`;
  const headHtml = `<head>${head}</head>\n`;
  const bodyOpen = '<body><div id="root" class="w-full h-full">';
  const bodyClose = '</div></body></html>';

  // Combine into a single string
  const html = `${doctype}${htmlOpen}${headHtml}${bodyOpen}${bodyClose}`;

  // Return as a string
  return new Response(html, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
