const express = require('express');
const router = express.Router();
const { authenticateToken, requireActiveSchool, requirePermission } = require('../middleware');

// All exam routes require authentication and active school status
router.use(authenticateToken, requireActiveSchool);

// GET /api/v1/exams
// List all examinations with optional filters: academicYear, status, classId
router.get('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { academicYear, status, classId } = req.query;

    const where = {
      schoolId,
      ...(academicYear ? { academicYear } : {}),
      ...(status ? { status } : {}),
      ...(classId ? { classId } : {})
    };

    const examinations = await prisma.examination.findMany({
      where,
      include: {
        class: {
          select: { id: true, name: true }
        },
        section: {
          select: { id: true, name: true }
        },
        assessments: {
          select: {
            id: true,
            title: true,
            status: true,
            totalMarks: true,
            passingMarks: true,
            subject: { select: { id: true, name: true, code: true } },
            teacher: { select: { id: true, name: true, email: true } },
            _count: { select: { grades: true } }
          }
        },
        _count: {
          select: {
            assessments: true,
            reportCards: true
          }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    res.json(examinations);
  } catch (error) {
    console.error('Fetch examinations error:', error);
    res.status(500).json({ error: 'Failed to fetch examinations', details: error.message });
  }
});

// POST /api/v1/exams
// Create an examination, with option to auto-provision subject assessments for class
router.post('/', requirePermission('exams', 'CREATE'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const {
      name,
      examType = 'Term',
      academicYear,
      term,
      startDate,
      endDate,
      classId,
      sectionId,
      customData,
      autoCreateAssessments = false,
      defaultTotalMarks = 100,
      defaultPassingMarks = 40
    } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Exam name, start date, and end date are required.' });
    }

    // Default academicYear from active year or current date if not provided
    let year = academicYear;
    if (!year) {
      const activeYear = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true }
      });
      year = activeYear ? activeYear.name : `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    }

    // Create the exam record
    const exam = await prisma.examination.create({
      data: {
        schoolId,
        name,
        examType,
        academicYear: year,
        term: term || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        classId: classId || null,
        sectionId: sectionId || null,
        status: 'DRAFT',
        customData: customData || null
      },
      include: {
        class: true,
        section: true
      }
    });

    // Auto-create assessments for subjects if requested and classId provided
    let createdAssessmentsCount = 0;
    if (autoCreateAssessments && classId) {
      const subjects = await prisma.subject.findMany({
        where: {
          schoolId,
          OR: [
            { classId },
            { classId: null }
          ]
        }
      });

      if (subjects.length > 0) {
        // Find teacher assignments if available
        const assignments = await prisma.classAssignment.findMany({
          where: { schoolId, classId }
        });
        const subjectTeacherMap = {};
        assignments.forEach(a => {
          if (a.subjectId && a.staffId) {
            subjectTeacherMap[a.subjectId] = a.staffId;
          }
        });

        for (const subj of subjects) {
          await prisma.assessment.create({
            data: {
              schoolId,
              examinationId: exam.id,
              classId,
              sectionId: sectionId || null,
              subjectId: subj.id,
              teacherId: subjectTeacherMap[subj.id] || null,
              title: `${subj.name} - ${exam.name}`,
              totalMarks: Number(defaultTotalMarks) || 100,
              passingMarks: Number(defaultPassingMarks) || 40,
              weightage: 100,
              status: 'PENDING',
              components: [
                { name: 'Theory', maxMarks: Number(defaultTotalMarks) || 100 }
              ]
            }
          });
          createdAssessmentsCount++;
        }
      }
    }

    // Emit real-time notification
    if (req.io) {
      req.io.to(schoolId).emit('exam_created', { examId: exam.id, name: exam.name });
    }

    const fullExam = await prisma.examination.findUnique({
      where: { id: exam.id },
      include: {
        class: true,
        section: true,
        assessments: {
          include: { subject: true, teacher: true }
        },
        _count: { select: { assessments: true, reportCards: true } }
      }
    });

    res.status(201).json({
      message: 'Examination created successfully',
      exam: fullExam,
      autoCreatedAssessments: createdAssessmentsCount
    });
  } catch (error) {
    console.error('Create examination error:', error);
    res.status(500).json({ error: 'Failed to create examination', details: error.message });
  }
});

// GET /api/v1/exams/:id
// Get single exam details
router.get('/:id', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const exam = await prisma.examination.findFirst({
      where: { id, schoolId },
      include: {
        class: true,
        section: true,
        assessments: {
          include: {
            subject: true,
            teacher: { select: { id: true, name: true, email: true } },
            _count: { select: { grades: true } }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: {
            assessments: true,
            reportCards: true
          }
        }
      }
    });

    if (!exam) {
      return res.status(404).json({ error: 'Examination not found' });
    }

    res.json(exam);
  } catch (error) {
    console.error('Get exam details error:', error);
    res.status(500).json({ error: 'Failed to retrieve examination details' });
  }
});

// PATCH /api/v1/exams/:id
// Update exam metadata
router.patch('/:id', requirePermission('exams', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const {
      name,
      examType,
      academicYear,
      term,
      startDate,
      endDate,
      classId,
      sectionId,
      customData
    } = req.body;

    const existing = await prisma.examination.findFirst({
      where: { id, schoolId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Examination not found' });
    }

    if (existing.status === 'FINALIZED' && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Cannot modify a finalized examination.' });
    }

    const updated = await prisma.examination.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(examType ? { examType } : {}),
        ...(academicYear ? { academicYear } : {}),
        ...(term !== undefined ? { term } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        ...(classId !== undefined ? { classId: classId || null } : {}),
        ...(sectionId !== undefined ? { sectionId: sectionId || null } : {}),
        ...(customData !== undefined ? { customData } : {})
      },
      include: {
        class: true,
        section: true
      }
    });

    if (req.io) {
      req.io.to(schoolId).emit('exam_updated', { examId: id });
    }

    res.json({ message: 'Examination updated successfully', exam: updated });
  } catch (error) {
    console.error('Update examination error:', error);
    res.status(500).json({ error: 'Failed to update examination' });
  }
});

// POST /api/v1/exams/:id/status
// Lifecycle state transitions: DRAFT -> PUBLISHED -> FINALIZED
router.post('/:id/status', requirePermission('exams', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['DRAFT', 'PUBLISHED', 'FINALIZED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const exam = await prisma.examination.findFirst({
      where: { id, schoolId },
      include: {
        assessments: true
      }
    });

    if (!exam) {
      return res.status(404).json({ error: 'Examination not found' });
    }

    // Transition guards
    if (status === 'PUBLISHED') {
      if (exam.assessments.length === 0) {
        return res.status(400).json({
          error: 'Cannot publish examination without any scheduled assessments. Please add assessments first.'
        });
      }
    }

    if (status === 'FINALIZED') {
      // Check if all assessments are submitted or locked
      const pendingCount = exam.assessments.filter(a => a.status === 'PENDING' || a.status === 'IN_PROGRESS').length;
      if (pendingCount > 0) {
        return res.status(400).json({
          error: `Cannot finalize examination. ${pendingCount} assessment(s) are still pending or in progress.`
        });
      }
    }

    const updated = await prisma.examination.update({
      where: { id },
      data: { status }
    });

    if (req.io) {
      req.io.to(schoolId).emit('exam_status_updated', { examId: id, status });
    }

    res.json({ message: `Examination status updated to ${status}`, exam: updated });
  } catch (error) {
    console.error('Update exam status error:', error);
    res.status(500).json({ error: 'Failed to update examination status' });
  }
});

// GET /api/v1/exams/:id/progress
// Completion & evaluation metrics
router.get('/:id/progress', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const exam = await prisma.examination.findFirst({
      where: { id, schoolId },
      include: {
        class: true,
        assessments: {
          include: {
            subject: true,
            teacher: { select: { id: true, name: true, email: true } },
            _count: { select: { grades: true } }
          }
        }
      }
    });

    if (!exam) {
      return res.status(404).json({ error: 'Examination not found' });
    }

    // Total enrolled students in target class
    let enrolledStudents = 0;
    if (exam.classId) {
      enrolledStudents = await prisma.student.count({
        where: {
          schoolId,
          classId: exam.classId,
          status: 'ACTIVE'
        }
      });
    }

    const totalAssessments = exam.assessments.length;
    const statusCounts = {
      PENDING: 0,
      IN_PROGRESS: 0,
      SUBMITTED: 0,
      LOCKED: 0
    };

    let totalGradesRecorded = 0;
    const teacherProgress = [];

    exam.assessments.forEach(a => {
      statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
      const gradesCount = a._count.grades || 0;
      totalGradesRecorded += gradesCount;

      teacherProgress.push({
        assessmentId: a.id,
        assessmentTitle: a.title,
        subject: a.subject.name,
        teacher: a.teacher ? a.teacher.name : 'Unassigned',
        status: a.status,
        gradesCount,
        enrolledStudents,
        completionPercent: enrolledStudents > 0 ? Math.min(100, Math.round((gradesCount / enrolledStudents) * 100)) : 0
      });
    });

    const completedAssessments = statusCounts.SUBMITTED + statusCounts.LOCKED;
    const overallProgressPercent = totalAssessments > 0
      ? Math.round((completedAssessments / totalAssessments) * 100)
      : 0;

    res.json({
      examId: exam.id,
      name: exam.name,
      status: exam.status,
      enrolledStudents,
      totalAssessments,
      statusCounts,
      overallProgressPercent,
      totalGradesRecorded,
      teacherProgress
    });
  } catch (error) {
    console.error('Get exam progress error:', error);
    res.status(500).json({ error: 'Failed to calculate examination progress' });
  }
});

// DELETE /api/v1/exams/:id
// Delete examination with 409 guard against existing grades
router.delete('/:id', requirePermission('exams', 'DELETE'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const exam = await prisma.examination.findFirst({
      where: { id, schoolId },
      include: {
        assessments: {
          select: { id: true }
        }
      }
    });

    if (!exam) {
      return res.status(404).json({ error: 'Examination not found' });
    }

    const assessmentIds = exam.assessments.map(a => a.id);
    if (assessmentIds.length > 0) {
      const gradesCount = await prisma.assessmentGrade.count({
        where: {
          assessmentId: { in: assessmentIds }
        }
      });

      if (gradesCount > 0) {
        return res.status(409).json({
          error: `Cannot delete examination: ${gradesCount} student mark entries exist. Remove or archive student marks first.`,
          code: 'GRADES_EXIST'
        });
      }
    }

    // Safe to delete
    await prisma.examination.delete({
      where: { id }
    });

    if (req.io) {
      req.io.to(schoolId).emit('exam_deleted', { examId: id });
    }

    res.json({ message: 'Examination deleted successfully' });
  } catch (error) {
    console.error('Delete examination error:', error);
    res.status(500).json({ error: 'Failed to delete examination' });
  }
});

module.exports = router;
