const express = require('express');
const router = express.Router();
const { authenticateToken, requireActiveSchool, requirePermission } = require('../middleware');

router.use(authenticateToken, requireActiveSchool);

// Grade mapping function using template scale or CBSE standard
const mapToGrade = (percentage, gradingScale) => {
  const defaultScale = [
    { min: 91, max: 100, grade: 'A1' },
    { min: 81, max: 90.99, grade: 'A2' },
    { min: 71, max: 80.99, grade: 'B1' },
    { min: 61, max: 70.99, grade: 'B2' },
    { min: 51, max: 60.99, grade: 'C1' },
    { min: 41, max: 50.99, grade: 'C2' },
    { min: 33, max: 40.99, grade: 'D' },
    { min: 0, max: 32.99, grade: 'E' }
  ];

  const scale = (Array.isArray(gradingScale) && gradingScale.length > 0) ? gradingScale : defaultScale;
  for (const item of scale) {
    if (percentage >= item.min && percentage <= item.max) {
      return item.grade;
    }
  }
  return percentage >= 33 ? 'D' : 'E';
};

// Internal engine: Calculates report card data in memory
async function calculateReportCardData(prisma, schoolId, { examinationId, classId, sectionId, studentId }) {
  // 1. Fetch examination
  const examination = await prisma.examination.findFirst({
    where: { id: examinationId, schoolId },
    include: { class: true, section: true }
  });

  if (!examination) {
    throw new Error('Examination not found');
  }

  const targetClassId = classId || examination.classId;

  // 2. Fetch template
  let template = await prisma.reportCardTemplate.findFirst({
    where: { schoolId, type: 'CBSE' }
  });

  if (!template) {
    template = await prisma.reportCardTemplate.findFirst({
      where: { schoolId }
    });
  }

  const gradingScale = template?.gradingScale || null;

  // 3. Fetch assessments
  const assessments = await prisma.assessment.findMany({
    where: {
      schoolId,
      examinationId,
      ...(targetClassId ? { classId: targetClassId } : {}),
      ...(sectionId ? { sectionId } : {})
    },
    include: {
      subject: true,
      teacher: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'asc' }
  });

  // 4. Fetch students
  const students = await prisma.student.findMany({
    where: {
      schoolId,
      ...(studentId ? { id: studentId } : {}),
      ...(targetClassId ? { classId: targetClassId } : {}),
      ...(sectionId ? { sectionId } : {}),
      status: 'ACTIVE'
    },
    include: {
      class: true,
      section: true
    },
    orderBy: [
      { rollNo: 'asc' },
      { firstName: 'asc' }
    ]
  });

  // 5. Fetch grades
  const assessmentIds = assessments.map(a => a.id);
  const studentIds = students.map(s => s.id);

  const grades = await prisma.assessmentGrade.findMany({
    where: {
      schoolId,
      assessmentId: { in: assessmentIds },
      studentId: { in: studentIds }
    }
  });

  const gradeMap = {}; // `${assessmentId}_${studentId}`
  grades.forEach(g => {
    gradeMap[`${g.assessmentId}_${g.studentId}`] = g;
  });

  // 6. Aggregate attendance
  const studentAttendanceStats = {};
  for (const s of students) {
    const entries = await prisma.attendanceEntry.findMany({
      where: {
        studentId: s.id,
        attendance: {
          schoolId
        }
      },
      select: {
        status: true
      }
    });

    const totalSessions = entries.length;
    const presentSessions = entries.filter(e => e.status === 'PRESENT').length;
    const absentSessions = entries.filter(e => e.status === 'ABSENT').length;
    const attendancePercentage = totalSessions > 0
      ? Number(((presentSessions / totalSessions) * 100).toFixed(1))
      : 100.0;

    studentAttendanceStats[s.id] = {
      totalSessions,
      presentSessions,
      absentSessions,
      attendancePercentage
    };
  }

  // 7. Assemble report cards
  const generatedReports = students.map(student => {
    let totalMarksObtained = 0;
    let totalMaxMarks = 0;

    const marksBreakdown = assessments.map(assessment => {
      const g = gradeMap[`${assessment.id}_${student.id}`];
      const isAbsent = Boolean(g?.isAbsent);
      const isExempt = Boolean(g?.isExempt);
      const marksObtained = isAbsent || isExempt ? 0 : Number(g?.marksObtained || 0);
      const maxMarks = Number(assessment.totalMarks || 100);

      totalMarksObtained += marksObtained;
      totalMaxMarks += maxMarks;

      const percentage = maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;
      const letterGrade = isAbsent ? 'AB' : isExempt ? 'EX' : (g?.grade || mapToGrade(percentage, gradingScale));

      return {
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        subjectId: assessment.subject.id,
        subjectName: assessment.subject.name,
        subjectCode: assessment.subject.code || '',
        maxMarks,
        passingMarks: assessment.passingMarks,
        marksObtained,
        isAbsent,
        isExempt,
        letterGrade,
        components: g?.remarks?.components || null,
        notes: g?.remarks?.notes || ''
      };
    });

    const overallPercentage = totalMaxMarks > 0
      ? Number(((totalMarksObtained / totalMaxMarks) * 100).toFixed(2))
      : 0;

    const overallGrade = mapToGrade(overallPercentage, gradingScale);

    return {
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      admissionNo: student.admissionNo,
      rollNo: student.rollNo,
      className: student.class?.name || examination.class?.name || 'Class',
      sectionName: student.section?.name || examination.section?.name || '',
      examinationId: examination.id,
      examName: examination.name,
      academicYear: examination.academicYear,
      term: examination.term,
      marksBreakdown,
      totalMarksObtained: Number(totalMarksObtained.toFixed(2)),
      totalMaxMarks: Number(totalMaxMarks.toFixed(2)),
      percentage: overallPercentage,
      overallGrade,
      attendanceStats: studentAttendanceStats[student.id] || { totalSessions: 0, presentSessions: 0, attendancePercentage: 100 }
    };
  });

  return {
    examination,
    template,
    reports: generatedReports
  };
}

