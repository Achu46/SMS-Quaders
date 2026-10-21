/**
 * Abstract AI Provider Interface
 * Allows swapping between OpenRouter, Google Gemini, OpenAI, Anthropic without altering the ERP business logic.
 */
class IAiProvider {
  /**
   * Generates a chat completion with support for tool calling.
   * 
   * @param {Object} options
   * @param {Array<{ role: string, content: string }>} options.messages
   * @param {Array<Object>} [options.tools] Array of tool schemas
   * @param {string} [options.model] Specific model identifier
   * @param {number} [options.temperature]
   * @param {number} [options.maxTokens]
   * @returns {Promise<{
   *   text: string,
   *   toolCalls: Array<{ id: string, name: string, arguments: Object }>,
   *   usage: { promptTokens: number, completionTokens: number, totalTokens: number },
   *   model: string,
   *   finishReason: string
   * }>}
   */
  async generateCompletion(options) {
    throw new Error('Method generateCompletion() must be implemented by concrete AI provider');
  }
}

module.exports = IAiProvider;
