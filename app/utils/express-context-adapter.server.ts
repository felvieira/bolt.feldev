// app/utils/express-context-adapter.server.ts
import type { Request, Response } from 'express';

/**
 * Express application context with environment variables and request/response objects
 */
export interface ExpressAppContext {
  env: Record<string, string | undefined>;
  req?: Request;
  res?: Response;
}

/**
 * Creates an Express context object that's compatible with Remix loader functions
 * This maintains compatibility between Remix/Cloudflare and Express environments
 * 
 * @param req Express request object
 * @param res Express response object
 * @returns Context object with environment variables and request/response objects
 */
export function createExpressContext(req?: Request, res?: Response): ExpressAppContext {
  // Get environment variables from process.env
  const env = { ...process.env };
  
  // Add request and response objects if available
  return {
    env,
    req,
    res,
  };
}

/**
 * Gets an environment variable from the context
 * Falls back to process.env and globalThis.env if not found in context
 * 
 * @param context Express context object or undefined
 * @param key Environment variable name
 * @returns Environment variable value or undefined
 */
export function getEnvVar(context: ExpressAppContext | undefined, key: string): string | undefined {
  // Try to get from context
  if (context?.env && context.env[key] !== undefined) {
    return context.env[key];
  }
  
  // Fall back to process.env
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  
  // Fall back to globalThis.env
  if (typeof globalThis !== 'undefined' && globalThis.env && (globalThis.env as any)[key] !== undefined) {
    return (globalThis.env as any)[key];
  }
  
  // Not found
  return undefined;
}
