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
 */
export function createApiHandler(
  handler: (context: ExpressAppContext, request: Request, response: Response) => Promise<Response>
) {
  return async function apiHandler(args: { context: ExpressAppContext, request: Request, params: any }) {
    try {
      const { context, request } = args;
      const response = context.res || new Response();
      
      return await handler(context, request, response);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
