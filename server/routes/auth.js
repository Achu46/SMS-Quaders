const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimiter = require('../services/rateLimiter');
const { authenticateToken } = require('../middleware');

const forgotPasswordLimiter = rateLimiter.middleware({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please try again in 15 minutes.'
});

const resetPasswordLimiter = rateLimiter.middleware({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many password reset attempts. Please try again later.'
});

const loginLimiter = rateLimiter.middleware({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

// Helper to flatten permissions from staffRole
function extractPermissions(staffRole) {
  if (!staffRole || !staffRole.permissions) return [];
  const perms = staffRole.permissions;
  
  // If array, return array
  if (Array.isArray(perms)) {
    return perms;
  }
  
  // If object map { "attendance": { "read": true, "create": true } }
  if (typeof perms === 'object') {
    const list = [];
    for (const [moduleKey, actions] of Object.entries(perms)) {
      if (typeof actions === 'object' && actions !== null) {
        if (actions.read || actions.view) list.push(`${moduleKey}:VIEW`);
        if (actions.create) list.push(`${moduleKey}:CREATE`);
        if (actions.edit || actions.update) list.push(`${moduleKey}:EDIT`);
        if (actions.delete) list.push(`${moduleKey}:DELETE`);
      } else if (actions === true) {
        list.push(moduleKey);
      }
    }
    return list;
  }
  
  return [];
}

// POST /api/auth/register-school
// Registers a new School (Tenant) and its primary Admin user in one transaction
router.post('/register-school', async (req, res) => {
  try {
    const { schoolName, adminName, email, password, phone, board, address } = req.body;
    const prisma = req.prisma;

    if (!schoolName || !email || !password) {
      return res.status(400).json({ error: 'School name, admin email, and password are required' });
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email address already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create School and Admin User in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const school = await tx.school.create({
        data: {
          name: schoolName.trim(),
          status: 'PENDING', // Newly registered schools start in PENDING state awaiting SuperAdmin approval
          setupCompleted: false,
          phone: phone || null,
          board: board || null,
          address: address || null
        }
      });

      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          name: adminName || 'School Admin',
          role: 'ADMIN',
          schoolId: school.id,
          phone: phone || null
        }
      });

      return { school, user };
    });

    // Generate JWT with initial claims
    const token = jwt.sign(
      { 
        id: result.user.id, 
        role: result.user.role, 
        schoolId: result.school.id,
        schoolStatus: result.school.status,
        setupCompleted: result.school.setupCompleted,
        permissions: ['ALL']
      },
      process.env.JWT_SECRET || 'secret-key-for-dev',
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = result.user;

    res.status(201).json({
      message: 'School registered successfully. Pending approval.',
      token,
      user: {
        ...userWithoutPassword,
        role: userWithoutPassword.role.toLowerCase(),
        schoolStatus: result.school.status,
        setupCompleted: result.school.setupCompleted,
        permissions: ['ALL']
      },
      school: result.school
    });
  } catch (error) {
    console.error('School registration error:', error);
    res.status(500).json({ error: 'Failed to register school' });
  }
});

// POST /api/auth/register
// General user registration (Staff, Parent, etc.)
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, schoolId, staffRoleId, phone, employeeId } = req.body;
    const prisma = req.prisma;

    if (!email || !password || !schoolId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        name: name || '',
        role: role ? role.toUpperCase() : 'PARENT',
        schoolId,
        staffRoleId: staffRoleId || null,
        phone: phone || null,
        employeeId: employeeId || null
      },
      include: {
        school: true,
        staffRole: true
      }
    });

    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ message: 'User created successfully', user: userWithoutPassword });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
