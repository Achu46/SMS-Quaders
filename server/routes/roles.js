const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { 
  authenticateToken, 
  requireActiveSchool, 
  requireAcademicSetup, 
  requireRole, 
  invalidateRoleCache 
} = require('../middleware');

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

// Zod Schemas
const permissionSchema = z.object({
  moduleKey: z.string().min(1, 'moduleKey is required'),
  canCreate: z.boolean().default(false),
  canRead: z.boolean().default(false),
  canUpdate: z.boolean().default(false),
  canDelete: z.boolean().default(false)
});

const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').trim(),
  description: z.string().optional().nullable(),
  permissions: z.array(permissionSchema).min(1, 'Role must have at least one module permission')
});

const updateRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required').trim().optional(),
  description: z.string().optional().nullable(),
  permissions: z.array(permissionSchema).min(1, 'Role must have at least one module permission').optional()
});

// All roles endpoints are protected and require active school + completed academic setup
router.use(authenticateToken, requireActiveSchool, requireAcademicSetup, requireRole(['ADMIN', 'SUPER_ADMIN']));

// GET /api/roles/modules
// Catalog of all available module keys and their actions
router.get('/modules', async (req, res) => {
  try {
    if (req.prisma && req.prisma.module) {
      const dbModules = await req.prisma.module.findMany({
        orderBy: [{ category: 'asc' }, { name: 'asc' }]
      });
      if (dbModules && dbModules.length > 0) {
        return res.json(dbModules.map(m => ({
          id: m.id,
          label: m.name,
          category: m.category,
          description: m.description,
          isCore: m.isCore,
          actions: m.actions
        })));
      }
    }
  } catch (err) {
    // Fallback to static catalog
  }
  res.json(MODULE_CATALOG);
});

