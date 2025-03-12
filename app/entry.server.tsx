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

  // Set headers first
  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Render the head with remix-island
  let head;
  try {
    head = renderHeadToString({ request, remixContext, Head });
  } catch (error) {
    console.error("Error rendering head:", error);
    // Fallback if renderHeadToString fails
    head = `
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script>
        setTutorialKitTheme();
        function setTutorialKitTheme() {
          let theme = localStorage.getItem('bolt_theme');
          if (!theme) {
            theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }
          document.querySelector('html')?.setAttribute('data-theme', theme);
        }
      </script>
    `;
  }

  // Use a simple approach to server rendering
  // Avoiding stream issues with renderToPipeableStream
  let html;
  try {
    html = ReactDOMServer.renderToStaticMarkup(
      <RemixServer context={remixContext} url={request.url} />
    );
  } catch (error) {
    console.error("Error rendering app:", error);
    html = `<p>Error rendering the application. Please try again later.</p>`;
    responseStatusCode = 500;
  }

  // Create the full HTML document
  const document = `
<!DOCTYPE html>
<html lang="en" data-theme="${themeStore.value}">
<head>${head}</head>
<body><div id="root" class="w-full h-full">${html}</div></body>
</html>
  `.trim();

  // Return the HTML document
  return new Response(document, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
