import { json } from '@remix-run/node';
import { type Request, type Response } from 'express';
import { createApiHandler, handleApiError } from '~/utils/api-utils.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

// Handle all HTTP methods
export const action = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
  const path = request.params['*'];
  return handleProxyRequest(request, response, path);
});

export const loader = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
  const path = request.params['*'];
  return handleProxyRequest(request, response, path);
});

async function handleProxyRequest(request: Request, response: Response, path: string | undefined) {
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
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.setHeader(key, value);
      });
      response.status(204).end();
      return response;
    }

    // Forward the response headers
    const headers = Array.from(fetchResponse.headers.entries());
    headers.forEach(([key, value]) => {
      response.setHeader(key, value);
    });

    // Add CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.setHeader(key, value);
    });

    // Set status code
    response.status(fetchResponse.status);

    // Stream the response body
    const data = await fetchResponse.arrayBuffer();
    response.end(Buffer.from(data));
    
    return response;
  } catch (error) {
    console.error('Git proxy error:', error);
    return handleApiError(error, 500);
  }
}
