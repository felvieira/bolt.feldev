import express from 'express';
import type { ProviderInfo } from '~/types/model';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';
import { createScopedLogger } from '~/utils/logger';
import { PROVIDER_LIST } from '~/utils/constants';
import { MAX_TOKENS } from '~/lib/.server/llm/constants';

// Use type em vez de importação direta
type Request = express.Request;
type Response = express.Response;

const logger = createScopedLogger('api.llmcall');

export const action = async (args: { context: ExpressAppContext, request: Request }) => {
  // Dynamically import server-only modules
  const { createApiHandler, getCookiesFromRequest, handleApiError, createStreamingResponse } = await import('~/utils/api-utils.server');
  const { streamText } = await import('~/lib/.server/llm/stream-text');
  const { generateText } = await import('ai');
  const { getApiKeysFromCookie, getProviderSettingsFromCookie } = await import('~/lib/api/cookies');
  const { LLMManager } = await import('~/lib/modules/llm/manager');
  const { json } = await import('@remix-run/node');

  // Define the getModelList function inside the action
  async function getModelList(options: any) {
    const llmManager = LLMManager.getInstance(import.meta.env);
    return llmManager.updateModelList(options);
  }

  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
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
          const modelDetails = models.find((m: any) => m.name === model);

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
  });

  return handler(args.context, args.request, args.context.res);
};
