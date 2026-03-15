import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

function getCodexProxyUrl(serverEnv?: Record<string, string>): string {
  return (
    process.env.CODEX_PROXY_URL ||
    serverEnv?.CODEX_PROXY_URL ||
    'http://localhost:3100'
  );
}

export default class ChatGPTProvider extends BaseProvider {
  name = 'ChatGPT';
  // No getApiKeyLink — login is handled by ChatGPTLoginSection OAuth flow

  config = {
    // The "API key" for ChatGPT is actually the Codex session token
    // stored in the browser cookie. The provider uses it to authenticate
    // requests to the codex-proxy.
    apiTokenKey: 'CHATGPT_CODEX_SESSION',
  };

  // Fallback static models — dynamic models from Codex take precedence
  staticModels: ModelInfo[] = [
    // Codex-specific models
    {
      name: 'gpt-5.3-codex',
      label: 'GPT-5.3 Codex (ChatGPT)',
      provider: 'ChatGPT',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'gpt-5.3-codex-spark',
      label: 'GPT-5.3 Codex Spark (ChatGPT)',
      provider: 'ChatGPT',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'gpt-5.2-codex',
      label: 'GPT-5.2 Codex (ChatGPT)',
      provider: 'ChatGPT',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'gpt-5.1-codex-max',
      label: 'GPT-5.1 Codex Max (ChatGPT)',
      provider: 'ChatGPT',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'gpt-5.1-codex-mini',
      label: 'GPT-5.1 Codex Mini (ChatGPT)',
      provider: 'ChatGPT',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    // Standard models available via Codex
    {
      name: 'gpt-5.4',
      label: 'GPT-5.4 (ChatGPT)',
      provider: 'ChatGPT',
      maxTokenAllowed: 1050000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'gpt-5.2',
      label: 'GPT-5.2 (ChatGPT)',
      provider: 'ChatGPT',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'o3',
      label: 'O3 (ChatGPT)',
      provider: 'ChatGPT',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 100000,
    },
    {
      name: 'o3-pro',
      label: 'O3 Pro (ChatGPT)',
      provider: 'ChatGPT',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 100000,
    },
    {
      name: 'o4-mini',
      label: 'O4 Mini (ChatGPT)',
      provider: 'ChatGPT',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 100000,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    _settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    // The session token comes from the browser cookie via apiKeys
    const sessionToken = apiKeys?.[this.name] || '';

    if (!sessionToken) {
      return [];
    }

    const codexProxyUrl = getCodexProxyUrl(serverEnv);

    try {
      const response = await fetch(`${codexProxyUrl}/codex/models`, {
        headers: {
          'x-codex-session': sessionToken,
        },
        signal: this.createTimeoutSignal(10000),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as any;
      const models = data.models || [];
      const staticModelIds = this.staticModels.map((m) => m.name);

      return models
        .filter((m: any) => !staticModelIds.includes(m.id))
        .map((m: any) => ({
          name: m.id,
          label: `${m.name || m.id} (ChatGPT)`,
          provider: this.name,
          maxTokenAllowed: 200000,
          maxCompletionTokens: 100000,
        }));
    } catch (error) {
      console.error('Failed to fetch ChatGPT/Codex models:', error);
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, apiKeys, serverEnv } = options;

    // Session token from the browser cookie
    const sessionToken = apiKeys?.[this.name] || '';
    const codexProxyUrl = getCodexProxyUrl(serverEnv as unknown as Record<string, string>);

    const openai = createOpenAI({
      baseURL: `${codexProxyUrl}/codex/chat`,
      apiKey: sessionToken || 'no-session',
      headers: {
        'x-codex-session': sessionToken,
      },
    });

    return openai(model);
  }
}
