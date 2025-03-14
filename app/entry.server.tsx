// app/entry.server.tsx
// Import environment bridge - ajustado para .mjs (se necessário)
import './utils/env-bridge.server'; 

import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import * as ReactDOMServer from 'react-dom/server';
import { Head } from './root';
import { themeStore } from './lib/stores/theme';

// Standard renderHeadToString implementation for use with remix-island
// Adapted from remix-island source to avoid import issues
function renderHeadToString({ request, remixContext, Head }) {
  const markup = ReactDOMServer.renderToString(
    <Head />
  );
  return markup;
}

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

  // For bots, use standard renderToString for optimal SEO
  if (isbot(request.headers.get("User-Agent"))) {
    const body = await ReactDOMServer.renderToString(
      <RemixServer context={remixContext} url={request.url} />
    );
    
    const html = `<!DOCTYPE html>
<html lang="en" data-theme="${themeStore.value}">
<head>${renderHeadToString({ request, remixContext, Head })}</head>
<body><div id="root" class="w-full h-full">${body}</div></body>
</html>`;

    return new Response(html, {
      headers: {
        ...Object.fromEntries(responseHeaders),
        'Content-Type': 'text/html',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
      status: responseStatusCode,
    });
  }

  // For normal browsers, use standard renderToString for initial content
  // Avoid the stream rendering that's causing issues
  let body;
  try {
    body = await ReactDOMServer.renderToString(
      <RemixServer context={remixContext} url={request.url} />
    );
  } catch (error) {
    console.error("Error rendering app:", error);
    // If we fail to render, return a basic shell
    body = "";
    responseStatusCode = 500;
  }

  const headMarkup = renderHeadToString({ request, remixContext, Head });
  
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="${themeStore.value}">
<head>${headMarkup}</head>
<body><div id="root" class="w-full h-full">${body}</div></body>
</html>`;

  return new Response(html, {
    headers: {
      ...Object.fromEntries(responseHeaders),
      'Content-Type': 'text/html',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    status: responseStatusCode,
  });
}
