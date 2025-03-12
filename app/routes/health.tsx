import { Request, Response } from 'express';
import { createApiHandler } from '~/utils/api-utils.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';
import { getEnvVar } from '~/utils/express-context-adapter.server';
import { json } from '@remix-run/node';

export const loader = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
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

export default function Health() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Health Check</h1>
      <p className="text-green-600 font-semibold">Service is running</p>
      <p className="mt-2 text-gray-600">For detailed status information, access this route programmatically.</p>
    </div>
  );
}
