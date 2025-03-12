// app/entry.server.tsx
// Import environment bridge 
import './utils/env-bridge.server.js';

import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import * as ReactDOMServer from 'react-dom/server';
// Import renderHeadToString properly to fix the "not defined" error
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

  let didError = false;

  // Use standard Remix approach for rendering
  const instance = <RemixServer context={remixContext} url={request.url} />;
  
  // Use renderToString for simplicity, avoiding stream issues
  let html = ReactDOMServer.renderToString(instance);

  // Set response headers
  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Render the head portion with remix-island
  const head = renderHeadToString({ request, remixContext, Head });

  // Create the full HTML document
  const doctype = '<!DOCTYPE html>\n';
  const htmlOpen = `<html lang="en" data-theme="${themeStore.value}">\n`;
  const headHtml = `<head>${head}</head>\n`;
  const bodyOpen = '<body><div id="root" class="w-full h-full">';
  const bodyClose = '</div></body></html>';

  // Return the complete HTML with the rendered app content
  return new Response(
    doctype + htmlOpen + headHtml + bodyOpen + html + bodyClose,
    {
      headers: responseHeaders,
      status: responseStatusCode,
    }
  );
}
