const express = require('express');
const router = express.Router();
const { authenticateToken, requireActiveSchool, requireRole } = require('../middleware');

const MODULE_CATALOG = [
  { id: 'attendance', label: 'Attendance Management', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'classes', label: 'Classes & Sections', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'subjects', label: 'Subject Management', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'students', label: 'Student Directory & Admissions', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'staff', label: 'Staff Management', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'timetables', label: 'Timetables & Scheduling', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'calendar', label: 'Academic Calendar', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'exams', label: 'Examinations & Report Cards', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'homework', label: 'Homework & Assignments', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'fees', label: 'Fees & Payments', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'leaves', label: 'Leave Requests', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'noticeboard', label: 'Noticeboard & Announcements', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'chats', label: 'Chat & Messaging', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'library', label: 'Library Management', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'transport', label: 'Transport Management', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'inventory', label: 'Inventory & Assets', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'hr-payroll', label: 'HR & Payroll', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'reports', label: 'Reports & Analytics', actions: ['VIEW'] },
  { id: 'canteen', label: 'Canteen Management', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'leads', label: 'Leads & Inquiries', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] },
  { id: 'form-builder', label: 'Custom Forms', actions: ['VIEW', 'CREATE', 'EDIT', 'DELETE'] }
];

// All roles endpoints are protected
router.use(authenticateToken, requireActiveSchool, requireRole(['ADMIN', 'SUPER_ADMIN']));

// GET /api/roles/modules
// Catalog of all available module keys and their actions
router.get('/modules', (req, res) => {
  res.json(MODULE_CATALOG);
});

// GET /api/roles
// List all roles for this school
router.get('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    let roles = await prisma.staffRole.findMany({
      where: { schoolId },
      include: {
        _count: { select: { users: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Auto-seed default roles if school has none
    if (roles.length === 0) {
      const defaultRoles = [
        { name: 'Principal', isSystemRole: true, permissions: { ALL: true } },
        { name: 'Vice Principal', isSystemRole: false, permissions: { attendance: { read: true, create: true, edit: true }, exams: { read: true, create: true } } },
        { name: 'Class Teacher', isSystemRole: true, permissions: { attendance: { read: true, create: true, edit: true }, homework: { read: true, create: true, edit: true } } },
        { name: 'Subject Teacher', isSystemRole: false, permissions: { attendance: { read: true, create: true }, homework: { read: true, create: true } } },
        { name: 'Accountant', isSystemRole: false, permissions: { fees: { read: true, create: true, edit: true } } }
      ];

      for (const r of defaultRoles) {
        await prisma.staffRole.create({
          data: {
            schoolId,
            name: r.name,
            isSystemRole: r.isSystemRole,
            permissions: r.permissions
          }
        });
      }

      roles = await prisma.staffRole.findMany({
        where: { schoolId },
        include: { _count: { select: { users: true } } }
      });
    }

    res.json(roles);
  } catch (error) {
    console.error('Fetch roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// POST /api/roles
// Create a new role
router.post('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { name, permissions } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const existing = await prisma.staffRole.findUnique({
      where: {
        schoolId_name: {
          schoolId: req.user.schoolId,
          name: name.trim()
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'A role with this name already exists' });
    }

    const role = await prisma.staffRole.create({
      data: {
        schoolId: req.user.schoolId,
        name: name.trim(),
        isSystemRole: false,
        permissions: permissions || {}
      }
    });

    res.status(201).json(role);
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /api/roles/:roleId/permissions
// Update the permission matrix for a role
router.put('/:roleId/permissions', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { permissions, name } = req.body;

    const role = await prisma.staffRole.findFirst({
      where: { id: req.params.roleId, schoolId: req.user.schoolId }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const updated = await prisma.staffRole.update({
      where: { id: req.params.roleId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(permissions !== undefined ? { permissions } : {})
      }
    });

    res.json({ message: 'Permissions updated successfully', role: updated });
  } catch (error) {
    console.error('Update permissions error:', error);
    res.status(500).json({ error: 'Failed to update role permissions' });
  }
});

// DELETE /api/roles/:roleId
router.delete('/:roleId', async (req, res) => {
  try {
    const prisma = req.prisma;

    const role = await prisma.staffRole.findFirst({
      where: { id: req.params.roleId, schoolId: req.user.schoolId }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (role.isSystemRole) {
      return res.status(400).json({ error: 'System roles cannot be deleted' });
    }

    await prisma.staffRole.delete({
      where: { id: req.params.roleId }
    });

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

module.exports = router;
