/**
 * Controlled Read-Only Teacher & Timetable Tools
 */

const timetableTools = [
  {
    name: 'get_teacher',
    description: 'Find teacher profile, assigned subjects, and assigned classes.',
    module: 'staff',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Teacher name or partial name'
        },
        employeeId: {
          type: 'string',
          description: 'Teacher employee ID'
        }
      }
    },
    handler: async ({ name, employeeId }, context) => {
      const { schoolId, user, prisma } = context;

      const where = {
        schoolId,
        role: 'STAFF',
        ...(employeeId ? { employeeId: employeeId.trim() } : {}),
        ...(name ? { name: { contains: name.trim(), mode: 'insensitive' } } : {})
      };

      const teachers = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? true : false,
          phone: (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? true : false,
          employeeId: true,
          staffRole: { select: { name: true } },
          classAssignments: {
            include: {
              class: { select: { name: true } },
              section: { select: { name: true } },
              subject: { select: { name: true, code: true } }
            }
          }
        },
        take: 5
      });

      if (teachers.length === 0) {
        return { message: 'No teacher found matching the search criteria.' };
      }

      return {
        count: teachers.length,
        teachers: teachers.map(t => ({
          name: t.name,
          employeeId: t.employeeId || 'N/A',
          designation: t.staffRole?.name || 'Teacher',
          assignments: t.classAssignments.map(a => ({
            className: a.class?.name || 'N/A',
            sectionName: a.section?.name || 'N/A',
            subject: a.subject?.name || 'General',
            isClassTeacher: a.isClassTeacher
          }))
        }))
      };
    }
  },

  {
    name: 'get_teacher_schedule',
    description: 'Get weekly teaching schedule, timetable periods, and assigned classes for a specific teacher.',
    module: 'timetables',
    parameters: {
      type: 'object',
      properties: {
        teacherName: {
          type: 'string',
          description: 'Name of the teacher'
        }
      },
      required: ['teacherName']
    },
    handler: async ({ teacherName }, context) => {
      const { schoolId, prisma } = context;

      const teacher = await prisma.user.findFirst({
        where: {
          schoolId,
          role: 'STAFF',
          name: { contains: teacherName.trim(), mode: 'insensitive' }
        },
        include: {
          classAssignments: {
            include: {
              class: true,
              section: true,
              subject: true
            }
          }
        }
      });

      if (!teacher) {
        return { error: `Teacher "${teacherName}" not found.` };
      }

      // Check timetable documents for scheduled slots
      const timetableDocs = await prisma.schoolDocument.findMany({
        where: { schoolId, collection: 'timetables' }
      });

      const weeklySlots = [];
      for (const doc of timetableDocs) {
        const data = doc.data || {};
        const grid = data.schedule || data.grid || {};
        // Scan schedule matrix for this teacher
        for (const [day, periods] of Object.entries(grid)) {
          if (Array.isArray(periods)) {
            periods.forEach((period, idx) => {
              if (period && (period.teacherId === teacher.id || (period.teacherName && period.teacherName.toLowerCase().includes(teacherName.toLowerCase())))) {
                weeklySlots.push({
                  day,
                  periodNumber: idx + 1,
                  subject: period.subject || 'Subject',
                  className: data.className || period.className || 'Class',
                  time: period.time || `Period ${idx + 1}`
                });
              }
            });
          }
        }
      }

      return {
        teacherName: teacher.name,
        assignedClassesCount: teacher.classAssignments.length,
        assignedClasses: teacher.classAssignments.map(a => ({
          class: a.class?.name,
          section: a.section?.name,
          subject: a.subject?.name,
          isClassTeacher: a.isClassTeacher
        })),
        scheduledPeriodsCount: weeklySlots.length,
        schedule: weeklySlots.length > 0 ? weeklySlots : 'No scheduled timetable periods configured in the system.'
      };
    }
  },

  {
    name: 'get_class_timetable',
    description: 'Get class timetable, daily schedule, and subject periods for a specific class.',
    module: 'timetables',
    parameters: {
      type: 'object',
      properties: {
        className: {
          type: 'string',
          description: 'Name of the class (e.g. "Grade 10", "Class 10")'
        },
        day: {
          type: 'string',
          enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          description: 'Optional day of the week to view specific schedule'
        }
      },
      required: ['className']
    },
    handler: async ({ className, day }, context) => {
      const { schoolId, prisma } = context;

      const cls = await prisma.class.findFirst({
        where: { schoolId, name: { contains: className.trim(), mode: 'insensitive' } }
      });

      if (!cls) {
        return { error: `Class "${className}" not found.` };
      }

      const timetableDocs = await prisma.schoolDocument.findMany({
        where: { schoolId, collection: 'timetables' }
      });

      const matchedDoc = timetableDocs.find(d => {
        const data = d.data || {};
        return data.classId === cls.id || (data.className && data.className.toLowerCase().includes(className.toLowerCase()));
      });

      if (!matchedDoc) {
        return {
          className: cls.name,
          message: `No active timetable found for ${cls.name}.`
        };
      }

      const schedule = matchedDoc.data?.schedule || matchedDoc.data?.grid || {};

      if (day) {
        const daySchedule = schedule[day] || [];
        return {
          className: cls.name,
          day,
          periods: daySchedule.map((p, idx) => ({
            period: idx + 1,
            subject: p.subject || 'Free Period',
            teacher: p.teacherName || p.teacher || 'Unassigned',
            time: p.time || `Period ${idx + 1}`
          }))
        };
      }

      return {
        className: cls.name,
        fullSchedule: schedule
      };
    }
  }
];

module.exports = timetableTools;