// GET /api/roles
// List all custom roles for this college/school (ZERO default roles seeded)
router.get('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const collegeId = req.user.schoolId;

    const roles = await prisma.role.findMany({
      where: { collegeId },
      include: {
        permissions: true,
        _count: { select: { users: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(roles);
  } catch (error) {
    console.error('Fetch roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// POST /api/roles
// Create a new role with module permissions scoped by collegeId
router.post('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const collegeId = req.user.schoolId;

    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues ? parsed.error.issues.map(e => e.message).join(', ') : 'Validation error';
      return res.status(400).json({ error: msg });
    }

    const { name, description, permissions } = parsed.data;

    // Verify at least one module has at least one active CRUD flag
    const hasActivePermission = permissions.some(
      p => p.canCreate || p.canRead || p.canUpdate || p.canDelete
    );
    if (!hasActivePermission) {
      return res.status(400).json({ error: 'A role must have at least one active module permission (Create, Read, Update, or Delete).' });
    }

    // Enforce uniqueness per collegeId
    const existing = await prisma.role.findUnique({
      where: {
        collegeId_name: {
          collegeId,
          name
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'A role with this name already exists for this college/school.' });
    }

    // Create Role and its RolePermission entries in a transaction
    const newRole = await prisma.$transaction(async (tx) => {
      const createdRole = await tx.role.create({
        data: {
          collegeId,
          name,
          description: description || null,
          permissionsVersion: 1
        }
      });

      for (const p of permissions) {
        await tx.rolePermission.create({
          data: {
            roleId: createdRole.id,
            moduleKey: p.moduleKey.trim(),
            canCreate: p.canCreate || false,
            canRead: p.canRead || false,
            canUpdate: p.canUpdate || false,
            canDelete: p.canDelete || false
          }
        });
      }

      return tx.role.findUnique({
        where: { id: createdRole.id },
        include: { permissions: true, _count: { select: { users: true } } }
      });
    });

    // Invalidate cache and broadcast to tenant
    invalidateRoleCache(newRole.id);
    if (req.io) {
      req.io.to(collegeId).emit('permissions-updated', {
        schoolId: collegeId,
        roleId: newRole.id,
        roleName: newRole.name,
        permissionsVersion: newRole.permissionsVersion,
        type: 'ROLE_CREATED'
      });
    }

    res.status(201).json(newRole);
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// PUT /api/roles/:roleId
// Update an existing role in-place with upserts and version increment
router.put('/:roleId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const collegeId = req.user.schoolId;
    const roleId = req.params.roleId;

    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      const msg = parsed.error.issues ? parsed.error.issues.map(e => e.message).join(', ') : 'Validation error';
      return res.status(400).json({ error: msg });
    }

    const { name, description, permissions } = parsed.data;

    const existingRole = await prisma.role.findFirst({
      where: { id: roleId, collegeId }
    });

    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // If name is changing, check uniqueness
    if (name && name !== existingRole.name) {
      const nameTaken = await prisma.role.findUnique({
        where: { collegeId_name: { collegeId, name } }
      });
      if (nameTaken) {
        return res.status(400).json({ error: 'A role with this name already exists' });
      }
    }

    // If permissions provided, ensure at least one active flag
    if (permissions) {
      const hasActive = permissions.some(p => p.canCreate || p.canRead || p.canUpdate || p.canDelete);
      if (!hasActive) {
        return res.status(400).json({ error: 'A role must have at least one active module permission.' });
      }
    }

    // In-place transaction update
    const updatedRole = await prisma.$transaction(async (tx) => {
      // 1. Update role name/description and increment permissionsVersion in place
      await tx.role.update({
        where: { id: roleId },
        data: {
          ...(name ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          permissionsVersion: { increment: 1 }
        }
      });

      if (permissions && Array.isArray(permissions)) {
        // Fetch current permission rows for this role
        const currentPerms = await tx.rolePermission.findMany({
          where: { roleId }
        });

        const payloadKeys = new Set(permissions.map(p => p.moduleKey.trim()));

        // Delete removed modules
        const toDelete = currentPerms.filter(cp => !payloadKeys.has(cp.moduleKey));
        if (toDelete.length > 0) {
          await tx.rolePermission.deleteMany({
            where: { id: { in: toDelete.map(d => d.id) } }
          });
        }

        // Upsert changed permission rows by (roleId, moduleKey) in place
        for (const p of permissions) {
          const mKey = p.moduleKey.trim();
          await tx.rolePermission.upsert({
            where: {
              roleId_moduleKey: {
                roleId,
                moduleKey: mKey
              }
            },
            update: {
              canCreate: p.canCreate || false,
              canRead: p.canRead || false,
              canUpdate: p.canUpdate || false,
              canDelete: p.canDelete || false
            },
            create: {
              roleId,
              moduleKey: mKey,
              canCreate: p.canCreate || false,
              canRead: p.canRead || false,
              canUpdate: p.canUpdate || false,
              canDelete: p.canDelete || false
            }
          });
        }
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: { permissions: true, _count: { select: { users: true } } }
      });
    });

    // Invalidate server cache
    invalidateRoleCache(roleId);

    // Broadcast real-time permissions update to all connected sessions in tenant room & global broadcast
    if (req.io) {
      const socketPayload = {
        schoolId: collegeId,
        roleId,
        roleName: updatedRole.name,
        permissionsVersion: updatedRole.permissionsVersion,
        type: 'ROLE_UPDATED'
      };
      req.io.to(collegeId).emit('permissions-updated', socketPayload);
      req.io.emit('permissions-updated', socketPayload);
    }

    res.json({ message: 'Role updated successfully', role: updatedRole });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/roles/:roleId
// Delete a role - BLOCKED with 409 Conflict if staff members are currently assigned
router.delete('/:roleId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const collegeId = req.user.schoolId;
    const roleId = req.params.roleId;

    const role = await prisma.role.findFirst({
      where: { id: roleId, collegeId },
      include: {
        _count: { select: { users: true } }
      }
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    if (role._count.users > 0) {
      return res.status(409).json({
        error: `Cannot delete role '${role.name}' because it is assigned to ${role._count.users} staff member(s). Reassign them first.`,
        count: role._count.users
      });
    }

    await prisma.role.delete({
      where: { id: roleId }
    });

    // Invalidate server cache
    invalidateRoleCache(roleId);

    if (req.io) {
      req.io.to(collegeId).emit('permissions-updated', {
        schoolId: collegeId,
        roleId,
        type: 'ROLE_DELETED'
      });
    }

    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

module.exports = router;
