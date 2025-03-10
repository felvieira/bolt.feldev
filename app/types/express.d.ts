// app/types/express.d.ts
import type { Request, Response } from 'express';
import type { Session } from 'express-session';

// Express session augmentation
declare module 'express-session' {
  interface SessionData {
    access_token?: string;
    user_id?: string;
  }
}

// Define the load context for the Express adapter
declare module '@remix-run/express' {
  interface AppLoadContext {
    env: Record<string, string | undefined>;
    req: Request;
    res: Response;
    cloudflare?: {
      env: Record<string, string | undefined>;
    };
  }
}

// For backward compatibility with Cloudflare-based code
declare module '@remix-run/node' {
  interface AppLoadContext {
    env: Record<string, string | undefined>;
    req: Request;
    res: Response;
    cloudflare?: {
      env: Record<string, string | undefined>;
    };
  }
}
