// app/entry.server.tsx
// Importa o bridge para garantir que as variáveis de ambiente sejam transferidas corretamente
import '~/utils/env-bridge.server';

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
  // Log para verificar as variáveis de ambiente sem expor seus valores
  console.log('Entry server environment check:');
  console.log('- SUPABASE_URL in process.env:', !!process.env.SUPABASE_URL);
  console.log('- SUPABASE_ANON_KEY in process.env:', !!process.env.SUPABASE_ANON_KEY);
  
  if (typeof globalThis.env !== 'undefined') {
    console.log('- SUPABASE_URL in globalThis.env:', !!globalThis.env.SUPABASE_URL);
    console.log('- SUPABASE_ANON_KEY in globalThis.env:', !!globalThis.env.SUPABASE_ANON_KEY);
  }

  // Cria o stream do componente React
  const stream = await renderToReadableStream(
    <RemixServer context={remixContext} url={request.url} />,
    {
      signal: request.signal,
      onError(error: unknown) {
        console.error(error);
        responseStatusCode = 500;
      },
    }
  );
  // Aguarda o stream ficar pronto para bots
  if (isbot(request.headers.get('user-agent') || '')) {
    await stream.allReady;
  }
  // Define os headers apropriados
  responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Cria um transform stream para injetar a estrutura HTML e DOCTYPE
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
  // Encaminha o stream React pelo transformer
  const responseStream = stream.pipeThrough(transformStream);
  return new Response(responseStream, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
