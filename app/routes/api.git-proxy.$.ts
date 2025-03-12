import { type Request, type Response } from 'express';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

// Handle all HTTP methods
export const action = async (args: { context: ExpressAppContext, request: Request }) => {
  const { createApiHandler } = await import('~/utils/api-utils.server');
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    const path = request.params['*'];
    return await handleProxyRequest(request, path);
  });
  
  return handler(args.context, args.request, args.context.res);
};

export const loader = async (args: { context: ExpressAppContext, request: Request }) => {
  const { createApiHandler } = await import('~/utils/api-utils.server');
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    const path = request.params['*'];
    return await handleProxyRequest(request, path);
  });
  
  return handler(args.context, args.request, args.context.res);
};

async function handleProxyRequest(request: Request, path: string | undefined) {
  // Import server modules inside the function
  const { json } = await import('@remix-run/node');
  const { handleApiError } = await import('~/utils/api-utils.server');
  
  try {
    if (!path) {
      return json({ error: 'Invalid proxy URL format' }, { status: 400 });
    }

    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    // Reconstruct the target URL
    const targetURL = `https://${path}${url.search}`;

    // Forward the request to the target URL
    const fetchResponse = await fetch(targetURL, {
      method: request.method,
      headers: {
        ...Object.fromEntries(
          Object.entries(request.headers)
            .filter(([key]) => key !== 'host' && key !== 'connection')
        ),

        // Override host header with the target host
        host: new URL(targetURL).host,
      },
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : 
            request.body ? 
              typeof request.body === 'string' ? 
                request.body : 
                JSON.stringify(request.body) : 
              undefined,
    });

    // Create response with CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Read response data
    const data = await fetchResponse.arrayBuffer();
    
    // Create response headers combining original headers with CORS headers
    const responseHeaders = new Headers();
    
    // Add original headers
    Array.from(fetchResponse.headers.entries()).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    
    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    
    // Return the final response with the appropriate status code
    return new Response(Buffer.from(data), {
      status: fetchResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Git proxy error:', error);
    return handleApiError(error, 500);
  }
}
