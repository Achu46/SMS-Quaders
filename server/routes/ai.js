const express = require('express');
const router = express.Router();
const { authenticateToken, requireActiveSchool, requireAcademicSetup, requireRole } = require('../middleware');
const aiQuotaService = require('../services/aiQuotaService');
const aiService = require('../services/ai/aiService');

// All AI endpoints require token authentication and are strictly restricted to SUPER_ADMIN and ADMIN
router.use(authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']));

/**
 * GET /api/ai/usage
 * Returns current tenant's AI daily usage quota status
 */
router.get('/usage', async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const prisma = req.prisma;

    const usageStatus = await aiQuotaService.getUsageStatus(schoolId, prisma, req.user);
    res.json(usageStatus);
  } catch (error) {
    console.error('Fetch AI usage error:', error);
    res.status(500).json({ error: 'Failed to retrieve AI usage statistics' });
  }
});

/**
 * POST /api/ai/chat
 * Primary conversation endpoint with atomic quota deduction and controlled tool calling
 */
router.post('/chat', requireActiveSchool, requireAcademicSetup, async (req, res) => {
  const { messages } = req.body;
  const schoolId = req.user.schoolId;
  const prisma = req.prisma;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'A valid array of conversation messages is required.' });
  }

  // 1. Atomic Daily AI Limit Verification & Reservation (Unlimited for Super Admin)
  const quotaCheck = await aiQuotaService.checkAndReserveQuota(schoolId, prisma, req.user);

  if (!quotaCheck.allowed) {
    return res.status(429).json({
      error: quotaCheck.reason || 'Daily AI request limit reached for your subscription plan.',
      code: 'QUOTA_EXCEEDED',
      usage: quotaCheck.usage
    });
  }

  try {
    // 2. Process Chat Request via AI Service
    const aiResult = await aiService.processChat({
      messages,
      schoolId,
      user: req.user,
      prisma
    });

    // 3. Fetch latest remaining usage
    const updatedUsage = await aiQuotaService.getUsageStatus(schoolId, prisma, req.user);

    res.json({
      reply: aiResult.reply,
      toolsUsed: aiResult.toolsUsed,
      model: aiResult.model,
      usage: updatedUsage
    });
  } catch (error) {
    console.error('AI Chat Processing Error:', error);

    // Rollback quota on catastrophic server / provider error
    await aiQuotaService.rollbackQuota(schoolId, prisma);

    const isApiKeyMissing = error.message?.includes('GEMINI_API_KEY') || error.message?.includes('OPENROUTER_API_KEY');
    const isTimeout = error.code === 'TIMEOUT';

    let userMessage = 'The AI assistant is temporarily unavailable. Please try again in a moment.';
    if (isApiKeyMissing) {
      userMessage = 'The AI assistant is not yet configured with an API key on this server.';
    } else if (isTimeout) {
      userMessage = 'The AI request timed out. Please ask a more specific question or try again.';
    }

    res.status(500).json({
      error: userMessage,
      code: error.code || 'AI_SERVICE_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/ai/conversations
 * List conversation sessions for the current authenticated user
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.id;
    const prisma = req.prisma;

    const conversations = await prisma.aiConversation.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 30
    });

    res.json(conversations);
  } catch (error) {
    console.error('Fetch AI conversations error:', error);
    res.status(500).json({ error: 'Failed to retrieve conversation history' });
  }
});

/**
 * GET /api/ai/conversations/:id
 * Retrieve full messages of a specific conversation session
 */
router.get('/conversations/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const prisma = req.prisma;

    const conversation = await prisma.aiConversation.findFirst({
      where: { id, userId }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Fetch AI conversation error:', error);
    res.status(500).json({ error: 'Failed to retrieve conversation' });
  }
});

/**
 * POST /api/ai/conversations
 * Save or update a conversation session and title
 */
router.post('/conversations', async (req, res) => {
  try {
    const userId = req.user.id;
    const schoolId = req.user.schoolId || null;
    const { id, title, messages } = req.body;
    const prisma = req.prisma;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Valid messages array is required' });
    }

    // Auto-generate title if not provided or default
    let conversationTitle = title;
    if (!conversationTitle || conversationTitle === 'New Chat') {
      const firstUserMsg = messages.find(m => m.role === 'user');
      if (firstUserMsg && firstUserMsg.content) {
        conversationTitle = firstUserMsg.content.slice(0, 45).trim() + (firstUserMsg.content.length > 45 ? '...' : '');
      } else {
        conversationTitle = 'New Chat';
      }
    }

    if (id) {
      // Update existing
      const existing = await prisma.aiConversation.findFirst({
        where: { id, userId }
      });

      if (existing) {
        const updated = await prisma.aiConversation.update({
          where: { id },
          data: {
            title: conversationTitle,
            messages,
            updatedAt: new Date()
          }
        });
        return res.json(updated);
      }
    }

    // Create new conversation
    const created = await prisma.aiConversation.create({
      data: {
        userId,
        schoolId,
        title: conversationTitle,
        messages
      }
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Save AI conversation error:', error);
    res.status(500).json({ error: 'Failed to save conversation' });
  }
});

/**
 * DELETE /api/ai/conversations/:id
 * Delete a specific conversation session
 */
router.delete('/conversations/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const prisma = req.prisma;

    await prisma.aiConversation.deleteMany({
      where: { id, userId }
    });

    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete AI conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

/**
 * GET /api/ai/logs
 * View recent AI audit logs (Admin only)
 */
router.get('/logs', requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const prisma = req.prisma;

    const logs = await prisma.aiAuditLog.findMany({
      where: req.user.role === 'SUPER_ADMIN' ? {} : { schoolId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(logs);
  } catch (error) {
    console.error('Fetch AI logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve AI audit logs' });
  }
});

module.exports = router;
