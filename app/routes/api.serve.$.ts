import type { LoaderFunctionArgs } from '@remix-run/cloudflare';

const DEPLOY_SERVICE_URL = process.env.DEPLOY_SERVICE_URL || 'http://deploy-service:3300';

export async function loader({ request }: LoaderFunctionArgs) {
  const slug = request.headers.get('X-App-Slug');
  if (!slug) {
    return new Response('Not found', { status: 404 });
  }

  // Get the file path from the URL
  const url = new URL(request.url);
  const filePath = url.pathname === '/' ? '/index.html' : url.pathname;

  // Proxy to deploy-service
  const res = await fetch(`${DEPLOY_SERVICE_URL}/serve/${slug}${filePath}`);

  if (!res.ok) {
    // SPA fallback - try index.html
    const fallback = await fetch(`${DEPLOY_SERVICE_URL}/serve/${slug}/index.html`);
    if (fallback.ok) {
      return new Response(fallback.body, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }
    return new Response('App not found', { status: 404 });
  }

  // Forward the response with proper headers
  const contentType = res.headers.get('Content-Type') || 'application/octet-stream';
  return new Response(res.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': contentType.includes('html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    },
  });
}
