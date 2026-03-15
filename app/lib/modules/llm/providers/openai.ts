import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class OpenAIProvider extends BaseProvider {
  name = 'OpenAI';
  getApiKeyLink = 'https://platform.openai.com/api-keys';

  config = {
    apiTokenKey: 'OPENAI_API_KEY',
  };

  staticModels: ModelInfo[] = [
    // GPT-5 series (flagship)
    {
      name: 'gpt-5.4',
      label: 'GPT-5.4',
      provider: 'OpenAI',
      maxTokenAllowed: 1050000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'gpt-5.4-pro',
      label: 'GPT-5.4 Pro',
      provider: 'OpenAI',
      maxTokenAllowed: 1050000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'gpt-5.2',
      label: 'GPT-5.2',
      provider: 'OpenAI',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'gpt-5.1',
      label: 'GPT-5.1',
      provider: 'OpenAI',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'gpt-5-mini',
      label: 'GPT-5 Mini',
      provider: 'OpenAI',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    {
      name: 'gpt-5-nano',
      label: 'GPT-5 Nano',
      provider: 'OpenAI',
      maxTokenAllowed: 400000,
      maxCompletionTokens: 128000,
    },
    // o-series (reasoning)
    {
      name: 'o3',
      label: 'O3',
      provider: 'OpenAI',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 100000,
    },
    {
      name: 'o3-pro',
      label: 'O3 Pro',
      provider: 'OpenAI',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 100000,
    },
    {
      name: 'o4-mini',
      label: 'O4 Mini',
      provider: 'OpenAI',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 100000,
    },
    // GPT-4.1 (non-reasoning, large context)
    {
      name: 'gpt-4.1',
      label: 'GPT-4.1',
      provider: 'OpenAI',
      maxTokenAllowed: 1047576,
      maxCompletionTokens: 32768,
    },
    {
      name: 'gpt-4.1-mini',
      label: 'GPT-4.1 Mini',
      provider: 'OpenAI',
      maxTokenAllowed: 1047576,
      maxCompletionTokens: 32768,
    },
    // Legacy (still available via API)
    {
      name: 'gpt-4o',
      label: 'GPT-4o',
      provider: 'OpenAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 16384,
    },
    {
      name: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      provider: 'OpenAI',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 16384,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'OPENAI_API_KEY',
    });

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`https://api.openai.com/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;
    const staticModelIds = this.staticModels.map((m) => m.name);

    const data = res.data.filter(
      (model: any) =>
        model.object === 'model' &&
        (model.id.startsWith('gpt-') || model.id.startsWith('o') || model.id.startsWith('chatgpt-')) &&
        !staticModelIds.includes(model.id),
    );

    return data.map((m: any) => {
      let contextWindow = 128000; // default fallback

      if (m.context_length) {
        contextWindow = m.context_length;
      } else if (m.id?.includes('gpt-5.4') || m.id?.includes('gpt-4.1')) {
        contextWindow = 1050000;
      } else if (m.id?.includes('gpt-5')) {
        contextWindow = 400000;
      } else if (m.id?.startsWith('o3') || m.id?.startsWith('o4')) {
        contextWindow = 200000;
      } else if (m.id?.includes('gpt-4o') || m.id?.includes('gpt-4-turbo')) {
        contextWindow = 128000;
      } else if (m.id?.includes('gpt-3.5-turbo')) {
        contextWindow = 16385;
      }

      let maxCompletionTokens = 16384; // default

      if (m.id?.includes('gpt-5')) {
        maxCompletionTokens = 128000;
      } else if (m.id?.startsWith('o3') || m.id?.startsWith('o4')) {
        maxCompletionTokens = 100000;
      } else if (m.id?.includes('gpt-4.1')) {
        maxCompletionTokens = 32768;
      } else if (m.id?.includes('gpt-4o')) {
        maxCompletionTokens = 16384;
      }

      return {
        name: m.id,
        label: `${m.id} (${contextWindow >= 1000000 ? `${(contextWindow / 1000000).toFixed(0)}M` : `${Math.floor(contextWindow / 1000)}k`} context)`,
        provider: this.name,
        maxTokenAllowed: contextWindow,
        maxCompletionTokens,
      };
    });
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'OPENAI_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      apiKey,
    });

    return openai(model);
  }
}
