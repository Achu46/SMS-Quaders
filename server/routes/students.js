const express = require('express');
const router = express.Router();
const { authenticateToken, requireActiveSchool, requireAcademicSetup, requirePermission } = require('../middleware');

// All student routes require active school + completed academic setup
router.use(authenticateToken, requireActiveSchool, requireAcademicSetup);

// GET /api/students/my-children
// Scoped strictly for Parents: returns only the parent's linked children with common modules
router.get('/my-children', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const userId = req.user.id;

    // Find parent record linked to this user
    const parent = await prisma.parent.findFirst({
      where: { schoolId, userId },
      include: {
        students: {
          include: {
            student: {
              include: {
                class: true,
                section: true
              }
            }
          }
        }
      }
    });

    if (!parent) {
      return res.json([]);
    }

    const commonModules = [
      'Dashboard',
      'Attendance',
      'Homework',
      'Assignments',
      'Calendar',
      'Exams',
      'Noticeboard',
      'Leaves',
      'Canteen',
      'Fees'
    ];

    const children = parent.students.map(ps => ({
      ...ps.student,
      relation: parent.relation,
      commonModules
    }));

    res.json(children);
  } catch (error) {
    console.error('Fetch my-children error:', error);
    res.status(500).json({ error: 'Failed to fetch linked children' });
  }
});

// GET /api/students
// List students with optional class / section filter
router.get('/', requirePermission('students', 'VIEW'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { classId, sectionId, search } = req.query;

    const students = await prisma.student.findMany({
      where: {
        schoolId,
        ...(classId ? { classId } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(search ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { admissionNo: { contains: search, mode: 'insensitive' } }
          ]
        } : {})
      },
      include: {
        class: true,
        section: true,
        parents: {
          include: {
            parent: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(students);
  } catch (error) {
    console.error('Fetch students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// POST /api/students/admit
// Single student admission + parent linkage
router.post('/admit', requirePermission('students', 'CREATE'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const {
      firstName,
      lastName,
      admissionNo,
      rollNo,
      dob,
      gender,
      classId,
      sectionId,
      parentName,
      parentEmail,
      parentPhone,
      relation
    } = req.body;

    if (!firstName || !admissionNo || !classId) {
      return res.status(400).json({ error: 'First name, admission number, and classId are required' });
    }

    // Check duplicate admissionNo
    const existing = await prisma.student.findFirst({
      where: { schoolId, admissionNo: admissionNo.trim() }
    });
    if (existing) {
      return res.status(400).json({ error: 'A student with this admission number already exists' });
    }

    // Execute in transaction: create Student + link/create Parent
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          schoolId,
          firstName: firstName.trim(),
          lastName: lastName ? lastName.trim() : '',
          admissionNo: admissionNo.trim(),
          rollNo: rollNo ? rollNo.trim() : null,
          dob: dob ? new Date(dob) : null,
          gender: gender || 'Male',
          classId,
          sectionId: sectionId || null,
          status: 'ACTIVE'
        }
      });

      // If parent details provided, create or link parent
      if (parentName) {
        let parent = null;
        if (parentEmail) {
          parent = await tx.parent.findFirst({
            where: { schoolId, email: parentEmail.toLowerCase().trim() }
          });
        }

        if (!parent) {
          parent = await tx.parent.create({
            data: {
              schoolId,
              name: parentName.trim(),
              email: parentEmail ? parentEmail.toLowerCase().trim() : null,
              phone: parentPhone ? parentPhone.trim() : null,
              relation: relation || 'Guardian'
            }
          });
        }

        await tx.parentStudent.create({
          data: {
            parentId: parent.id,
            studentId: student.id
          }
        });
      }

      return student;
    });

    res.status(201).json({ message: 'Student admitted successfully', student: result });
  } catch (error) {
    console.error('Admit student error:', error);
    res.status(500).json({ error: 'Failed to admit student' });
  }
});

// POST /api/students/bulk-import
// Bulk student admission
router.post('/bulk-import', requirePermission('students', 'CREATE'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'An array of students is required' });
    }

    let createdCount = 0;
    const errors = [];

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      try {
        if (!row.firstName || !row.admissionNo || !row.classId) {
          errors.push({ row: i + 1, error: 'Missing required fields (firstName, admissionNo, classId)' });
          continue;
        }

        const existing = await prisma.student.findFirst({
          where: { schoolId, admissionNo: String(row.admissionNo).trim() }
        });
        if (existing) {
          errors.push({ row: i + 1, error: `Duplicate admission number: ${row.admissionNo}` });
          continue;
        }

        await prisma.student.create({
          data: {
            schoolId,
            firstName: String(row.firstName).trim(),
            lastName: row.lastName ? String(row.lastName).trim() : '',
            admissionNo: String(row.admissionNo).trim(),
            rollNo: row.rollNo ? String(row.rollNo).trim() : null,
            gender: row.gender || 'Male',
            classId: row.classId,
            sectionId: row.sectionId || null,
            status: 'ACTIVE'
          }
        });

        createdCount++;
      } catch (err) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    res.json({
      message: `Bulk import completed: ${createdCount} students admitted.`,
      createdCount,
      errors
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Failed to process bulk import' });
  }
});

// PUT /api/students/:id
// Update student profile
router.put('/:id', requirePermission('students', 'EDIT'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const studentId = req.params.id;

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const { firstName, lastName, rollNo, dob, gender, classId, sectionId, status } = req.body;

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: {
        ...(firstName ? { firstName: firstName.trim() } : {}),
        ...(lastName !== undefined ? { lastName: lastName.trim() } : {}),
        ...(rollNo !== undefined ? { rollNo: rollNo ? rollNo.trim() : null } : {}),
        ...(dob !== undefined ? { dob: dob ? new Date(dob) : null } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(classId ? { classId } : {}),
        ...(sectionId !== undefined ? { sectionId } : {}),
        ...(status ? { status } : {})
      }
    });

    res.json({ message: 'Student updated successfully', student: updated });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// DELETE /api/students/:id
// Delete a student
router.delete('/:id', requirePermission('students', 'DELETE'), async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const studentId = req.params.id;

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId }
    });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await prisma.student.delete({
      where: { id: studentId }
    });

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

module.exports = router;
