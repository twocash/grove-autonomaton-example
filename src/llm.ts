import type { ProviderConfig, SkillResult } from './types.js';

interface ProviderAdapter {
  buildUrl: (config: ProviderConfig, apiKey: string) => string;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildBody: (model: string, input: string) => unknown;
  extractResponse: (json: Record<string, unknown>) => string;
}

const adapters: Record<string, ProviderAdapter> = {
  openai: {
    buildUrl: (config) => `${config.endpoint}/chat/completions`,
    buildHeaders: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),
    buildBody: (model, input) => ({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful CLI assistant. Give concise answers.' },
        { role: 'user', content: input },
      ],
      max_tokens: 200,
    }),
    extractResponse: (json) => {
      const choices = json.choices as Array<{ message: { content: string } }>;
      return choices?.[0]?.message?.content || 'No response';
    },
  },

  gemini: {
    buildUrl: (config, apiKey) => `${config.endpoint}/${config.model}:generateContent?key=${apiKey}`,
    buildHeaders: () => ({
      'Content-Type': 'application/json',
    }),
    buildBody: (_model, input) => ({
      contents: [{ parts: [{ text: input }] }],
    }),
    extractResponse: (json) => {
      const candidates = json.candidates as Array<{ content: { parts: Array<{ text: string }> } }>;
      return candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
    },
  },

  anthropic: {
    buildUrl: (config) => config.endpoint,
    buildHeaders: (apiKey) => ({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    }),
    buildBody: (model, input) => ({
      model,
      messages: [{ role: 'user', content: input }],
      max_tokens: 200,
    }),
    extractResponse: (json) => {
      const content = json.content as Array<{ text: string }>;
      return content?.[0]?.text || 'No response';
    },
  },
};

export async function query(input: string, providerConfig: ProviderConfig): Promise<SkillResult> {
  const apiKey = process.env[providerConfig.apiKeyEnv];

  if (!apiKey) {
    return {
      output: [
        `No API key found for ${providerConfig.name}.`,
        `Set ${providerConfig.apiKeyEnv} to enable this tier.`,
        '',
        'Provider config is in config/routing.config.json — swap providers by editing one block.',
        'Built-in commands still work without any key: try "help".',
      ].join('\n'),
      success: false,
    };
  }

  const adapter = adapters[providerConfig.name];
  if (!adapter) {
    return {
      output: `Unknown provider: ${providerConfig.name}. Supported: ${Object.keys(adapters).join(', ')}`,
      success: false,
    };
  }

  try {
    const url = adapter.buildUrl(providerConfig, apiKey);
    const headers = adapter.buildHeaders(apiKey);
    const body = adapter.buildBody(providerConfig.model, input);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return { output: `${providerConfig.name} API error (${response.status}): ${text.slice(0, 200)}`, success: false };
    }

    const json = await response.json() as Record<string, unknown>;
    const text = adapter.extractResponse(json);
    return { output: text, success: true };
  } catch (err) {
    return { output: `LLM error: ${(err as Error).message}`, success: false };
  }
}