// POST /api/v1/report-cards/preview
// Dynamic in-memory preview calculation with grading scale and attendance
router.post('/preview', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { examinationId, classId, sectionId, studentId } = req.body;

    if (!examinationId) {
      return res.status(400).json({ error: 'examinationId is required' });
    }

    const previewData = await calculateReportCardData(prisma, schoolId, {
      examinationId,
      classId,
      sectionId,
      studentId
    });

    res.json(previewData);
  } catch (error) {
    console.error('Report card preview error:', error);
    res.status(500).json({ error: 'Failed to generate report card preview', details: error.message });
  }
});

// POST /api/v1/report-cards/publish
// Atomic historical snapshot publishing with idempotent upserts
router.post('/publish', requirePermission('exams', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { examinationId, classId, sectionId, studentIds } = req.body;

    if (!examinationId) {
      return res.status(400).json({ error: 'examinationId is required' });
    }

    const { examination, reports } = await calculateReportCardData(prisma, schoolId, {
      examinationId,
      classId,
      sectionId
    });

    const targetReports = Array.isArray(studentIds) && studentIds.length > 0
      ? reports.filter(r => studentIds.includes(r.studentId))
      : reports;

    if (targetReports.length === 0) {
      return res.status(400).json({ error: 'No student records available to publish report cards.' });
    }

    // Execute atomic upsert transaction
    const upsertOperations = targetReports.map(rep => {
      return prisma.reportCard.upsert({
        where: {
          schoolId_studentId_examinationId: {
            schoolId,
            studentId: rep.studentId,
            examinationId
          }
        },
        update: {
          academicYear: rep.academicYear,
          term: rep.term,
          marksBreakdown: rep.marksBreakdown,
          totalMarksObtained: rep.totalMarksObtained,
          totalMaxMarks: rep.totalMaxMarks,
          percentage: rep.percentage,
          overallGrade: rep.overallGrade,
          attendanceStats: rep.attendanceStats,
          status: 'PUBLISHED',
          publishedAt: new Date()
        },
        create: {
          schoolId,
          studentId: rep.studentId,
          examinationId,
          academicYear: rep.academicYear,
          term: rep.term,
          marksBreakdown: rep.marksBreakdown,
          totalMarksObtained: rep.totalMarksObtained,
          totalMaxMarks: rep.totalMaxMarks,
          percentage: rep.percentage,
          overallGrade: rep.overallGrade,
          attendanceStats: rep.attendanceStats,
          status: 'PUBLISHED',
          publishedAt: new Date()
        }
      });
    });

    // Also update examination status to PUBLISHED if it is currently DRAFT
    if (examination.status === 'DRAFT') {
      upsertOperations.push(
        prisma.examination.update({
          where: { id: examinationId },
          data: { status: 'PUBLISHED' }
        })
      );
    }

    await prisma.$transaction(upsertOperations);

    if (req.io) {
      req.io.to(schoolId).emit('report_cards_published', {
        examinationId,
        count: targetReports.length
      });
    }

    res.json({
      message: 'Report cards published successfully',
      publishedCount: targetReports.length,
      examinationId
    });
  } catch (error) {
    console.error('Publish report cards error:', error);
    res.status(500).json({ error: 'Failed to publish report cards', details: error.message });
  }
});

