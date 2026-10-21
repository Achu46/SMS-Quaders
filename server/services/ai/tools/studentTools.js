/**
 * Controlled Read-Only Student Tools
 * Enforces Tenant Isolation and Role-Based Filtering
 */

const studentTools = [
  {
    name: 'search_student',
    description: 'Search for students by full name, partial name, or admission number.',
    module: 'students',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Student name or admission number to search for'
        },
        classId: {
          type: 'string',
          description: 'Optional class ID to filter students'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of students to return (default 10, max 25)'
        }
      },
      required: ['query']
    },
    handler: async ({ query, classId, limit = 10 }, context) => {
      const { schoolId, user, prisma } = context;
      const cleanLimit = Math.min(Math.max(1, parseInt(limit, 10) || 10), 25);

      // Scoping for Parents: only search within linked children
      let parentStudentIds = null;
      if (user.role === 'PARENT') {
        const parentRecords = await prisma.parentStudent.findMany({
          where: { parent: { userId: user.id, schoolId } },
          select: { studentId: true }
        });
        parentStudentIds = parentRecords.map(p => p.studentId);
        if (parentStudentIds.length === 0) {
          return { count: 0, students: [], message: 'No linked student profiles found for this parent account.' };
        }
      }

      const where = {
        schoolId,
        status: 'ACTIVE',
        ...(classId ? { classId } : {}),
        ...(parentStudentIds ? { id: { in: parentStudentIds } } : {}),
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { admissionNo: { contains: query, mode: 'insensitive' } }
        ]
      };

      const students = await prisma.student.findMany({
        where,
        take: cleanLimit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNo: true,
          rollNo: true,
          gender: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }]
      });

      return {
        count: students.length,
        students: students.map(s => ({
          id: s.id,
          name: `${s.firstName} ${s.lastName}`.trim(),
          admissionNo: s.admissionNo,
          rollNo: s.rollNo || 'N/A',
          className: s.class ? s.class.name : 'Unassigned',
          sectionName: s.section ? s.section.name : 'N/A',
          gender: s.gender
        }))
      };
    }
  },

  {
    name: 'get_student',
    description: 'Get basic student details by student ID or exact admission number.',
    module: 'students',
    parameters: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: 'Unique UUID of the student'
        },
        admissionNo: {
          type: 'string',
          description: 'Official admission number of the student'
        }
      }
    },
    handler: async ({ studentId, admissionNo }, context) => {
      const { schoolId, user, prisma } = context;

      if (!studentId && !admissionNo) {
        return { error: 'Please provide either studentId or admissionNo.' };
      }

      const where = {
        schoolId,
        ...(studentId ? { id: studentId } : { admissionNo: admissionNo.trim() })
      };

      // Parents can only view their own children
      if (user.role === 'PARENT') {
        const parentLink = await prisma.parentStudent.findFirst({
          where: {
            parent: { userId: user.id, schoolId },
            student: where
          }
        });
        if (!parentLink) {
          return { error: 'Access denied. You can only view details of your linked child.' };
        }
      }

      const student = await prisma.student.findFirst({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNo: true,
          rollNo: true,
          gender: true,
          status: true,
          dob: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } }
        }
      });

      if (!student) {
        return { error: 'Student not found.' };
      }

      return {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
        rollNo: student.rollNo || 'N/A',
        className: student.class ? student.class.name : 'Unassigned',
        sectionName: student.section ? student.section.name : 'N/A',
        gender: student.gender,
        status: student.status,
        dob: student.dob ? student.dob.toISOString().split('T')[0] : null
      };
    }
  },

  {
    name: 'get_student_profile',
    description: 'Get comprehensive student profile including class details, section, and authorized guardian contact overview.',
    module: 'students',
    parameters: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: 'Unique UUID of the student'
        },
        admissionNo: {
          type: 'string',
          description: 'Admission number of the student'
        }
      }
    },
    handler: async ({ studentId, admissionNo }, context) => {
      const { schoolId, user, prisma } = context;

      if (!studentId && !admissionNo) {
        return { error: 'Please provide either studentId or admissionNo.' };
      }

      const where = {
        schoolId,
        ...(studentId ? { id: studentId } : { admissionNo: admissionNo.trim() })
      };

      const student = await prisma.student.findFirst({
        where,
        include: {
          class: true,
          section: true,
          parents: {
            include: {
              parent: true
            }
          }
        }
      });

      if (!student) {
        return { error: 'Student profile not found.' };
      }

      // Security check for Parent role
      if (user.role === 'PARENT') {
        const isLinked = student.parents.some(p => p.parent.userId === user.id);
        if (!isLinked) {
          return { error: 'Access denied: You are not authorized to view this student profile.' };
        }
      }

      return {
        id: student.id,
        fullName: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
        rollNo: student.rollNo || 'N/A',
        gender: student.gender,
        dob: student.dob ? student.dob.toISOString().split('T')[0] : 'Not specified',
        status: student.status,
        class: student.class ? student.class.name : 'Unassigned',
        section: student.section ? student.section.name : 'N/A',
        guardians: student.parents.map(p => ({
          name: p.parent.name,
          relation: p.parent.relation || 'Guardian',
          // Data minimization: only expose guardian phone to admin/staff
          phone: (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STAFF') ? (p.parent.phone || 'N/A') : undefined,
        }))
      };
    }
  }
];

module.exports = studentTools;
