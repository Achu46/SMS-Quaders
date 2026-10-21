import { api } from './api';

export const aiService = {
  /**
   * Send messages to AI assistant
   * @param {Array<{ role: string, content: string }>} messages
   */
  async sendMessage(messages) {
    try {
      return await api.post('/ai/chat', { messages });
    } catch (error) {
      console.error('AI Service sendMessage error:', error);
      throw error;
    }
  },

  /**
   * Fetch tenant daily AI usage status
   */
  async getUsage() {
    try {
      return await api.get('/ai/usage');
    } catch (error) {
      console.error('AI Service getUsage error:', error);
      return null;
    }
  },

  /**
   * Fetch recent AI audit logs (Admin only)
   */
  async getAuditLogs() {
    try {
      return await api.get('/ai/logs');
    } catch (error) {
      console.error('AI Service getAuditLogs error:', error);
      return [];
    }
  },

  /**
   * Get all past conversations for the current user
   */
  async getConversations() {
    try {
      return await api.get('/ai/conversations');
    } catch (error) {
      console.error('AI Service getConversations error:', error);
      return [];
    }
  },

  /**
   * Get full messages for a specific conversation
   */
  async getConversation(id) {
    try {
      return await api.get(`/ai/conversations/${id}`);
    } catch (error) {
      console.error('AI Service getConversation error:', error);
      return null;
    }
  },

  /**
   * Save or update conversation messages
   */
  async saveConversation({ id, title, messages }) {
    try {
      return await api.post('/ai/conversations', { id, title, messages });
    } catch (error) {
      console.error('AI Service saveConversation error:', error);
      return null;
    }
  },

  /**
   * Delete a conversation
   */
  async deleteConversation(id) {
    try {
      return await api.delete(`/ai/conversations/${id}`);
    } catch (error) {
      console.error('AI Service deleteConversation error:', error);
      return false;
    }
  }
};
