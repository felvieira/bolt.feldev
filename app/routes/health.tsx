import express from 'express';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

// Use type em vez de importação direta
type Request = express.Request;
type Response = express.Response;

export const loader = async (args: { context: ExpressAppContext, request: Request }) => {
  // Dynamically import server modules
  const { json } = await import('@remix-run/node');
  const { createApiHandler } = await import('~/utils/api-utils.server');
  const { getEnvVar } = await import('~/utils/express-context-adapter.server');
  
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    // Check if SESSION_SECRET is set using the context adapter
    const sessionSecret = getEnvVar(context, 'SESSION_SECRET') || process.env.SESSION_SECRET;
    const hasSessionSecret = Boolean(sessionSecret);

    // Check runtime environment using the context adapter
    const nodeEnv = getEnvVar(context, 'NODE_ENV') || process.env.NODE_ENV || 'unknown';
    const isDocker = getEnvVar(context, 'RUNNING_IN_DOCKER') === 'true' || process.env.RUNNING_IN_DOCKER === 'true';

    return json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'unknown',
      environment: {
        sessionSecret: hasSessionSecret ? 'set' : 'missing',
        nodeEnv,
        isDocker,
      },
    });
  });

  return handler(args.context, args.request, args.context.res);
};

export default function Health() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Health Check</h1>
      <p className="text-green-600 font-semibold">Service is running</p>
      <p className="mt-2 text-gray-600">For detailed status information, access this route programmatically.</p>
    </div>
  );
}
