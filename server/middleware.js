const jwt = require('jsonwebtoken');
const prisma = require('./prismaClient');

// Middleware to verify JWT and extract user context
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
  
  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  const secret = process.env.JWT_SECRET || 'secret-key-for-dev';
  jwt.verify(token, secret, async (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Attach decoded user payload to request
    req.user = decodedUser;

    // Attach fresh permissions, role and school status from database
    if (decodedUser.id) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: decodedUser.id },
          include: { 
            school: true, 
            customRole: {
              include: { permissions: true }
            },
            staffRole: true 
          }
        });
        if (user) {
          req.user.schoolStatus = user.school ? user.school.status : null;
          req.user.setupCompleted = user.school ? (user.school.academicSetupCompleted || user.school.setupCompleted) : false;
          req.user.academicSetupCompleted = req.user.setupCompleted;
          req.user.customRole = user.customRole;
          req.user.roleId = user.roleId;
          req.user.staffRole = user.staffRole;
        }
      } catch (dbErr) {
        console.error('Failed to attach user context:', dbErr);
      }
    }

    next();
  });
};

// Middleware to enforce Tenant Isolation (strictly derives schoolId from verified JWT)
const requireTenantAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }

  const userRole = (req.user.role || '').toUpperCase();
  const userSchoolId = req.user.schoolId;
  const targetSchoolId = req.params.schoolId || req.body.schoolId || req.query.schoolId;

  if (userRole === 'SUPER_ADMIN') {
    req.schoolId = targetSchoolId || userSchoolId;
    return next();
  }

  if (!userSchoolId) {
    return res.status(403).json({ error: 'No tenant associated with this account', code: 'TENANT_ACCESS_DENIED' });
  }

  // Reject any frontend-supplied schoolId that does not match verified session
  if (targetSchoolId && targetSchoolId !== userSchoolId) {
    return res.status(403).json({ error: 'Tenant access denied', code: 'TENANT_ACCESS_DENIED' });
  }

  // Reject tenant calls if school is PENDING or SUSPENDED
  if (req.user.schoolStatus && req.user.schoolStatus !== 'ACTIVE') {
    return res.status(403).json({
      error: req.user.schoolStatus === 'PENDING'
        ? 'Your school account is pending approval by the platform administrator.'
        : 'Your school account has been suspended. Please contact support.',
      code: 'SCHOOL_NOT_ACTIVE',
      status: req.user.schoolStatus
    });
  }

  // Bind verified schoolId to request for all downstream queries
  req.schoolId = userSchoolId;
  next();
};

// Middleware to restrict access based on Role
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = (req.user.role || '').toUpperCase();
    const normalizedRoles = roles.map(r => r.toUpperCase());

    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient role permissions', code: 'FORBIDDEN' });
    }
    next();
  };
};

// Middleware to enforce Active School Status (blocks access if school is PENDING or SUSPENDED)
const requireActiveSchool = async (req, res, next) => {
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const schoolId = req.user ? req.user.schoolId : null;
  if (!schoolId) {
    return res.status(403).json({ 
      error: 'No school associated with this user.',
      code: 'SCHOOL_NOT_FOUND'
    });
  }

  try {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { status: true, setupCompleted: true, academicSetupCompleted: true }
    });

    if (!school) {
      return res.status(403).json({ 
        error: 'School not found.',
        code: 'SCHOOL_NOT_FOUND'
      });
    }

    if (school.status !== 'ACTIVE') {
      return res.status(403).json({ 
        error: school.status === 'PENDING' 
          ? 'Your school account is pending approval by the platform administrator.'
          : 'Your school account has been suspended. Please contact support.',
        code: 'SCHOOL_NOT_ACTIVE',
        status: school.status
      });
    }

    req.school = school;
    next();
  } catch (error) {
    console.error('requireActiveSchool error:', error);
    return res.status(500).json({ error: 'Failed to verify school status' });
  }
};

// Middleware to enforce Academic Setup completion
const requireAcademicSetup = async (req, res, next) => {
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  try {
    const school = req.school || await prisma.school.findUnique({
      where: { id: req.user.schoolId },
      select: { setupCompleted: true, academicSetupCompleted: true }
    });

    const isComplete = school && (school.academicSetupCompleted === true || school.setupCompleted === true);

    if (!isComplete) {
      return res.status(403).json({
        error: 'Academic Setup must be completed before performing this operation.',
        code: 'SETUP_NOT_COMPLETED'
      });
    }

    next();
  } catch (error) {
    console.error('requireAcademicSetup error:', error);
    return res.status(500).json({ error: 'Failed to check setup status' });
  }
};

