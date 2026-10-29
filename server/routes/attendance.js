const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken, requireTenantAccess, requireModulePermission } = require('../middleware');

// POST /api/schools/:schoolId/attendance
// Save/Mark Attendance for a class session
router.post('/', authenticateToken, requireTenantAccess, requireModulePermission('attendance', 'CREATE'), async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, date, session, entries } = req.body;
    const prisma = req.prisma;

    if (!classId || !date || !session || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'classId, date, session, and entries are required' });
    }

    // Verify classId belongs to this school to prevent cross-tenant attendance injection
    const targetClass = await prisma.class.findFirst({
      where: { id: classId, schoolId }
    });

    if (!targetClass) {
      return res.status(404).json({ error: 'Class not found in this school' });
    }

    // Upsert Attendance Header
    const attendance = await prisma.attendance.upsert({
      where: {
        schoolId_classId_date_session: {
          schoolId,
          classId,
          date,
          session: session.toUpperCase()
        }
      },
      update: {
        markedBy: req.user.id,
        updatedAt: new Date()
      },
      create: {
        schoolId,
        classId,
        date,
        session: session.toUpperCase(),
        markedBy: req.user.id
      }
    });

    // Delete existing entries for this attendance header and recreate in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.attendanceEntry.deleteMany({
        where: { attendanceId: attendance.id }
      });

      if (entries.length > 0) {
        await tx.attendanceEntry.createMany({
          data: entries.map(e => ({
            attendanceId: attendance.id,
            studentId: e.studentId,
            status: e.status ? e.status.toUpperCase() : 'PRESENT'
          }))
        });
      }
    });

    // Broadcast attendance update via Socket.io
    if (req.io) {
      req.io.to(schoolId).emit('attendance_updated', {
        classId,
        date,
        session,
        markedBy: req.user.id
      });
    }

    res.json({ message: 'Attendance marked successfully', attendanceId: attendance.id });
  } catch (error) {
    console.error('Error saving attendance:', error);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

// GET /api/schools/:schoolId/attendance
// Query Attendance records
router.get('/', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, date, session, studentId } = req.query;
    const prisma = req.prisma;

    let studentFilter = studentId ? { studentId } : {};

    // Scoping for Parents: only permit querying attendance for their linked students
    if (req.user.role === 'PARENT') {
      const parentLinks = await prisma.parentStudent.findMany({
        where: { parent: { userId: req.user.id, schoolId } },
        select: { studentId: true }
      });
      const allowedIds = parentLinks.map(l => l.studentId);

      if (allowedIds.length === 0) {
        return res.json([]);
      }

      if (studentId) {
        if (!allowedIds.includes(studentId)) {
          return res.status(403).json({ error: 'Access denied: not authorized to view this student attendance', code: 'FORBIDDEN' });
        }
        studentFilter = { studentId };
      } else {
        studentFilter = { studentId: { in: allowedIds } };
      }
    }

    const whereClause = { schoolId };
    if (classId) whereClause.classId = classId;
    if (date) whereClause.date = date;
    if (session) whereClause.session = session.toUpperCase();

    const records = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        entries: {
          where: studentFilter,
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, admissionNo: true }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json(records);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

module.exports = router;
