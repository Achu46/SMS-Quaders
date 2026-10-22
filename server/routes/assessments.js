const express = require('express');
const router = express.Router();
const { authenticateToken, requireActiveSchool, requirePermission } = require('../middleware');

router.use(authenticateToken, requireActiveSchool);

// Standard CBSE letter grade evaluation fallback
const calculateGrade = (percentage) => {
  if (percentage >= 91) return 'A1';
  if (percentage >= 81) return 'A2';
  if (percentage >= 71) return 'B1';
  if (percentage >= 61) return 'B2';
  if (percentage >= 51) return 'C1';
  if (percentage >= 41) return 'C2';
  if (percentage >= 33) return 'D';
  return 'E';
};

// GET /api/v1/assessments
// List assessments with filters
router.get('/', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const {
      examinationId,
      classId,
      sectionId,
      subjectId,
      teacherId,
      status
    } = req.query;

    const where = {
      schoolId,
      ...(examinationId ? { examinationId } : {}),
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(status ? { status } : {})
    };

    const assessments = await prisma.assessment.findMany({
      where,
      include: {
        examination: {
          select: { id: true, name: true, examType: true, academicYear: true, status: true }
        },
        class: {
          select: { id: true, name: true }
        },
        section: {
          select: { id: true, name: true }
        },
        subject: {
          select: { id: true, name: true, code: true }
        },
        teacher: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { grades: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(assessments);
  } catch (error) {
    console.error('Fetch assessments error:', error);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

// POST /api/v1/assessments
// Create an assessment
router.post('/', requirePermission('exams', 'CREATE'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const {
      examinationId,
      classId,
      sectionId,
      subjectId,
      teacherId,
      title,
      totalMarks = 100,
      passingMarks = 40,
      weightage = 100,
      examDate,
      components
    } = req.body;

    if (!classId || !subjectId || !title) {
      return res.status(400).json({ error: 'Class, Subject, and Title are required.' });
    }

    // Default component if not provided
    const parsedComponents = components && Array.isArray(components) && components.length > 0
      ? components
      : [{ name: 'Theory', maxMarks: Number(totalMarks) || 100 }];

    const assessment = await prisma.assessment.create({
      data: {
        schoolId,
        examinationId: examinationId || null,
        classId,
        sectionId: sectionId || null,
        subjectId,
        teacherId: teacherId || req.user.id,
        title,
        totalMarks: Number(totalMarks) || 100,
        passingMarks: Number(passingMarks) || 40,
        weightage: Number(weightage) || 100,
        examDate: examDate ? new Date(examDate) : null,
        status: 'PENDING',
        components: parsedComponents
      },
      include: {
        examination: true,
        class: true,
        section: true,
        subject: true,
        teacher: { select: { id: true, name: true, email: true } }
      }
    });

    if (req.io) {
      req.io.to(schoolId).emit('assessment_created', { assessmentId: assessment.id, title: assessment.title });
    }

    res.status(201).json({ message: 'Assessment created successfully', assessment });
  } catch (error) {
    console.error('Create assessment error:', error);
    res.status(500).json({ error: 'Failed to create assessment', details: error.message });
  }
});

// GET /api/v1/assessments/:id
// Get single assessment
router.get('/:id', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const assessment = await prisma.assessment.findFirst({
      where: { id, schoolId },
      include: {
        examination: true,
        class: true,
        section: true,
        subject: true,
        teacher: { select: { id: true, name: true, email: true } },
        _count: { select: { grades: true } }
      }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json(assessment);
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ error: 'Failed to retrieve assessment' });
  }
});

// PATCH /api/v1/assessments/:id
// Update assessment metadata or status (PENDING, IN_PROGRESS, SUBMITTED, LOCKED)
router.patch('/:id', requirePermission('exams', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const {
      title,
      totalMarks,
      passingMarks,
      weightage,
      examDate,
      status,
      teacherId,
      components
    } = req.body;

    const assessment = await prisma.assessment.findFirst({
      where: { id, schoolId }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Role guard: Only Admin/SuperAdmin can lock an assessment
    if (status === 'LOCKED' && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only administrators can lock an assessment.' });
    }

    // If already locked, only Admin/SuperAdmin can modify
    if (assessment.status === 'LOCKED' && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Assessment is locked and cannot be edited without administrator privilege.' });
    }

    const updated = await prisma.assessment.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(totalMarks !== undefined ? { totalMarks: Number(totalMarks) } : {}),
        ...(passingMarks !== undefined ? { passingMarks: Number(passingMarks) } : {}),
        ...(weightage !== undefined ? { weightage: Number(weightage) } : {}),
        ...(examDate !== undefined ? { examDate: examDate ? new Date(examDate) : null } : {}),
        ...(status ? { status } : {}),
        ...(teacherId !== undefined ? { teacherId: teacherId || null } : {}),
        ...(components !== undefined ? { components } : {})
      },
      include: {
        class: true,
        subject: true,
        teacher: { select: { id: true, name: true, email: true } }
      }
    });

    if (req.io) {
      req.io.to(schoolId).emit('assessment_updated', { assessmentId: id, status: updated.status });
    }

    res.json({ message: 'Assessment updated successfully', assessment: updated });
  } catch (error) {
    console.error('Update assessment error:', error);
    res.status(500).json({ error: 'Failed to update assessment' });
  }
});

