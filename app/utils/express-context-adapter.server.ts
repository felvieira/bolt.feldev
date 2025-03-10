// app/utils/express-context-adapter.server.ts
import type { Request, Response } from 'express';

/**
 * Creates a context object compatible with the existing codebase
 * that was originally designed for Cloudflare Pages.
 * 
 * This adapter allows for a smoother transition by maintaining
 * the expected structure while actually using Express.
 */
export function createExpressContext(req: Request, res: Response) {
  return {
    // Main context object
    env: process.env,
    req,
    res,
    
    // Legacy structure for cloudflare context
    cloudflare: {
      env: process.env
    }
  };
}

/**
 * Helper function to get environment variables consistently
 * Works with both the legacy Cloudflare context and the Express context
 */
export function getEnvVar(context: any, key: string): string | undefined {
  // Try context.env first (new Express pattern)
  if (context?.env && context.env[key] !== undefined) {
    return context.env[key];
  }
  
  // Try context.cloudflare.env (legacy Cloudflare pattern)
  if (context?.cloudflare?.env && context.cloudflare.env[key] !== undefined) {
    return context.cloudflare.env[key];
  }
  
  // Fall back to process.env
  return process.env[key];
}

/**
 * Type definition for the Express app context
 * This helps provide type safety while transitioning
 */
export interface ExpressAppContext {
  env: Record<string, string | undefined>;
  req: Request;
  res: Response;
  cloudflare?: {
    env: Record<string, string | undefined>;
  };
}

/**
 * Helper to get API keys consistently from the context
 */
export function getApiKey(context: any, key: string): string | undefined {
  return getEnvVar(context, key);
}

/**
 * Helper to check if an environment variable is set
 */
export function hasEnvVar(context: any, key: string): boolean {
  return !!getEnvVar(context, key);
}
