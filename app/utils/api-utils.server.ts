// app/utils/api-utils.server.ts
import express from 'express';
import { json } from '@remix-run/node';
import type { ExpressAppContext } from './express-context-adapter.server';

// Use type em vez de importação direta
type Request = express.Request;
type Response = express.Response;

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
 * that wraps the handler to adapt it to Remix's loader/action pattern
 */
export function createApiHandler(
  handler: (context: ExpressAppContext, request: Request, response: Response) => Promise<any>
) {
  return async function apiHandler(args: { context: ExpressAppContext, request: Request, params: any }) {
    try {
      const { context, request } = args;
      
      // Better request body handling for both Express and Remix requests
      if (request.body && typeof request.body !== 'string' && !(request.body instanceof ReadableStream)) {
        request.body = JSON.stringify(request.body);
      }
      
      // Create a mock Express response object that doesn't actually send responses
      const mockResponse: Partial<Response> = {
        status: (code: number) => mockResponse,
        json: (data: any) => mockResponse,
        send: (data: any) => mockResponse,
        setHeader: (name: string, value: string) => mockResponse,
        headersSent: false,
        end: () => mockResponse,
        write: (chunk: any) => mockResponse
      };
      
      // Add request parameters from the route
      if (args.params) {
        (request as any).params = args.params;
      }

      // Call the handler with the mock response
      const result = await handler(context, request, mockResponse as Response);
      
      // Always return the result from the handler (which should be a Response object)
      return result;
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Convert Express-style response writing to a Remix-compatible Response
 * for streaming responses
 */
export function createStreamingResponse(content: ReadableStream, contentType = 'text/event-stream') {
  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
