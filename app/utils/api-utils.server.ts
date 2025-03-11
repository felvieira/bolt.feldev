// app/utils/api-utils.server.ts
import type { Request, Response } from 'express';
import { json } from '@remix-run/node';
import type { ExpressAppContext } from './express-context-adapter.server';

/**
 * Helper for handling API errors consistently across Express routes
 */
export function handleApiError(error: unknown, status = 500) {
  console.error('API Error:', error);
  
  if (error instanceof Error) {
    if (error.message?.includes('API key')) {
      return json(
        { error: 'Invalid or missing API key' },
        { status: 401, statusText: 'Unauthorized' }
      );
    }
    
    return json(
      { error: error.message },
      { status, statusText: getStatusText(status) }
    );
  }
  
  return json(
    { error: 'An unknown error occurred' },
    { status, statusText: getStatusText(status) }
  );
}

/**
 * Gets cookies from a request in a consistent manner
 */
export function getCookiesFromRequest(request: Request): Record<string, string> {
  // If using express-style request with cookies already parsed
  if (request.cookies && typeof request.cookies === 'object') {
    return request.cookies;
  }
  
  // Otherwise parse from cookie header (Remix/Cloudflare style)
  const cookieHeader = request.headers.get?.('Cookie') || request.headers?.['cookie'];
  
  if (!cookieHeader) {
    return {};
  }
  
  // Parse cookies from header
  return parseCookies(typeof cookieHeader === 'string' ? cookieHeader : '');
}

/**
 * Parses cookies from a cookie header string
 */
export function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const items = cookieHeader.split(';').map((cookie) => cookie.trim());

  items.forEach((item) => {
    const [name, ...rest] = item.split('=');

    if (name && rest) {
      const decodedName = decodeURIComponent(name.trim());
      const decodedValue = decodeURIComponent(rest.join('=').trim());
      cookies[decodedName] = decodedValue;
    }
  });

  return cookies;
}

/**
 * Returns an appropriate status text for common HTTP status codes
 */
function getStatusText(status: number): string {
  const statusTexts: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error'
  };
  
  return statusTexts[status] || 'Unknown Status';
}

/**
 * Creates a standardized function for Express API route handling
 * that properly handles both Express and Remix response patterns
 */
export function createApiHandler(
  handler: (context: ExpressAppContext, request: Request, response: Response) => Promise<Response | void>
) {
  return async function apiHandler(args: { context: ExpressAppContext, request: Request, params: any }) {
    try {
      const { context, request } = args;
      const response = context.res || new Response();
      
      // Call the handler function, which may return a Response or undefined
      const result = await handler(context, request, response);
      
      // If the handler returned nothing, assume it's using Express-style response methods
      // and has already handled sending the response
      if (!result) {
        // If response has already been sent via Express methods, just return it
        if (response.headersSent) {
          return response;
        }
        
        // If no response was actually sent (but handler didn't return a Response),
        // return a default Response to prevent hanging requests
        return new Response(null, { status: 204 });
      }
      
      // If handler returned a Response, use that (Remix-style)
      return result;
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Utility to help safely handle errors in Express route handlers
 * after Express has already sent headers
 * 
 * @param response Express response object
 * @param error The error that occurred
 */
export function handleStreamingError(response: Response, error: unknown) {
  console.error('Streaming API Error:', error);
  
  // Only try to send an error response if headers haven't been sent yet
  if (!response.headersSent) {
    if (error instanceof Error && error.message?.includes('API key')) {
      response.status(401).json({ error: 'Invalid or missing API key' });
    } else {
      response.status(500).json({ 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      });
    }
  } else {
    // Headers already sent, try to end the response with an error message
    try {
      response.write('\nError occurred during streaming: ' + 
        (error instanceof Error ? error.message : 'Unknown error'));
      response.end();
    } catch (e) {
      console.error('Failed to write error to already started stream:', e);
    }
  }
}
