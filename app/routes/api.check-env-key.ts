import { type Request, type Response } from 'express';
import { json } from '@remix-run/node';
import { providerBaseUrlEnvKeys } from '~/utils/constants';
import { getEnvVar } from '~/utils/express-context-adapter.server';
import { handleApiError, createApiHandler } from '~/utils/api-utils.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

export const loader = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
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
