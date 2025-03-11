import { type Request, type Response } from 'express';
import { streamText } from '~/lib/.server/llm/stream-text';
import type { IProviderSetting, ProviderInfo } from '~/types/model';
import { generateText } from 'ai';
import { PROVIDER_LIST } from '~/utils/constants';
import { MAX_TOKENS } from '~/lib/.server/llm/constants';
import { LLMManager } from '~/lib/modules/llm/manager';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';
import { createApiHandler, getCookiesFromRequest, handleApiError, createStreamingResponse } from '~/utils/api-utils.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';
import { json } from '@remix-run/node';

export const action = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
  return llmCallAction(context, request, response);
});

async function getModelList(options: {
  apiKeys?: Record<string, string>;
  providerSettings?: Record<string, IProviderSetting>;
  serverEnv?: Record<string, string>;
}) {
  const llmManager = LLMManager.getInstance(import.meta.env);
  return llmManager.updateModelList(options);
}

const logger = createScopedLogger('api.llmcall');

async function llmCallAction(context: ExpressAppContext, request: Request, response: Response) {
  try {
    const requestBody = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { system, message, model, provider, streamOutput } = requestBody as {
      system: string;
      message: string;
      model: string;
      provider: ProviderInfo;
      streamOutput?: boolean;
    };

    const { name: providerName } = provider;

    // validate 'model' and 'provider' fields
    if (!model || typeof model !== 'string') {
      return json({ error: 'Invalid or missing model' }, { status: 400 });
    }

    if (!providerName || typeof providerName !== 'string') {
      return json({ error: 'Invalid or missing provider' }, { status: 400 });
    }

    const cookies = getCookiesFromRequest(request);
    const apiKeys = getApiKeysFromCookie(cookies);
    const providerSettings = getProviderSettingsFromCookie(cookies);

    if (streamOutput) {
      try {
        const result = await streamText({
          options: {
            system,
          },
          messages: [
            {
              role: 'user',
              content: `${message}`,
            },
          ],
          env: context.env,
          apiKeys,
          providerSettings,
        });

        // Use createStreamingResponse to create a proper Response object for Remix
        return createStreamingResponse(result.textStream, 'text/plain; charset=utf-8');
      } catch (error: unknown) {
        console.log(error);

        if (error instanceof Error && error.message?.includes('API key')) {
          return json({ error: 'Invalid or missing API key' }, { status: 401 });
        }

        return json({ error: 'Internal Server Error' }, { status: 500 });
      }
    } else {
      try {
        const models = await getModelList({ apiKeys, providerSettings, serverEnv: context.env });
        const modelDetails = models.find((m: ModelInfo) => m.name === model);

        if (!modelDetails) {
          return json({ error: 'Model not found' }, { status: 400 });
        }

        const dynamicMaxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;

        const providerInfo = PROVIDER_LIST.find((p) => p.name === provider.name);

        if (!providerInfo) {
          return json({ error: 'Provider not found' }, { status: 400 });
        }

        logger.info(`Generating response Provider: ${provider.name}, Model: ${modelDetails.name}`);

        const result = await generateText({
          system,
          messages: [
            {
              role: 'user',
              content: `${message}`,
            },
          ],
          model: providerInfo.getModelInstance({
            model: modelDetails.name,
            serverEnv: context.env,
            apiKeys,
            providerSettings,
          }),
          maxTokens: dynamicMaxTokens,
          toolChoice: 'none',
        });
        logger.info(`Generated response`);

        return json(result);
      } catch (error: unknown) {
        console.log(error);

        if (error instanceof Error && error.message?.includes('API key')) {
          return json({ error: 'Invalid or missing API key' }, { status: 401 });
        }

        return json({ error: 'Internal Server Error' }, { status: 500 });
      }
    }
  } catch (error) {
    return handleApiError(error);
  }
}