// GET /api/v1/report-cards/student/:studentId
// RBAC-gated fetch for Student / Parent / Teacher / Admin
router.get('/student/:studentId', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { studentId } = req.params;
    const userRole = (req.user.role || '').toUpperCase();
    const userId = req.user.id;

    // RBAC validation
    if (userRole === 'PARENT') {
      const parentRecord = await prisma.parent.findFirst({
        where: { schoolId, userId }
      });
      if (!parentRecord) {
        return res.status(403).json({ error: 'Parent record not found' });
      }

      const link = await prisma.parentStudent.findFirst({
        where: { parentId: parentRecord.id, studentId }
      });
      if (!link) {
        return res.status(403).json({ error: 'Access denied: You are not authorized to view this student\'s reports.' });
      }
    }

    // Strictly filter: only PUBLISHED report cards for PUBLISHED or FINALIZED exams
    const reportCards = await prisma.reportCard.findMany({
      where: {
        schoolId,
        studentId,
        status: 'PUBLISHED',
        examination: {
          status: { in: ['PUBLISHED', 'FINALIZED'] }
        }
      },
      include: {
        examination: {
          select: { id: true, name: true, examType: true, academicYear: true, term: true, status: true }
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNo: true,
            rollNo: true,
            class: { select: { id: true, name: true } },
            section: { select: { id: true, name: true } }
          }
        },
        school: {
          select: { id: true, name: true, logoUrl: true, address: true, phone: true }
        }
      },
      orderBy: { publishedAt: 'desc' }
    });

    // Attach active template branding
    const template = await prisma.reportCardTemplate.findFirst({
      where: { schoolId, type: 'CBSE' }
    });

    const enriched = reportCards.map(rc => ({
      ...rc,
      template: template || null
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Fetch student report cards error:', error);
    res.status(500).json({ error: 'Failed to fetch student report cards' });
  }
});

// GET /api/v1/report-cards/:id
// Get single report card
router.get('/:id', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const reportCard = await prisma.reportCard.findFirst({
      where: { id, schoolId },
      include: {
        examination: true,
        student: {
          include: { class: true, section: true }
        },
        school: true
      }
    });

    if (!reportCard) {
      return res.status(404).json({ error: 'Report card not found' });
    }

    // Role check if parent
    if (req.user.role === 'PARENT') {
      const parentRecord = await prisma.parent.findFirst({
        where: { schoolId, userId: req.user.id }
      });
      const link = await prisma.parentStudent.findFirst({
        where: { parentId: parentRecord?.id, studentId: reportCard.studentId }
      });
      if (!link) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const template = await prisma.reportCardTemplate.findFirst({
      where: { schoolId }
    });

    res.json({ ...reportCard, template: template || null });
  } catch (error) {
    console.error('Get report card error:', error);
    res.status(500).json({ error: 'Failed to retrieve report card' });
  }
});

// DELETE /api/v1/report-cards/:id
// Unpublish / delete report card (Admin only)
router.delete('/:id', requirePermission('exams', 'DELETE'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const report = await prisma.reportCard.findFirst({
      where: { id, schoolId }
    });

    if (!report) {
      return res.status(404).json({ error: 'Report card not found' });
    }

    await prisma.reportCard.delete({ where: { id } });

    res.json({ message: 'Report card deleted successfully' });
  } catch (error) {
    console.error('Delete report card error:', error);
    res.status(500).json({ error: 'Failed to delete report card' });
  }
});

module.exports = router;
