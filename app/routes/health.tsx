import type { AppLoadContext } from '@remix-run/cloudflare';
import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';

interface Env {
  SESSION_SECRET?: string;
  NODE_ENV?: string;
  RUNNING_IN_DOCKER?: string;

  // Add other environment variables as needed
}

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const env = (context as AppLoadContext).env as Env;

  // Check if SESSION_SECRET is set
  const hasSessionSecret = Boolean(env?.SESSION_SECRET || process.env.SESSION_SECRET);

  // Check runtime environment
  const nodeEnv = env?.NODE_ENV || process.env.NODE_ENV || 'unknown';
  const isDocker = env?.RUNNING_IN_DOCKER === 'true' || process.env.RUNNING_IN_DOCKER === 'true';

  return json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
    environment: {
      sessionSecret: hasSessionSecret ? 'set' : 'missing',
      nodeEnv,
      isDocker,

      // Add other environment checks as needed, but don't expose actual secrets
    },
  });
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
