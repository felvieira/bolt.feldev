import express from 'express';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { ProviderInfo } from '~/types/model';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

// Use type em vez de importação direta
type Request = express.Request;
type Response = express.Response;

interface ModelsResponse {
  modelList: ModelInfo[];
  providers: ProviderInfo[];
  defaultProvider: ProviderInfo;
}

let cachedProviders: ProviderInfo[] | null = null;
let cachedDefaultProvider: ProviderInfo | null = null;

export const loader = async (args: { context: ExpressAppContext, request: Request }) => {
  // Dynamically import all server modules
  const { json } = await import('@remix-run/node');
  const { createApiHandler, getCookiesFromRequest, handleApiError } = await import('~/utils/api-utils.server');
  const { LLMManager } = await import('~/lib/modules/llm/manager');
  const { getApiKeysFromCookie, getProviderSettingsFromCookie } = await import('~/lib/api/cookies');

  // Define provider info function inside loader
  function getProviderInfo(llmManager: any) {
    if (!cachedProviders) {
      cachedProviders = llmManager.getAllProviders().map((provider: any) => ({
        name: provider.name,
        staticModels: provider.staticModels,
        getApiKeyLink: provider.getApiKeyLink,
        labelForGetApiKey: provider.labelForGetApiKey,
        icon: provider.icon,
      }));
    }

    if (!cachedDefaultProvider) {
      const defaultProvider = llmManager.getDefaultProvider();
      cachedDefaultProvider = {
        name: defaultProvider.name,
        staticModels: defaultProvider.staticModels,
        getApiKeyLink: defaultProvider.getApiKeyLink,
        labelForGetApiKey: defaultProvider.labelForGetApiKey,
        icon: defaultProvider.icon,
      };
    }

    return { providers: cachedProviders, defaultProvider: cachedDefaultProvider };
  }

  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    try {
      const provider = request.params.provider;
      const llmManager = LLMManager.getInstance(context.env);

      // Get client side maintained API keys and provider settings from cookies
      const cookies = getCookiesFromRequest(request);
      const apiKeys = getApiKeysFromCookie(cookies);
      const providerSettings = getProviderSettingsFromCookie(cookies);

      const { providers, defaultProvider } = getProviderInfo(llmManager);

      let modelList: ModelInfo[] = [];

      if (provider) {
        // Only update models for the specific provider
        const providerInstance = llmManager.getProvider(provider);

        if (providerInstance) {
          modelList = await llmManager.getModelListFromProvider(providerInstance, {
            apiKeys,
            providerSettings,
            serverEnv: context.env,
          });
        }
      } else {
        // Update all models
        modelList = await llmManager.updateModelList({
          apiKeys,
          providerSettings,
          serverEnv: context.env,
        });
      }

      return json({
        modelList,
        providers,
        defaultProvider,
      });
    } catch (error) {
      return handleApiError(error);
    }
  });

  return handler(args.context, args.request, args.context.res);
};