// GET /api/v1/assessments/:id/grades
// Fetch full student roster with entered marks for this assessment
router.get('/:id/grades', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const assessment = await prisma.assessment.findFirst({
      where: { id, schoolId },
      include: {
        class: true,
        section: true,
        subject: true,
        examination: true
      }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Fetch enrolled students
    const students = await prisma.student.findMany({
      where: {
        schoolId,
        classId: assessment.classId,
        ...(assessment.sectionId ? { sectionId: assessment.sectionId } : {}),
        status: 'ACTIVE'
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        rollNo: true,
        gender: true
      },
      orderBy: [
        { rollNo: 'asc' },
        { firstName: 'asc' }
      ]
    });

    // Fetch existing grades
    const existingGrades = await prisma.assessmentGrade.findMany({
      where: {
        schoolId,
        assessmentId: id
      },
      include: {
        overriddenBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const gradeMap = {};
    existingGrades.forEach(g => {
      gradeMap[g.studentId] = g;
    });

    // Merge students with their grade record
    const roster = students.map(student => {
      const gradeRecord = gradeMap[student.id];
      return {
        student,
        grade: gradeRecord ? {
          id: gradeRecord.id,
          marksObtained: gradeRecord.marksObtained,
          isAbsent: gradeRecord.isAbsent,
          isExempt: gradeRecord.isExempt,
          grade: gradeRecord.grade,
          remarks: gradeRecord.remarks,
          overrideReason: gradeRecord.overrideReason,
          overriddenBy: gradeRecord.overriddenBy,
          updatedAt: gradeRecord.updatedAt
        } : null
      };
    });

    res.json({
      assessment,
      roster,
      totalStudents: students.length,
      gradedStudents: existingGrades.length
    });
  } catch (error) {
    console.error('Fetch assessment grades error:', error);
    res.status(500).json({ error: 'Failed to fetch assessment grades' });
  }
});

// POST /api/v1/assessments/:id/grades/bulk
// Bulk mark entry with component breakdown, validation, and lock enforcement
router.post('/:id/grades/bulk', requirePermission('exams', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const { grades, submitForReview = false } = req.body;

    if (!Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ error: 'A non-empty grades array is required.' });
    }

    const assessment = await prisma.assessment.findFirst({
      where: { id, schoolId }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Lock guard: if assessment is locked, only Admin/SuperAdmin can overwrite
    if (assessment.status === 'LOCKED' && req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({
        error: 'This assessment has been LOCKED by administration. Marks cannot be modified without administrative unlock.',
        code: 'ASSESSMENT_LOCKED'
      });
    }

    const totalMax = assessment.totalMarks;

    // Validate entries
    for (const item of grades) {
      if (!item.studentId) {
        return res.status(400).json({ error: 'Each entry must contain a valid studentId' });
      }

      const isAbsent = Boolean(item.isAbsent);
      const isExempt = Boolean(item.isExempt);
      let marks = Number(item.marksObtained);

      if (!isAbsent && !isExempt) {
        if (isNaN(marks) || marks < 0) {
          return res.status(400).json({ error: `Invalid marks value: ${item.marksObtained}` });
        }
        if (marks > totalMax) {
          return res.status(400).json({
            error: `Marks obtained (${marks}) cannot exceed total marks (${totalMax}) for student ${item.studentId}`
          });
        }
      }
    }

    // Execute bulk upserts inside transaction
    const operations = grades.map(item => {
      const isAbsent = Boolean(item.isAbsent);
      const isExempt = Boolean(item.isExempt);
      let marks = isAbsent || isExempt ? 0 : Number(Number(item.marksObtained).toFixed(2));
      const percentage = totalMax > 0 ? (marks / totalMax) * 100 : 0;
      const letterGrade = isAbsent ? 'AB' : isExempt ? 'EX' : calculateGrade(percentage);

      const remarksData = item.remarks && typeof item.remarks === 'object'
        ? item.remarks
        : { components: item.components || {}, notes: item.notes || '' };

      return prisma.assessmentGrade.upsert({
        where: {
          assessmentId_studentId: {
            assessmentId: id,
            studentId: item.studentId
          }
        },
        update: {
          marksObtained: marks,
          isAbsent,
          isExempt,
          grade: letterGrade,
          remarks: remarksData,
          ...(item.overrideReason ? {
            overrideReason: item.overrideReason,
            overriddenById: req.user.id
          } : {})
        },
        create: {
          schoolId,
          assessmentId: id,
          studentId: item.studentId,
          marksObtained: marks,
          isAbsent,
          isExempt,
          grade: letterGrade,
          remarks: remarksData,
          ...(item.overrideReason ? {
            overrideReason: item.overrideReason,
            overriddenById: req.user.id
          } : {})
        }
      });
    });

    await prisma.$transaction(operations);

    // Update assessment status
    let nextStatus = assessment.status;
    if (submitForReview) {
      nextStatus = 'SUBMITTED';
    } else if (assessment.status === 'PENDING') {
      nextStatus = 'IN_PROGRESS';
    }

    if (nextStatus !== assessment.status) {
      await prisma.assessment.update({
        where: { id },
        data: { status: nextStatus }
      });
    }

    if (req.io) {
      req.io.to(schoolId).emit('grades_updated', { assessmentId: id, count: grades.length });
    }

    res.json({
      message: 'Grades saved successfully',
      updatedCount: grades.length,
      assessmentStatus: nextStatus
    });
  } catch (error) {
    console.error('Bulk save grades error:', error);
    res.status(500).json({ error: 'Failed to save student marks', details: error.message });
  }
});

// PUT /api/v1/assessments/:id/grades/:studentId
// Administrative mark override with audit logging
router.put('/:id/grades/:studentId', requirePermission('exams', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id, studentId } = req.params;
    const {
      marksObtained,
      isAbsent,
      isExempt,
      remarks,
      overrideReason
    } = req.body;

    const assessment = await prisma.assessment.findFirst({
      where: { id, schoolId }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Require reason if modifying locked or submitted assessment
    if (assessment.status === 'LOCKED' && !overrideReason) {
      return res.status(400).json({ error: 'Administrative override reason is required for locked assessments.' });
    }

    const marks = isAbsent || isExempt ? 0 : Number(Number(marksObtained).toFixed(2));
    const percentage = assessment.totalMarks > 0 ? (marks / assessment.totalMarks) * 100 : 0;
    const letterGrade = isAbsent ? 'AB' : isExempt ? 'EX' : calculateGrade(percentage);

    const grade = await prisma.assessmentGrade.upsert({
      where: {
        assessmentId_studentId: {
          assessmentId: id,
          studentId
        }
      },
      update: {
        marksObtained: marks,
        isAbsent: Boolean(isAbsent),
        isExempt: Boolean(isExempt),
        grade: letterGrade,
        remarks: remarks || undefined,
        overrideReason: overrideReason || 'Manual adjustment',
        overriddenById: req.user.id
      },
      create: {
        schoolId,
        assessmentId: id,
        studentId,
        marksObtained: marks,
        isAbsent: Boolean(isAbsent),
        isExempt: Boolean(isExempt),
        grade: letterGrade,
        remarks: remarks || undefined,
        overrideReason: overrideReason || 'Initial entry',
        overriddenById: req.user.id
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        overriddenBy: { select: { id: true, name: true, email: true } }
      }
    });

    if (req.io) {
      req.io.to(schoolId).emit('grade_overridden', { assessmentId: id, studentId });
    }

    res.json({ message: 'Grade updated successfully with audit trail', grade });
  } catch (error) {
    console.error('Override grade error:', error);
    res.status(500).json({ error: 'Failed to update student grade' });
  }
});

// DELETE /api/v1/assessments/:id
// Delete assessment
router.delete('/:id', requirePermission('exams', 'DELETE'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { id } = req.params;

    const assessment = await prisma.assessment.findFirst({
      where: { id, schoolId },
      include: { _count: { select: { grades: true } } }
    });

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    if (assessment._count.grades > 0) {
      return res.status(409).json({
        error: `Cannot delete assessment: ${assessment._count.grades} student marks already entered.`,
        code: 'GRADES_EXIST'
      });
    }

    await prisma.assessment.delete({ where: { id } });

    res.json({ message: 'Assessment deleted successfully' });
  } catch (error) {
    console.error('Delete assessment error:', error);
    res.status(500).json({ error: 'Failed to delete assessment' });
  }
});

module.exports = router;
