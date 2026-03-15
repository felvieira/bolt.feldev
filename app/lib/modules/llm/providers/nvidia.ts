import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

export default class NvidiaProvider extends BaseProvider {
  name = 'NvidiaNim';
  getApiKeyLink = 'https://build.nvidia.com/settings/api-keys';
  labelForGetApiKey = 'Get NVIDIA API Key';

  config = {
    apiTokenKey: 'NVIDIA_NIM_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'moonshotai/kimi-k2.5',
      label: 'Kimi K2.5 (NVIDIA)',
      provider: 'NvidiaNim',
      maxTokenAllowed: 200000,
      maxCompletionTokens: 16384,
    },
    {
      name: 'meta/llama-3.3-70b-instruct',
      label: 'Llama 3.3 70B Instruct (NVIDIA)',
      provider: 'NvidiaNim',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'meta/llama-3.1-8b-instruct',
      label: 'Llama 3.1 8B Instruct (NVIDIA)',
      provider: 'NvidiaNim',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'mistralai/mistral-large-2-instruct',
      label: 'Mistral Large 2 Instruct (NVIDIA)',
      provider: 'NvidiaNim',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'deepseek-ai/deepseek-r1',
      label: 'DeepSeek R1 (NVIDIA)',
      provider: 'NvidiaNim',
      maxTokenAllowed: 64000,
      maxCompletionTokens: 8192,
    },
    {
      name: 'qwen/qwen2.5-72b-instruct',
      label: 'Qwen 2.5 72B Instruct (NVIDIA)',
      provider: 'NvidiaNim',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 8192,
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
      defaultApiTokenKey: 'NVIDIA_NIM_API_KEY',
    });

    if (!apiKey) {
      return [];
    }

    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(5000),
      });

      if (!response.ok) {
        console.error(`NVIDIA NIM API error: ${response.statusText}`);
        return [];
      }

      const data = (await response.json()) as any;
      const staticModelIds = this.staticModels.map((m) => m.name);

      const dynamicModels =
        data.data
          ?.filter((model: any) => !staticModelIds.includes(model.id))
          .map((m: any) => ({
            name: m.id,
            label: `${m.id} (NVIDIA)`,
            provider: this.name,
            maxTokenAllowed: m.context_length || 128000,
            maxCompletionTokens: 8192,
          })) || [];

      return dynamicModels;
    } catch (error) {
      console.error(`Failed to fetch NVIDIA NIM models:`, error);
      return [];
    }
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
      defaultApiTokenKey: 'NVIDIA_NIM_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://integrate.api.nvidia.com/v1',
      apiKey,
    });

    return openai(model);
  }
}