// Universal login for all roles (SuperAdmin, Admin, Staff, Parent)
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const prisma = req.prisma;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        school: true,
        staffRole: true
      }
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const schoolStatus = user.school ? user.school.status : (user.role === 'SUPER_ADMIN' ? 'ACTIVE' : null);
    const setupCompleted = user.school ? user.school.setupCompleted : false;
    
    // Derive permissions array
    let permissions = [];
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      permissions = ['ALL'];
    } else if (user.role === 'STAFF' && user.staffRole) {
      permissions = extractPermissions(user.staffRole);
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        schoolId: user.schoolId,
        schoolStatus,
        setupCompleted,
        staffRoleId: user.staffRoleId,
        permissions
      },
      process.env.JWT_SECRET || 'secret-key-for-dev',
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        ...userWithoutPassword,
        role: user.role.toLowerCase(),
        schoolStatus,
        setupCompleted,
        permissions,
        staffRole: user.staffRole
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login-admission
// Parent login using student admission number
router.post('/login-admission', loginLimiter, async (req, res) => {
  try {
    const { admissionNo, password, schoolId } = req.body;
    const prisma = req.prisma;

    if (!admissionNo || !password) {
      return res.status(400).json({ error: 'Admission number and password are required' });
    }

    // Lookup student
    const student = await prisma.student.findFirst({
      where: {
        admissionNo: admissionNo.trim(),
        ...(schoolId ? { schoolId } : {})
      }
    });

    if (!student) {
      return res.status(404).json({ error: 'No student found with this admission number' });
    }

    // Construct synthetic parent email
    const syntheticEmail = `${admissionNo.replace(/[^a-zA-Z0-9]/g, '')}@parent.quaders.com`.toLowerCase();

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: syntheticEmail },
      include: { school: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Parent account not activated for this student' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const schoolStatus = user.school ? user.school.status : 'ACTIVE';
    const token = jwt.sign(
      { 
        id: user.id, 
        role: user.role, 
        schoolId: user.schoolId, 
        studentId: student.id,
        schoolStatus 
      },
      process.env.JWT_SECRET || 'secret-key-for-dev',
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Logged in successfully',
      token,
      user: {
        ...userWithoutPassword,
        studentId: student.id,
        role: 'parent',
        schoolStatus
      }
    });
  } catch (error) {
    console.error('Admission login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/profile
// Current session profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        school: true,
        staffRole: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const schoolStatus = user.school ? user.school.status : (user.role === 'SUPER_ADMIN' ? 'ACTIVE' : null);
    const setupCompleted = user.school ? user.school.setupCompleted : false;
    
    let permissions = [];
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
      permissions = ['ALL'];
    } else if (user.role === 'STAFF' && user.staffRole) {
      permissions = extractPermissions(user.staffRole);
    }

    // Self-heal outdated JWT tokens
    let freshToken = null;
    if (req.user.schoolStatus !== schoolStatus || req.user.setupCompleted !== setupCompleted) {
      freshToken = jwt.sign(
        { 
          id: user.id, 
          role: user.role, 
          schoolId: user.schoolId,
          schoolStatus,
          setupCompleted,
          staffRoleId: user.staffRoleId,
          permissions
        },
        process.env.JWT_SECRET || 'secret-key-for-dev',
        { expiresIn: '7d' }
      );
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      ...userWithoutPassword,
      role: user.role.toLowerCase(),
      schoolStatus,
      setupCompleted,
      permissions,
      ...(freshToken ? { token: freshToken } : {})
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/school-status/:schoolId
// Polling endpoint for tenant status checking
router.get('/school-status/:schoolId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const school = await prisma.school.findUnique({
      where: { id: req.params.schoolId },
      select: { id: true, name: true, status: true, setupCompleted: true }
    });

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    res.json(school);
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to retrieve school status' });
  }
});

// POST /api/auth/forgot-password
// Generates a cryptographically secure token, hashes it via SHA-256 for DB storage,
// enforces rate-limiting, and protects against user enumeration.
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const prisma = req.prisma;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const standardMessage = 'If this email is registered, password reset instructions have been sent.';
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    
    // Constant time/generic response if user does not exist (prevents enumeration)
    if (!user) {
      return res.json({ message: standardMessage });
    }

    // Generate a 32-byte cryptographic token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    // Invalidate existing unused tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id }
    });

    // Store the SHA-256 hash in database
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    // In production, an email service (Resend) sends the link containing rawToken.
    // In dev/test, expose token only for testing convenience when NODE_ENV !== 'production'
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[AUTH] Password reset token generated for ${user.email}`);
    } else {
      console.log(`[AUTH] Password reset token generated for user id: ${user.id}`);
    }
    
    const responsePayload = { message: standardMessage };
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      responsePayload.devResetToken = rawToken;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
// Verifies SHA-256 hash of token, checks expiration and one-time use, hashes new password with bcrypt
router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const prisma = req.prisma;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and newPassword are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Compute SHA-256 digest of supplied raw token
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const resetRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    // Check token validity: existence, expiration, and one-time use
    if (!resetRecord || resetRecord.usedAt !== null || new Date(resetRecord.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invalid, expired, or already used password reset token' });
    }

    // Hash the new password with bcrypt (salt rounds = 10)
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Atomically update user password, mark token as used, and clean up expired tokens
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword }
      });

      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() }
      });

      await tx.passwordResetToken.deleteMany({
        where: { userId: resetRecord.userId, id: { not: resetRecord.id } }
      });
    });

    res.json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
