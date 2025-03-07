// app/entry.server.tsx
import type { AppLoadContext } from '@remix-run/cloudflare';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
) {
  // Create the React component stream
  const stream = await renderToReadableStream(<RemixServer context={remixContext} url={request.url} />, {
    signal: request.signal,
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  // Wait for the stream to be ready for bots
  if (isbot(request.headers.get('user-agent') || '')) {
    await stream.allReady;
  }

  // Set the proper headers
  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Create a transformer stream to properly inject the DOCTYPE and HTML structure
  const transformStream = new TransformStream({
    start(controller) {
      // Render the head content
      const head = renderHeadToString({ request, remixContext, Head });
      
      // Make sure the DOCTYPE is the very first thing in the document
      controller.enqueue(new TextEncoder().encode('<!DOCTYPE html>\n'));
      controller.enqueue(new TextEncoder().encode(`<html lang="en" data-theme="${themeStore.value}">\n`));
      controller.enqueue(new TextEncoder().encode(`<head>${head}</head>\n`));
      controller.enqueue(new TextEncoder().encode('<body><div id="root" class="w-full h-full">'));
    },
    async transform(chunk, controller) {
      controller.enqueue(chunk);
    },
    flush(controller) {
      controller.enqueue(new TextEncoder().encode('</div></body></html>'));
    }
  });

  // Pipe the React stream through our transformer
  const responseStream = stream.pipeThrough(transformStream);

  return new Response(responseStream, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
