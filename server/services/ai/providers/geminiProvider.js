const IAiProvider = require('../aiProvider');
const AI_CONFIG = require('../../../config/aiConfig');

class GeminiProvider extends IAiProvider {
  constructor(options = {}) {
    super();
    this.apiKey = options.apiKey || AI_CONFIG.geminiApiKey;
    this.defaultModel = options.model || AI_CONFIG.model || 'gemini-3.5-flash-lite';
    this.fallbackModel = options.fallbackModel || AI_CONFIG.fallbackModel || 'gemini-3-flash-preview';
    this.timeoutMs = options.timeoutMs || AI_CONFIG.requestTimeoutMs;
  }

  /**
   * Normalizes tool JSON schemas for Gemini Function Declarations
   */
  normalizeJsonSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;
    const copy = { ...schema };
    if (copy.type && typeof copy.type === 'string') {
      copy.type = copy.type.toUpperCase();
    }
    if (copy.properties && typeof copy.properties === 'object') {
      copy.properties = { ...copy.properties };
      for (const [key, val] of Object.entries(copy.properties)) {
        copy.properties[key] = this.normalizeJsonSchema(val);
      }
    }
    if (copy.items && typeof copy.items === 'object') {
      copy.items = this.normalizeJsonSchema(copy.items);
    }
    return copy;
  }

  /**
   * Transforms generic tool definitions into Gemini function declarations
   */
  formatTools(tools) {
    if (!tools || !Array.isArray(tools) || tools.length === 0) {
      return undefined;
    }

    const functionDeclarations = tools.map((tool) => {
      const toolParams = tool.parameters || { type: 'object', properties: {} };
      return {
        name: tool.name,
        description: tool.description,
        parameters: this.normalizeJsonSchema(toolParams)
      };
    });

    return [{ functionDeclarations }];
  }

  /**
   * Transforms standardized messages into Gemini contents and systemInstruction
   */
  formatContents(messages) {
    let systemInstruction = null;
    const contents = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = {
          parts: [{ text: String(msg.content || '') }]
        };
        continue;
      }

      if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: String(msg.content || '') }]
        });
      } else if (msg.role === 'assistant') {
        if (msg.rawGeminiParts && Array.isArray(msg.rawGeminiParts)) {
          contents.push({
            role: 'model',
            parts: msg.rawGeminiParts
          });
        } else if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          const parts = [];
          if (msg.content) parts.push({ text: msg.content });
          for (const tc of msg.tool_calls) {
            let args = tc.function?.arguments;
            if (typeof args === 'string') {
              try { args = JSON.parse(args); } catch (e) { args = {}; }
            }
            parts.push({
              functionCall: {
                name: tc.function?.name || tc.name,
                args: args || {},
                id: tc.id
              }
            });
          }
          contents.push({ role: 'model', parts });
        } else {
          contents.push({
            role: 'model',
            parts: [{ text: String(msg.content || '') }]
          });
        }
      } else if (msg.role === 'tool') {
        let parsedResponse = {};
        try {
          parsedResponse = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        } catch (e) {
          parsedResponse = { output: String(msg.content || '') };
        }

        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: msg.name,
                id: msg.tool_call_id,
                response: parsedResponse
              }
            }
          ]
        });
      }
    }

    return { systemInstruction, contents };
  }

  /**
   * Generates completion via Google AI Studio (Gemini) REST API
   */
  async generateCompletion({ messages, tools, model, temperature, maxTokens }) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server. Please set it in your backend environment variables.');
    }

    const primaryModel = model || this.defaultModel;
    const { systemInstruction, contents } = this.formatContents(messages);
    const geminiTools = this.formatTools(tools);

    const payload = {
      contents,
      generationConfig: {
        temperature: temperature !== undefined ? temperature : AI_CONFIG.temperature,
        maxOutputTokens: maxTokens || AI_CONFIG.maxTokens,
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }
    if (geminiTools) {
      payload.tools = geminiTools;
    }

    const modelsToAttempt = [primaryModel];
    if (this.fallbackModel && this.fallbackModel !== primaryModel) {
      modelsToAttempt.push(this.fallbackModel);
    }

    let lastError = null;

    for (const currentModel of modelsToAttempt) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent?key=${this.apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errMsg = data?.error?.message || `Google AI Studio API Error (Status ${response.status})`;
          const err = new Error(errMsg);
          err.status = response.status;
          err.code = 'PROVIDER_ERROR';

          if ((response.status === 503 || response.status === 404) && currentModel !== modelsToAttempt[modelsToAttempt.length - 1]) {
            console.warn(`[GeminiProvider] Model ${currentModel} returned ${response.status}. Attempting fallback to ${this.fallbackModel}...`);
            lastError = err;
            continue;
          }
          throw err;
        }

        const candidate = data.candidates && data.candidates[0];
        if (!candidate) {
          throw new Error('Empty response received from Google AI Studio model.');
        }

        const candidateParts = candidate.content?.parts || [];
        let textResult = '';
        const toolCalls = [];
        const rawToolCalls = [];

        for (const part of candidateParts) {
          if (part.text) {
            textResult += part.text;
          }
          if (part.functionCall) {
            const callId = part.functionCall.id || `call_${Math.random().toString(36).slice(2, 9)}`;
            const fnName = part.functionCall.name;
            const fnArgs = part.functionCall.args || {};

            toolCalls.push({
              id: callId,
              name: fnName,
              arguments: fnArgs
            });

            rawToolCalls.push({
              id: callId,
              type: 'function',
              function: {
                name: fnName,
                arguments: JSON.stringify(fnArgs)
              }
            });
          }
        }

        return {
          text: textResult,
          rawMessage: {
            role: 'assistant',
            content: textResult || null,
            tool_calls: rawToolCalls.length > 0 ? rawToolCalls : undefined
          },
          rawCandidateParts: candidateParts,
          toolCalls,
          usage: {
            promptTokens: data.usageMetadata?.promptTokenCount || 0,
            completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata?.totalTokenCount || 0
          },
          model: data.modelVersion || currentModel,
          finishReason: candidate.finishReason || 'STOP'
        };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          const timeoutError = new Error(`AI request timed out after ${this.timeoutMs / 1000} seconds.`);
          timeoutError.code = 'TIMEOUT';
          throw timeoutError;
        }
        lastError = error;
      }
    }

    throw lastError || new Error('Failed to generate completion from Google AI Studio provider.');
  }
}

module.exports = GeminiProvider;
