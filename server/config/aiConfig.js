/**
 * AI Configuration & Plan Tier Quotas
 * Configurable via environment variables with safe defaults.
 */

const AI_CONFIG = {
  // OpenRouter & LLM Provider Settings
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  model: process.env.AI_MODEL || 'openrouter/free',
  temperature: parseFloat(process.env.AI_TEMPERATURE || '0.2'),
  maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048', 10),
  requestTimeoutMs: parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '35000', 10),
  siteUrl: process.env.AI_SITE_URL || 'https://quaders.com',
  siteName: process.env.AI_SITE_NAME || 'Quaders School Management ERP',

  // Daily AI Request Quotas by Subscription Plan Tier
  planLimits: {
    FREE: parseInt(process.env.AI_LIMIT_FREE || '1', 10),
    BASIC: parseInt(process.env.AI_LIMIT_BASIC || '5', 10),
    STARTER: parseInt(process.env.AI_LIMIT_BASIC || '5', 10),
    STANDARD: parseInt(process.env.AI_LIMIT_STANDARD || '10', 10),
    PROFESSIONAL: parseInt(process.env.AI_LIMIT_STANDARD || '10', 10),
    ENTERPRISE: parseInt(process.env.AI_LIMIT_ENTERPRISE || '30', 10),
  },

  // Max input length protection to prevent prompt bloating / cost attacks
  maxMessageLength: parseInt(process.env.AI_MAX_MESSAGE_LENGTH || '2000', 10),
  maxHistoryTurns: parseInt(process.env.AI_MAX_HISTORY_TURNS || '10', 10),

  // Fallback Limit if school plan is unknown
  defaultLimit: 1,
};

module.exports = AI_CONFIG;
