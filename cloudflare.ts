// cloudflare.ts
import { createRequestHandler } from '@remix-run/cloudflare';
import type { AppLoadContext } from '@remix-run/cloudflare';
import * as build from '@remix-run/dev/server-build';

const handleRequest = createRequestHandler(build);

export default {
  async fetch(request: Request, env: AppLoadContext): Promise<Response> {
    try {
      return await handleRequest(request);
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
