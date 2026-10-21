const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { authenticateToken, requireActiveSchool, requireAcademicSetup, requireRole, requirePermission } = require('../middleware');

// All staff management routes require active school + academic setup preconditions
router.use(authenticateToken, requireActiveSchool, requireAcademicSetup);

// GET /api/staff
// List all staff for this school
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

    res.json(staffList);
  } catch (error) {
    console.error('Fetch staff error:', error);
    res.status(500).json({ error: 'Failed to fetch staff members' });
  }
});

// POST /api/staff
// Create a new staff member and assign Role
router.post('/', requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { name, email, password, phone, employeeId, staffRoleId } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    // Verify staffRoleId belongs to this school if provided
    if (staffRoleId) {
      const roleExists = await prisma.staffRole.findFirst({
        where: { id: staffRoleId, schoolId }
      });
      if (!roleExists) {
        return res.status(400).json({ error: 'Selected role does not belong to this school' });
      }
    }

    const defaultPassword = password || 'Staff@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const newStaff = await prisma.user.create({
      data: {
        schoolId,
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: phone ? phone.trim() : null,
        employeeId: employeeId ? employeeId.trim() : null,
        role: 'STAFF',
        staffRoleId: staffRoleId || null,
        status: 'ACTIVE'
      },
      include: {
        staffRole: true
      }
    });

    const { password: _, ...staffWithoutPassword } = newStaff;
    res.status(201).json({
      message: 'Staff member created successfully',
      staff: staffWithoutPassword
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Failed to create staff member' });
  }
});

// PATCH /api/staff/:id/role
// Update a staff member's assigned role
router.patch('/:id/role', requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { staffRoleId } = req.body;

    const staffMember = await prisma.user.findFirst({
      where: { id: req.params.id, schoolId, role: 'STAFF' }
    });

    if (!staffMember) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (staffRoleId) {
      const roleExists = await prisma.staffRole.findFirst({
        where: { id: staffRoleId, schoolId }
      });
      if (!roleExists) {
        return res.status(400).json({ error: 'Selected role does not belong to this school' });
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { staffRoleId: staffRoleId || null },
      include: { staffRole: true }
    });

    const { password: _, ...staffWithoutPassword } = updated;
    res.json({ message: 'Staff role updated successfully', staff: staffWithoutPassword });
  } catch (error) {
    console.error('Update staff role error:', error);
    res.status(500).json({ error: 'Failed to update staff role' });
  }
});

// POST /api/staff/assign-classes
// Assign a staff member to class, section, or subject
router.post('/assign-classes', requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { staffId, classId, sectionId, subjectId, isClassTeacher } = req.body;

    if (!staffId || !classId) {
      return res.status(400).json({ error: 'staffId and classId are required' });
    }

    // Verify staff belongs to school
    const staff = await prisma.user.findFirst({
      where: { id: staffId, schoolId, role: 'STAFF' }
    });
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Verify class belongs to school
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId }
    });
    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const assignment = await prisma.classAssignment.create({
      data: {
        schoolId,
        staffId,
        classId,
        sectionId: sectionId || null,
        subjectId: subjectId || null,
        isClassTeacher: Boolean(isClassTeacher)
      },
      include: {
        class: true,
        section: true,
        subject: true
      }
    });

    res.status(201).json({ message: 'Class assigned successfully', assignment });
  } catch (error) {
    console.error('Class assignment error:', error);
    res.status(500).json({ error: 'Failed to assign class' });
  }
});

// GET /api/staff/:id/classes
// Get all class assignments for a staff member
router.get('/:id/classes', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    const assignments = await prisma.classAssignment.findMany({
      where: {
        schoolId,
        staffId: req.params.id
      },
      include: {
        class: true,
        section: true,
        subject: true
      }
    });

    res.json(assignments);
  } catch (error) {
    console.error('Fetch staff assignments error:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

// DELETE /api/staff/assignments/:assignmentId
router.delete('/assignments/:assignmentId', requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    const existing = await prisma.classAssignment.findFirst({
      where: { id: req.params.assignmentId, schoolId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await prisma.classAssignment.delete({
      where: { id: req.params.assignmentId }
    });
    res.json({ message: 'Assignment removed successfully' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ error: 'Failed to remove assignment' });
  }
});

module.exports = router;
