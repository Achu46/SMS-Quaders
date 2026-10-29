const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const rateLimiter = require('../services/rateLimiter');

// Rate limiting for public invite endpoints
const validateLimiter = rateLimiter.middleware({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many requests. Please try again later.'
});

const completeLimiter = rateLimiter.middleware({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many registration attempts. Please try again later.'
});

// Zod Schema for registration completion
const completeInviteSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

// GET /api/staff-invite/validate?token=...
// Validates an invite token and returns ONLY email, employeeId, school name and logoUrl
router.get('/validate', validateLimiter, async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Link is invalid or expired. Contact your school admin.' });
    }

    const prisma = req.prisma;
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const invite = await prisma.staffInvite.findUnique({
      where: { tokenHash },
      include: {
        staff: {
          select: {
            id: true,
            email: true,
            employeeId: true,
            status: true,
            role: true
          }
        },
        school: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            status: true
          }
        }
      }
    });

    if (!invite) {
      return res.status(400).json({ error: 'Link is invalid or expired. Contact your school admin.' });
    }

    // Must be un-used, un-revoked, and un-expired
    if (invite.usedAt || invite.revokedAt || new Date() > new Date(invite.expiresAt)) {
      return res.status(400).json({ error: 'Link is invalid or expired. Contact your school admin.' });
    }

    // Staff must exist and still be in INVITED state
    if (!invite.staff || invite.staff.status !== 'INVITED' || invite.staff.role !== 'STAFF') {
      return res.status(400).json({ error: 'Link is invalid or expired. Contact your school admin.' });
    }

    // Institution must be ACTIVE
    if (!invite.school || invite.school.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Link is invalid or expired. Contact your school admin.' });
    }

    // Return ONLY: email, employeeId, college name and logo. No other data.
    res.json({
      valid: true,
      email: invite.staff.email,
      employeeId: invite.staff.employeeId,
      schoolName: invite.school.name,
      schoolLogo: invite.school.logoUrl || null
    });
  } catch (error) {
    console.error('Validate staff invite error:', error);
    res.status(400).json({ error: 'Link is invalid or expired. Contact your school admin.' });
  }
});

// POST /api/staff-invite/complete
// Completes staff registration: sets password, marks status ACTIVE, in one transaction
router.post('/complete', completeLimiter, async (req, res) => {
  try {
    const prisma = req.prisma;

    const parsed = completeInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues ? parsed.error.issues.map(e => e.message).join(', ') : 'Validation error';
      return res.status(400).json({ error: msg });
    }

    const { token, password } = parsed.data;
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    // Run in a single atomic transaction
    await prisma.$transaction(async (tx) => {
      const invite = await tx.staffInvite.findUnique({
        where: { tokenHash },
        include: {
          staff: true,
          school: true
        }
      });

      if (!invite) {
        throw new Error('Link is invalid or expired. Contact your school admin.');
      }

      if (invite.usedAt || invite.revokedAt || new Date() > new Date(invite.expiresAt)) {
        throw new Error('Link is invalid or expired. Contact your school admin.');
      }

      if (!invite.staff || invite.staff.status !== 'INVITED' || invite.staff.role !== 'STAFF') {
        throw new Error('Link is invalid or expired. Contact your school admin.');
      }

      if (!invite.school || invite.school.status !== 'ACTIVE') {
        throw new Error('Link is invalid or expired. Contact your school admin.');
      }

      // Hash password using bcrypt
      const hashedPassword = await bcrypt.hash(password, 10);

      // 1. Update staff to ACTIVE with their chosen password
      await tx.user.update({
        where: { id: invite.staffId },
        data: {
          password: hashedPassword,
          status: 'ACTIVE'
        }
      });

      const now = new Date();

      // 2. Mark this invite as used
      await tx.staffInvite.update({
        where: { id: invite.id },
        data: { usedAt: now }
      });

      // 3. Revoke any other open invites for that staff
      await tx.staffInvite.updateMany({
        where: {
          staffId: invite.staffId,
          id: { not: invite.id },
          usedAt: null,
          revokedAt: null
        },
        data: { revokedAt: now }
      });
    });

    res.json({
      success: true,
      message: 'Registration completed successfully! You can now log in.'
    });
  } catch (error) {
    console.error('Complete staff registration error:', error);
    res.status(400).json({
      error: error.message || 'Failed to complete registration. Please try again or contact your administrator.'
    });
  }
});

module.exports = router;
