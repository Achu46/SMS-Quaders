/**
 * Controlled Read-Only School & Tenant Tools
 * Supports both Current School Profile and Super Admin Multi-School Management
 */

const schoolTools = [
  {
    name: 'get_school_info',
    description: 'Get details and summary statistics of the current school (Name, Board, Status, Address, Student count, Class count, Staff count).',
    module: 'schools',
    parameters: {
      type: 'object',
      properties: {
        schoolId: {
          type: 'string',
          description: 'Optional school ID (defaults to current school)'
        }
      }
    },
    handler: async ({ schoolId: targetSchoolId }, context) => {
      const { schoolId, user, prisma } = context;
      const effectiveSchoolId = (user.role === 'SUPER_ADMIN' && targetSchoolId) ? targetSchoolId : schoolId;

      if (!effectiveSchoolId) {
        return { error: 'No school specified.' };
      }

      const school = await prisma.school.findUnique({
        where: { id: effectiveSchoolId },
        include: {
          _count: {
            select: {
              students: true,
              classes: true,
              sections: true,
              users: true,
              feeStructures: true
            }
          }
        }
      });

      if (!school) {
        return { error: 'School not found.' };
      }

      return {
        id: school.id,
        name: school.name,
        status: school.status,
        board: school.board || 'Not specified',
        address: school.address || 'Not specified',
        phone: school.phone || 'Not specified',
        setupCompleted: school.setupCompleted,
        totalStudentsCount: school._count.students,
        totalClassesCount: school._count.classes,
        totalStaffAndUsersCount: school._count.users
      };
    }
  },

  {
    name: 'get_schools_overview',
    description: 'Get a platform-wide overview of all registered schools, total count, status breakdown (Active, Pending, Suspended), and school summary list. (Super Admin only)',
    module: 'superadmin',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['ACTIVE', 'PENDING', 'SUSPENDED'],
          description: 'Optional status filter'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of schools to return (default 20, max 50)'
        }
      }
    },
    handler: async ({ status, limit = 20 }, context) => {
      const { user, prisma } = context;

      if (user.role !== 'SUPER_ADMIN') {
        return { error: 'Access denied: Platform-wide school registration data is restricted to Super Administrators.' };
      }

      const cleanLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);

      const normalizedStatus = status ? status.toUpperCase() : undefined;

      const [schools, totalCount, activeCount, pendingCount, suspendedCount] = await Promise.all([
        prisma.school.findMany({
          where: normalizedStatus ? { status: normalizedStatus } : {},
          include: {
            _count: {
              select: {
                students: true,
                classes: true,
                users: true
              }
            }
          },
          take: cleanLimit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.school.count(),
        prisma.school.count({ where: { status: 'ACTIVE' } }),
        prisma.school.count({ where: { status: 'PENDING' } }),
        prisma.school.count({ where: { status: 'SUSPENDED' } })
      ]);

      return {
        totalSchoolsRegistered: totalCount,
        statusBreakdown: {
          activeSchools: activeCount,
          pendingApprovalSchools: pendingCount,
          suspendedSchools: suspendedCount
        },
        returnedCount: schools.length,
        schools: schools.map(s => ({
          id: s.id,
          name: s.name,
          status: s.status,
          board: s.board || 'N/A',
          phone: s.phone || 'N/A',
          totalStudents: s._count.students,
          totalClasses: s._count.classes,
          totalUsers: s._count.users,
          registeredOn: s.createdAt ? s.createdAt.toISOString().split('T')[0] : 'N/A'
        }))
      };
    }
  }
];

module.exports = schoolTools;
