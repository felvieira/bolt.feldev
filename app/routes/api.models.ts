import { json } from '@remix-run/node';
import { type Request, type Response } from 'express';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { ProviderInfo } from '~/types/model';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createApiHandler, getCookiesFromRequest, handleApiError } from '~/utils/api-utils.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

interface ModelsResponse {
  modelList: ModelInfo[];
  providers: ProviderInfo[];
  defaultProvider: ProviderInfo;
}

let cachedProviders: ProviderInfo[] | null = null;
let cachedDefaultProvider: ProviderInfo | null = null;

function getProviderInfo(llmManager: LLMManager) {
  if (!cachedProviders) {
    cachedProviders = llmManager.getAllProviders().map((provider) => ({
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

export const loader = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
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

    response.status(200).json({
      modelList,
      providers,
      defaultProvider,
    });
    
    return response;
  } catch (error) {
    return handleApiError(error);
  }
});
