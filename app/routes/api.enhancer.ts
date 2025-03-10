import { type Request, type Response } from 'express';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';
import type { ProviderInfo } from '~/types/model';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { getCookiesFromRequest, handleApiError, createApiHandler } from '~/utils/api-utils.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

export const action = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
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
      response.status(400).json({ error: 'Invalid or missing model' });
      return response;
    }

    if (!providerName || typeof providerName !== 'string') {
      response.status(400).json({ error: 'Invalid or missing provider' });
      return response;
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

      // For Express, set headers directly on the response object
      response.status(200);
      response.setHeader('Content-Type', 'text/event-stream');
      response.setHeader('Connection', 'keep-alive');
      response.setHeader('Cache-Control', 'no-cache');
      response.setHeader('Text-Encoding', 'chunked');

      // Pipe the stream to the response
      const readable = result.textStream.getReader();
      
      const streamToResponse = async () => {
        while (true) {
          const { done, value } = await readable.read();
          if (done) break;
          response.write(value);
        }
        response.end();
      };
      
      streamToResponse();
      
      return response;
    } catch (error: unknown) {
      console.log(error);

      if (error instanceof Error && error.message?.includes('API key')) {
        response.status(401).json({ error: 'Invalid or missing API key' });
        return response;
      }

      response.status(500).json({ error: 'Internal Server Error' });
      return response;
    }
  } catch (error) {
    return handleApiError(error);
  }
});
