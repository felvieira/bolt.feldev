import type { LoaderFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { providerBaseUrlEnvKeys } from '~/utils/constants';
import { getEnvVar } from '~/utils/express-context-adapter.server';
import { handleApiError } from '~/utils/api-utils.server';

export const loader: LoaderFunction = async ({ context, request }) => {
  try {
    const url = new URL(request.url);
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
};