// Helper to check granular module permissions
const hasPermission = (customRoleOrStaffRole, moduleKey, action = 'VIEW') => {
  if (!customRoleOrStaffRole) return false;
  const actionNormalized = action.toUpperCase();
  const moduleNormalized = moduleKey.toLowerCase().replace(/\s+/g, '-');

  // Case 1: New RolePermission[] relation array
  if (customRoleOrStaffRole.permissions && Array.isArray(customRoleOrStaffRole.permissions)) {
    const perm = customRoleOrStaffRole.permissions.find(
      p => p && typeof p === 'object' && p.moduleKey && p.moduleKey.toLowerCase().replace(/\s+/g, '-') === moduleNormalized
    );
    if (perm) {
      if (actionNormalized === 'VIEW' || actionNormalized === 'READ') return perm.canRead === true;
      if (actionNormalized === 'CREATE') return perm.canCreate === true;
      if (actionNormalized === 'EDIT' || actionNormalized === 'UPDATE') return perm.canUpdate === true;
      if (actionNormalized === 'DELETE') return perm.canDelete === true;
    }
  }

  // Case 2: Legacy object map { "attendance": { "read": true, "create": true, ... } }
  const perms = customRoleOrStaffRole.permissions;
  if (perms && typeof perms === 'object' && !Array.isArray(perms)) {
    if (perms.ALL === true) return true;
    const modObj = perms[moduleKey] || perms[moduleNormalized] || perms[moduleKey.toLowerCase()];
    if (modObj) {
      if (actionNormalized === 'VIEW' || actionNormalized === 'READ') {
        return modObj.read === true || modObj.view === true;
      }
      if (actionNormalized === 'CREATE') return modObj.create === true;
      if (actionNormalized === 'EDIT' || actionNormalized === 'UPDATE') return modObj.edit === true || modObj.update === true;
      if (actionNormalized === 'DELETE') return modObj.delete === true;
    }
  }

  // Case 3: Flat array of strings e.g. ["ATTENDANCE:VIEW", "ATTENDANCE:CREATE"]
  if (Array.isArray(perms)) {
    if (perms.includes('ALL')) return true;
    const fullKey = `${moduleNormalized}:${actionNormalized}`;
    if (perms.includes(fullKey) || perms.includes(moduleNormalized) || perms.includes(moduleKey)) {
      return true;
    }
  }

  return false;
};

// Middleware to enforce Module-Level Permissions
const requirePermission = (moduleKey, action = 'VIEW') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const userRole = (req.user.role || '').toUpperCase();

    // Admin and Super Admin have full access to all modules
    if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
      return next();
    }

    if (userRole === 'STAFF') {
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          include: { 
            customRole: {
              include: { permissions: true }
            },
            staffRole: true 
          }
        });

        const activeRole = user ? (user.customRole || user.staffRole) : null;

        if (!activeRole) {
          return res.status(403).json({ error: 'No staff role assigned to this account', code: 'NO_STAFF_ROLE' });
        }

        if (!hasPermission(activeRole, moduleKey, action)) {
          return res.status(403).json({ 
            error: `Access denied: missing ${action} permission for module ${moduleKey}`,
            code: 'PERMISSION_DENIED',
            module: moduleKey,
            action
          });
        }

        return next();
      } catch (error) {
        console.error('requirePermission error:', error);
        return res.status(500).json({ error: 'Failed to verify staff permissions' });
      }
    }

    return res.status(403).json({ error: 'Unauthorized role for this module', code: 'FORBIDDEN' });
  };
};

// Middleware to enforce class/section scoping for teachers
const requireClassAccess = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN') {
    return next();
  }

  const classId = req.params.classId || req.body.classId || req.query.classId;
  if (!classId) return next();

  try {
    const assignment = await prisma.classAssignment.findFirst({
      where: {
        schoolId: req.user.schoolId,
        staffId: req.user.id,
        classId: classId
      }
    });

    if (!assignment) {
      return res.status(403).json({
        error: 'You are not assigned to this class/section',
        code: 'CLASS_ACCESS_DENIED'
      });
    }

    req.classAssignment = assignment;
    next();
  } catch (error) {
    console.error('requireClassAccess error:', error);
    return res.status(500).json({ error: 'Failed to verify class access' });
  }
};

module.exports = {
  authenticateToken,
  requireTenantAccess,
  requireRole,
  requireActiveSchool,
  requireAcademicSetup,
  requirePermission,
  requireModulePermission: requirePermission,
  requireClassAccess,
  hasPermission
};
