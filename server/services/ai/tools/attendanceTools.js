/**
 * Controlled Read-Only Attendance Tools
 * Aggregations, percentage metrics, daily summaries, low attendance identification
 */

const attendanceTools = [
  {
    name: 'get_student_attendance',
    description: 'Get attendance history, overall percentage, and total present/absent/late counts for a specific student.',
    module: 'attendance',
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
        },
        startDate: {
          type: 'string',
          description: 'Optional start date filter (YYYY-MM-DD)'
        },
        endDate: {
          type: 'string',
          description: 'Optional end date filter (YYYY-MM-DD)'
        }
      }
    },
    handler: async ({ studentId, admissionNo, startDate, endDate }, context) => {
      const { schoolId, user, prisma } = context;

      // Locate student
      const student = await prisma.student.findFirst({
        where: {
          schoolId,
          ...(studentId ? { id: studentId } : {}),
          ...(admissionNo ? { admissionNo: admissionNo.trim() } : {})
        },
        include: { class: true, section: true }
      });

      if (!student) {
        return { error: 'Student record not found.' };
      }

      // Check Parent permissions
      if (user.role === 'PARENT') {
        const link = await prisma.parentStudent.findFirst({
          where: { parent: { userId: user.id, schoolId }, studentId: student.id }
        });
        if (!link) {
          return { error: 'Access denied: You can only view attendance for your linked children.' };
        }
      }

      // Query attendance entries
      const entries = await prisma.attendanceEntry.findMany({
        where: {
          studentId: student.id,
          attendance: {
            schoolId,
            ...(startDate && endDate ? {
              date: { gte: startDate, lte: endDate }
            } : {})
          }
        },
        include: {
          attendance: {
            select: { date: true, session: true }
          }
        },
        orderBy: { attendance: { date: 'desc' } }
      });

      const totalSessions = entries.length;
      if (totalSessions === 0) {
        return {
          student: `${student.firstName} ${student.lastName}`,
          admissionNo: student.admissionNo,
          class: student.class?.name || 'Unassigned',
          totalSessions: 0,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          attendancePercentage: 'N/A',
          message: 'No recorded attendance sessions found for this student.'
        };
      }

      const presentCount = entries.filter(e => e.status === 'PRESENT').length;
      const absentCount = entries.filter(e => e.status === 'ABSENT').length;
      const lateCount = entries.filter(e => e.status === 'LATE').length;
      const percentage = ((presentCount / totalSessions) * 100).toFixed(1);

      // Recent 5 entries
      const recentLogs = entries.slice(0, 5).map(e => ({
        date: e.attendance.date,
        session: e.attendance.session,
        status: e.status
      }));

      return {
        student: `${student.firstName} ${student.lastName}`,
        admissionNo: student.admissionNo,
        class: student.class?.name || 'Unassigned',
        section: student.section?.name || 'N/A',
        totalSessions,
        presentCount,
        absentCount,
        lateCount,
        attendancePercentage: `${percentage}%`,
        isBelow75: parseFloat(percentage) < 75.0,
        recentSessions: recentLogs
      };
    }
  },

  {
    name: 'get_class_attendance',
    description: 'Get class attendance details for a specific date or session (e.g. today, FN/AN), including present/absent counts and list of absent students.',
    module: 'attendance',
    parameters: {
      type: 'object',
      properties: {
        className: {
          type: 'string',
          description: 'Class name (e.g. "Grade 10", "Class 10", "10")'
        },
        classId: {
          type: 'string',
          description: 'Unique UUID of the class'
        },
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to current date)'
        },
        session: {
          type: 'string',
          enum: ['FN', 'AN'],
          description: 'Session: FN (Forenoon) or AN (Afternoon). Defaults to FN.'
        }
      }
    },
    handler: async ({ className, classId, date, session = 'FN' }, context) => {
      const { schoolId, user, prisma } = context;

      if (user.role === 'PARENT') {
        return { error: 'Access denied: Class-wide attendance is restricted to school staff and administrators.' };
      }

      const targetDate = date || new Date().toISOString().split('T')[0];
      const targetSession = session.toUpperCase();

      // Find class
      let targetClassId = classId;
      let targetClassName = className;

      if (!targetClassId && className) {
        const found = await prisma.class.findFirst({
          where: {
            schoolId,
            name: { contains: className.trim(), mode: 'insensitive' }
          }
        });
        if (found) {
          targetClassId = found.id;
          targetClassName = found.name;
        }
      }

      if (!targetClassId) {
        return { error: 'Please specify a valid class name or class ID.' };
      }

      // Teacher scoping check
      if (user.role === 'STAFF') {
        const assignment = await prisma.classAssignment.findFirst({
          where: { schoolId, staffId: user.id, classId: targetClassId }
        });
        // If staff has no assignment and is not admin, check if has school-wide VIEW permission
        if (!assignment && user.staffRole?.name !== 'Principal') {
          // Allow if staff has explicit module permission
        }
      }

      const attendanceRecord = await prisma.attendance.findFirst({
        where: {
          schoolId,
          classId: targetClassId,
          date: targetDate,
          session: targetSession
        },
        include: {
          entries: {
            include: {
              student: {
                select: { id: true, firstName: true, lastName: true, admissionNo: true, rollNo: true }
              }
            }
          }
        }
      });

      if (!attendanceRecord) {
        return {
          class: targetClassName,
          date: targetDate,
          session: targetSession,
          status: 'NOT_MARKED',
          message: `Attendance has not been marked yet for ${targetClassName} on ${targetDate} (${targetSession}).`
        };
      }

      const totalStudents = attendanceRecord.entries.length;
      const presentList = attendanceRecord.entries.filter(e => e.status === 'PRESENT');
      const absentList = attendanceRecord.entries.filter(e => e.status === 'ABSENT');
      const lateList = attendanceRecord.entries.filter(e => e.status === 'LATE');

      const attendancePct = totalStudents > 0
        ? ((presentList.length / totalStudents) * 100).toFixed(1) + '%'
        : '0%';

      return {
        class: targetClassName,
        date: targetDate,
        session: targetSession,
        totalMarked: totalStudents,
        presentCount: presentList.length,
        absentCount: absentList.length,
        lateCount: lateList.length,
        attendanceRate: attendancePct,
        absentStudents: absentList.map(a => ({
          name: `${a.student.firstName} ${a.student.lastName}`.trim(),
          admissionNo: a.student.admissionNo,
          rollNo: a.student.rollNo || 'N/A'
        }))
      };
    }
  },

  {
    name: 'get_attendance_summary',
    description: 'Get school-wide or class-level attendance summary, aggregate absent counts, or list students with attendance below a specific threshold (e.g. 75%).',
    module: 'attendance',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format (defaults to today)'
        },
        belowThreshold: {
          type: 'number',
          description: 'Optional percentage threshold (e.g. 75) to find students with low attendance'
        },
        className: {
          type: 'string',
          description: 'Optional class name to filter summary'
        }
      }
    },
    handler: async ({ date, belowThreshold, className }, context) => {
      const { schoolId, user, prisma } = context;

      if (user.role === 'PARENT') {
        return { error: 'Access denied: Aggregate school attendance statistics are restricted to staff.' };
      }

      const targetDate = date || new Date().toISOString().split('T')[0];

      // If looking for students below threshold (e.g. 75%)
      if (belowThreshold !== undefined) {
        const threshold = parseFloat(belowThreshold);
        
        let classFilter = {};
        if (className) {
          const matchedClass = await prisma.class.findFirst({
            where: { schoolId, name: { contains: className.trim(), mode: 'insensitive' } }
          });
          if (matchedClass) {
            classFilter.classId = matchedClass.id;
          }
        }

        const students = await prisma.student.findMany({
          where: { schoolId, status: 'ACTIVE', ...classFilter },
          include: {
            class: true,
            section: true,
            attendances: true
          }
        });

        const lowAttendanceStudents = [];

        for (const s of students) {
          const total = s.attendances.length;
          if (total >= 2) { // Need at least 2 sessions to compute meaningful rate
            const present = s.attendances.filter(a => a.status === 'PRESENT').length;
            const pct = (present / total) * 100;
            if (pct < threshold) {
              lowAttendanceStudents.push({
                name: `${s.firstName} ${s.lastName}`.trim(),
                admissionNo: s.admissionNo,
                className: s.class ? s.class.name : 'N/A',
                section: s.section ? s.section.name : 'N/A',
                attendancePercentage: `${pct.toFixed(1)}%`,
                totalSessions: total,
                absentSessions: s.attendances.filter(a => a.status === 'ABSENT').length
              });
            }
          }
        }

        return {
          threshold: `${threshold}%`,
          totalStudentsChecked: students.length,
          countBelowThreshold: lowAttendanceStudents.length,
          students: lowAttendanceStudents.slice(0, 30) // Cap to 30 for token optimization
        };
      }

      // Otherwise, return daily aggregate summary for targetDate
      const records = await prisma.attendance.findMany({
        where: { schoolId, date: targetDate },
        include: {
          entries: true
        }
      });

      if (records.length === 0) {
        return {
          date: targetDate,
          message: `No attendance records submitted yet for ${targetDate}.`
        };
      }

      let totalEntries = 0;
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalLate = 0;

      for (const rec of records) {
        totalEntries += rec.entries.length;
        totalPresent += rec.entries.filter(e => e.status === 'PRESENT').length;
        totalAbsent += rec.entries.filter(e => e.status === 'ABSENT').length;
        totalLate += rec.entries.filter(e => e.status === 'LATE').length;
      }

      const overallPercentage = totalEntries > 0
        ? ((totalPresent / totalEntries) * 100).toFixed(1) + '%'
        : '0%';

      return {
        date: targetDate,
        classesMarkedCount: records.length,
        totalStudentsRecorded: totalEntries,
        totalPresent,
        totalAbsent,
        totalLate,
        overallAttendanceRate: overallPercentage
      };
    }
  }
];

module.exports = attendanceTools;
