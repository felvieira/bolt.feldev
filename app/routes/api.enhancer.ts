import { type Request, type Response } from 'express';
import { stripIndents } from '~/utils/stripIndent';
import type { ProviderInfo } from '~/types/model';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

export const action = async (args: { context: ExpressAppContext, request: Request, params: any }) => {
  // Dynamically import server-only modules
  const { getCookiesFromRequest, handleApiError, createApiHandler, createStreamingResponse } = await import('~/utils/api-utils.server');
  const { streamText } = await import('~/lib/.server/llm/stream-text');
  const { getApiKeysFromCookie, getProviderSettingsFromCookie } = await import('~/lib/api/cookies');
  const { json } = await import('@remix-run/node');

  // Create the handler using the imported utilities
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    try {
      const requestBody = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      const { message, model, provider } = requestBody as {
        message: string;
        model: string;
        provider: ProviderInfo;
        apiKeys?: Record<string, string>;
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

      try {
        const result = await streamText({
          messages: [
            {
              role: 'user',
              content:
                `[Model: ${model}]\n\n[Provider: ${providerName}]\n\n` +
                stripIndents`
                You are a professional prompt engineer specializing in crafting precise, effective prompts.
                Your task is to enhance prompts by making them more specific, actionable, and effective.

                I want you to improve the user prompt that is wrapped in \`<original_prompt>\` tags.

                For valid prompts:
                - Make instructions explicit and unambiguous
                - Add relevant context and constraints
                - Remove redundant information
                - Maintain the core intent
                - Ensure the prompt is self-contained
                - Use professional language

                For invalid or unclear prompts:
                - Respond with clear, professional guidance
                - Keep responses concise and actionable
                - Maintain a helpful, constructive tone
                - Focus on what the user should provide
                - Use a standard template for consistency

                IMPORTANT: Your response must ONLY contain the enhanced prompt text.
                Do not include any explanations, metadata, or wrapper tags.

                <original_prompt>
                  ${message}
                </original_prompt>
              `,
            },
          ],
          env: context.env,
          apiKeys,
          providerSettings,
        });

        // Use createStreamingResponse to create a proper Response object for Remix
        return createStreamingResponse(result.textStream, 'text/event-stream');
      } catch (error: unknown) {
        console.log(error);

        if (error instanceof Error && error.message?.includes('API key')) {
          return json({ error: 'Invalid or missing API key' }, { status: 401 });
        }

        return json({ error: 'Internal Server Error' }, { status: 500 });
      }
    } catch (error) {
      return handleApiError(error);
    }
  });

  return handler(args.context, args.request, args.params);
};
