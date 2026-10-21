const IAiProvider = require('../aiProvider');
const AI_CONFIG = require('../../../config/aiConfig');

class OpenRouterProvider extends IAiProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || AI_CONFIG.openRouterApiKey;
    this.defaultModel = options.model || AI_CONFIG.model;
    this.siteUrl = options.siteUrl || AI_CONFIG.siteUrl;
    this.siteName = options.siteName || AI_CONFIG.siteName;
    this.timeoutMs = options.timeoutMs || AI_CONFIG.requestTimeoutMs;
  }

  /**
   * Transforms generic tool definitions into OpenRouter / OpenAI compatible tool specs
   */
  formatTools(tools) {
    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return undefined;
    }

    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters || {
          type: 'object',
          properties: {},
        }
      }
    }));
  }

  /**
   * Generates completion via OpenRouter API
   */
  async generateCompletion({ messages, tools, model, temperature, maxTokens }) {
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured on the server. Please set it in your backend environment variables.');
    }

    const selectedModel = model || this.defaultModel;
    const formattedTools = this.formatTools(tools);

    const payload = {
      model: selectedModel,
      messages: messages.map((m) => {
        const msg = { role: m.role, content: m.content || '' };
        if (m.name) msg.name = m.name;
        if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
        if (m.tool_calls) msg.tool_calls = m.tool_calls;
        return msg;
      }),
      temperature: temperature !== undefined ? temperature : AI_CONFIG.temperature,
      max_tokens: maxTokens || AI_CONFIG.maxTokens,
    };

    if (formattedTools && formattedTools.length > 0) {
      payload.tools = formattedTools;
      payload.tool_choice = 'auto';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.siteUrl,
          'X-Title': this.siteName,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data?.error?.message || `OpenRouter API Error (Status ${response.status})`;
        const errorObj = new Error(errorMsg);
        errorObj.status = response.status;
        errorObj.code = 'PROVIDER_ERROR';
        throw errorObj;
      }

      const choice = data.choices && data.choices[0];
      if (!choice) {
        throw new Error('Empty response received from AI model.');
      }

      const message = choice.message || {};
      const toolCalls = [];

      if (message.tool_calls && Array.isArray(message.tool_calls)) {
        for (const tc of message.tool_calls) {
          let parsedArgs = {};
          try {
            parsedArgs = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : (tc.function.arguments || {});
          } catch (jsonErr) {
            console.warn(`Failed to parse arguments for tool ${tc.function.name}:`, tc.function.arguments);
          }

          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: parsedArgs,
          });
        }
      }

      return {
        text: message.content || '',
        rawMessage: message,
        toolCalls,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: data.model || selectedModel,
        finishReason: choice.finish_reason || 'stop',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`AI request timed out after ${this.timeoutMs / 1000} seconds.`);
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
      throw error;
    }
  }
}

module.exports = OpenRouterProvider;
