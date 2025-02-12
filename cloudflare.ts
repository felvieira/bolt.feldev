// cloudflare.ts
import { createRequestHandler } from '@remix-run/cloudflare-pages';
import * as build from '@remix-run/dev/server-build';

addEventListener('fetch', (event) => {
  event.respondWith(
    createRequestHandler({
      build,
      mode: process.env.NODE_ENV,
    })(event.request, event)
  );
});
