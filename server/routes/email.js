const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware');
const emailService = require('../services/emailService');
const rateLimiter = require('../services/rateLimiter');

const emailRateLimiter = rateLimiter.middleware({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many email requests sent. Please try again later.'
});

// POST /api/email/send
router.post('/send', authenticateToken, emailRateLimiter, async (req, res) => {
  try {
    const { to, templateType, data, subject, html } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient email address ("to") is required' });
    }

    if (!templateType && (!subject || !html)) {
      return res.status(400).json({ error: 'Either a valid templateType or both subject and html are required' });
    }

    const result = await emailService.send({
      to,
      templateType,
      data,
      customSubject: subject,
      customHtml: html
    });

    if (!result.success && result.error) {
      return res.status(502).json({ error: 'Email delivery failed', details: result.error });
    }

    res.json({ message: 'Email dispatched successfully', result });
  } catch (error) {
    console.error('Email route error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;
