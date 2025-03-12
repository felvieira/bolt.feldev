import { type Request, type Response } from 'express';
import { providerBaseUrlEnvKeys } from '~/utils/constants';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

export const loader = async (args: { context: ExpressAppContext, request: Request }) => {
  // Dynamically import server modules
  const { json } = await import('@remix-run/node');
  const { handleApiError, createApiHandler } = await import('~/utils/api-utils.server');
  const { getEnvVar } = await import('~/utils/express-context-adapter.server');

  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
      const provider = url.searchParams.get('provider');

      if (!provider || !providerBaseUrlEnvKeys[provider]?.apiTokenKey) {
        return json({ isSet: false });
      }

      const envVarName = providerBaseUrlEnvKeys[provider].apiTokenKey;
      
      // Use the context adapter to check environment variables consistently
      const envValue = getEnvVar(context, envVarName);
      const isSet = !!envValue;

      return json({ isSet });
    } catch (error) {
      return handleApiError(error, 400);
    }
  });

  return handler(args.context, args.request, args.context.res);
};
