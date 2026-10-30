const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { z } = require('zod');
const emailService = require('../services/emailService');
const { authenticateToken, requireActiveSchool, requireAcademicSetup, requireRole, requirePermission } = require('../middleware');

// All staff management routes require active school + academic setup preconditions
router.use(authenticateToken, requireActiveSchool, requireAcademicSetup);

// Zod Validation Schemas
const createStaffSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Valid email address is required').trim().toLowerCase(),
  phone: z.string().optional().nullable(),
  employeeId: z.string().min(1, 'Employee ID is mandatory').trim(),
  roleId: z.string().min(1, 'Role selection is mandatory')
});

const updateStaffRoleSchema = z.object({
  roleId: z.string().min(1, 'Role selection is mandatory')
});

// GET /api/staff
// List all staff for this school with their assigned Role and Permissions
router.get('/', requirePermission('staff', 'VIEW'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    const staffList = await prisma.user.findMany({
      where: {
        schoolId,
        role: 'STAFF'
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        employeeId: true,
        status: true,
        password: true,
        roleId: true,
        customRole: {
          select: {
            id: true,
            name: true,
            permissions: true
          }
        },
        staffRoleId: true,
        staffRole: {
          select: {
            id: true,
            name: true,
            permissions: true
          }
        },
        classAssignments: {
          include: {
            class: true,
            section: true,
            subject: true
          }
        },
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const sanitized = staffList.map(({ password, ...s }) => ({ ...s, hasPassword: Boolean(password) }));
    res.json(sanitized);
  } catch (error) {
    console.error('Fetch staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff members' });
  }
});

// POST /api/staff
// Create a new staff member and assign Role scoped to collegeId
router.post('/', requirePermission('staff', 'CREATE'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const collegeId = req.user.schoolId;

    const parsed = createStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues ? parsed.error.issues.map(e => e.message).join(', ') : 'Validation error';
      return res.status(400).json({ error: msg });
    }

    const { name, email, phone, employeeId, roleId } = parsed.data;

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    const existingEmp = await prisma.user.findFirst({
      where: { schoolId: collegeId, employeeId }
    });
    if (existingEmp) {
      return res.status(400).json({ error: `A staff member with Employee ID "${employeeId}" already exists in your institution` });
    }

    // Validate that roleId belongs to the same collegeId (tenant isolation)
    const role = await prisma.role.findFirst({
      where: { id: roleId, collegeId },
      include: { permissions: true }
    });

    if (!role) {
      return res.status(400).json({ error: 'Selected role does not belong to this college/school or does not exist.' });
    }

    // Verify role has at least one active module permission
    const hasActivePermission = role.permissions && role.permissions.some(
      p => p.canCreate || p.canRead || p.canUpdate || p.canDelete
    );
    if (!hasActivePermission) {
      return res.status(400).json({ error: `The role "${role.name}" has no active module permissions. Assign at least one permission before assigning it to staff.` });
    }

    const newStaff = await prisma.user.create({
      data: {
        schoolId: collegeId,
        name,
        email,
        password: null, // Password set by staff via secure invite link
        phone: phone ? phone.trim() : null,
        employeeId: employeeId.trim(),
        role: 'STAFF',
        roleId: role.id,
        status: 'INVITED'
      },
      include: {
        customRole: {
          include: { permissions: true }
        }
      }
    });

    const { password: _, ...staffWithoutPassword } = newStaff;
    res.status(201).json({
      message: 'Staff member created successfully with status INVITED',
      staff: staffWithoutPassword
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Failed to create staff member' });
  }
});

// POST /api/staff/:id/invite
// Generate or regenerate an invite link for an INVITED staff member
router.post('/:id/invite', requirePermission('staff', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const collegeId = req.user.schoolId;
    const staffId = req.params.id;
    const { sendEmail } = req.body || {};

    const staff = await prisma.user.findFirst({
      where: {
        schoolId: collegeId,
        role: 'STAFF',
        OR: [
          { id: staffId },
          { email: staffId.toLowerCase() },
          { employeeId: staffId },
          ...(req.body?.email ? [{ email: req.body.email.toLowerCase() }] : []),
          ...(req.body?.employeeId ? [{ employeeId: req.body.employeeId }] : [])
        ]
      },
      include: {
        school: true,
        customRole: true
      }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found in your institution' });
    }

    if (staff.status === 'INACTIVE') {
      return res.status(400).json({ error: 'Cannot generate an invite for a deactivated staff member' });
    }

    // Allow generating/regenerating invite link; set status to INVITED and reset password
    if (staff.status !== 'INVITED' || staff.password !== null) {
      await prisma.user.update({
        where: { id: staff.id },
        data: { status: 'INVITED', password: null }
      });
      try {
        const teacherDocs = await prisma.schoolDocument.findMany({
          where: { schoolId: collegeId, collection: 'teachers' }
        });
        for (const tDoc of teacherDocs) {
          if (tDoc.data && (tDoc.data.email?.toLowerCase() === staff.email.toLowerCase() || tDoc.data.userId === staff.id)) {
            await prisma.schoolDocument.update({
              where: { id: tDoc.id },
              data: { data: { ...tDoc.data, status: 'Invited' } }
            });
          }
        }
      } catch (e) {
        console.warn('Teacher document status sync warning:', e.message);
      }
    }

    if (staff.school?.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Institution is not ACTIVE' });
    }

    // Generate secure URL-safe token (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Revoke any existing active/unused invites for this staff
    await prisma.staffInvite.updateMany({
      where: {
        staffId: staff.id,
        usedAt: null,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    // Expiry: 48 hours (configurable via STAFF_INVITE_EXPIRY_HOURS)
    const expiryHours = parseInt(process.env.STAFF_INVITE_EXPIRY_HOURS || '48', 10);
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);

    await prisma.staffInvite.create({
      data: {
        collegeId,
        staffId: staff.id,
        tokenHash,
        expiresAt,
        createdById: req.user.id
      }
    });

    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientBaseUrl}/staff/register?token=${rawToken}`;

    // If sendEmail is requested, dispatch email via emailService
    let emailSent = false;
    if (sendEmail) {
      try {
        await emailService.sendTemplateEmail('STAFF_INVITE', staff.email, {
          userName: staff.name,
          employeeId: staff.employeeId,
          roleName: staff.customRole?.name || 'Staff Member',
          schoolName: staff.school?.name,
          inviteUrl
        });
        emailSent = true;
      } catch (err) {
        console.warn('Failed to send staff invite email:', err.message);
      }
    }

    res.json({
      message: 'Invite link generated successfully',
      inviteUrl,
      expiresAt,
      emailSent
    });
  } catch (error) {
    console.error('Generate staff invite error:', error);
    res.status(500).json({ error: 'Failed to generate staff invite' });
  }
});

// GET /api/staff/:id/invite
// Current invite status for a staff member (none / active / expired / used / revoked)
router.get('/:id/invite', requirePermission('staff', 'VIEW'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const collegeId = req.user.schoolId;
    const staffId = req.params.id;

    const staff = await prisma.user.findFirst({
      where: { id: staffId, schoolId: collegeId, role: 'STAFF' }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found in your institution' });
    }

    if (staff.status === 'ACTIVE') {
      return res.json({ status: 'ACTIVE_USER', message: 'Staff member is already active' });
    }

    const latestInvite = await prisma.staffInvite.findFirst({
      where: { staffId: staff.id, collegeId },
      orderBy: { createdAt: 'desc' }
    });

    if (!latestInvite) {
      return res.json({ status: 'NONE' });
    }

    if (latestInvite.usedAt) {
      return res.json({ status: 'USED', usedAt: latestInvite.usedAt });
    }

    if (latestInvite.revokedAt) {
      return res.json({ status: 'REVOKED', revokedAt: latestInvite.revokedAt });
    }

    if (new Date() > new Date(latestInvite.expiresAt)) {
      return res.json({ status: 'EXPIRED', expiresAt: latestInvite.expiresAt });
    }

    return res.json({ status: 'ACTIVE', expiresAt: latestInvite.expiresAt });
  } catch (error) {
    console.error('Fetch invite status error:', error);
    res.status(500).json({ error: 'Failed to fetch invite status' });
  }
});

// POST /api/staff/:id/invite/send-email
// Send invite email to staff
router.post('/:id/invite/send-email', requirePermission('staff', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const collegeId = req.user.schoolId;
    const staffId = req.params.id;

    const staff = await prisma.user.findFirst({
      where: { id: staffId, schoolId: collegeId, role: 'STAFF' },
      include: { school: true, customRole: true }
    });

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (staff.status !== 'INVITED') {
      return res.status(400).json({ error: `Cannot send invite to staff with status ${staff.status}` });
    }

    // Always generate a fresh token when explicitly re-sending
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.staffInvite.updateMany({
      where: { staffId: staff.id, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    const expiryHours = parseInt(process.env.STAFF_INVITE_EXPIRY_HOURS || '48', 10);
    const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);

    await prisma.staffInvite.create({
      data: {
        collegeId,
        staffId: staff.id,
        tokenHash,
        expiresAt,
        createdById: req.user.id
      }
    });

    const clientBaseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const inviteUrl = `${clientBaseUrl}/staff/register?token=${rawToken}`;

    await emailService.sendTemplateEmail('STAFF_INVITE', staff.email, {
      userName: staff.name,
      employeeId: staff.employeeId,
      roleName: staff.customRole?.name || 'Staff Member',
      schoolName: staff.school?.name,
      inviteUrl
    });

    res.json({ message: `Invite email sent to ${staff.email}`, inviteUrl, expiresAt });
  } catch (error) {
    console.error('Send invite email error:', error);
    res.status(500).json({ error: 'Failed to send invite email' });
  }
});

// PATCH /api/staff/:id/role
// Update a staff member's assigned role
router.patch('/:id/role', requirePermission('staff', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const collegeId = req.user.schoolId;

    const parsed = updateStaffRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues ? parsed.error.issues.map(e => e.message).join(', ') : 'Validation error';
      return res.status(400).json({ error: msg });
    }

    const { roleId } = parsed.data;

    const staffMember = await prisma.user.findFirst({
      where: { id: req.params.id, schoolId: collegeId, role: 'STAFF' }
    });

    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Validate that roleId belongs to the same collegeId
    const role = await prisma.role.findFirst({
      where: { id: roleId, collegeId },
      include: { permissions: true }
    });

    if (!role) {
      return res.status(400).json({ error: 'Selected role does not belong to this college/school' });
    }

    const hasActivePermission = role.permissions && role.permissions.some(
      p => p.canCreate || p.canRead || p.canUpdate || p.canDelete
    );
    if (!hasActivePermission) {
      return res.status(400).json({ error: `The role "${role.name}" has no active module permissions. Assign at least one permission before assigning it to staff.` });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { roleId: role.id },
      include: {
        customRole: {
          include: { permissions: true }
        }
      }
    });

    const { password: _, ...staffWithoutPassword } = updated;
    res.json({ message: 'Staff role updated successfully', staff: staffWithoutPassword });
  } catch (error) {
    console.error('Update staff role error:', error);
    res.status(500).json({ error: 'Failed to update staff role' });
  }
});

// DELETE /api/staff/:id
// Delete a staff member
router.delete('/:id', requirePermission('staff', 'DELETE'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const collegeId = req.user.schoolId;

    const staffMember = await prisma.user.findFirst({
      where: { id: req.params.id, schoolId: collegeId, role: 'STAFF' }
    });

    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    await prisma.user.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Staff member deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    res.status(500).json({ error: 'Failed to delete staff member' });
  }
});

// POST /api/staff/assign-classes
// Assign a staff member to class, section, or subject
router.post('/assign-classes', requirePermission('staff', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { staffId, classId, sectionId, subjectId, isClassTeacher } = req.body;

    if (!staffId || !classId) {
      return res.status(400).json({ error: 'Staff ID and Class ID are required' });
    }

    const assignment = await prisma.classAssignment.create({
      data: {
        schoolId,
        staffId,
        classId,
        sectionId: sectionId || null,
        subjectId: subjectId || null,
        isClassTeacher: isClassTeacher || false
      },
      include: {
        class: true,
        section: true,
        subject: true
      }
    });

    res.status(201).json({ message: 'Class assignment created successfully', assignment });
  } catch (error) {
    console.error('Assign class error:', error);
    res.status(500).json({ error: 'Failed to assign class' });
  }
});

module.exports = router;
