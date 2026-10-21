const express = require('express');
const router = express.Router();
const { authenticateToken, requireActiveSchool, requireRole } = require('../middleware');

// All academic setup routes are protected by authentication, active school check, and Admin role
router.use(authenticateToken, requireActiveSchool, requireRole(['ADMIN', 'SUPER_ADMIN']));

// GET /api/academic/setup-status
// Checks if the school has satisfied academic preconditions
router.get('/setup-status', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        _count: {
          select: {
            academicYears: true,
            classes: true,
            sections: true,
            subjects: true
          }
        }
      }
    });

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const counts = school._count;
    const isMinimallyComplete = counts.academicYears > 0 && counts.classes > 0;

    res.json({
      setupCompleted: school.setupCompleted,
      isMinimallyComplete,
      counts,
      school: {
        name: school.name,
        board: school.board,
        address: school.address,
        phone: school.phone,
        logoUrl: school.logoUrl
      }
    });
  } catch (error) {
    console.error('Fetch setup status error:', error);
    res.status(500).json({ error: 'Failed to fetch setup status' });
  }
});

// POST /api/academic/profile
// Updates School basic information & board
router.post('/profile', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;
    const { name, board, address, phone, logoUrl } = req.body;

    const updated = await prisma.school.update({
      where: { id: schoolId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(board !== undefined ? { board: board?.trim() } : {}),
        ...(address !== undefined ? { address: address?.trim() } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() } : {}),
        ...(logoUrl !== undefined ? { logoUrl: logoUrl?.trim() } : {})
      }
    });

    res.json({ message: 'School profile updated successfully', school: updated });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update school profile' });
  }
});

// --- ACADEMIC YEARS ---

// GET /api/academic/years
router.get('/years', async (req, res) => {
  try {
    const prisma = req.prisma;
    const years = await prisma.academicYear.findMany({
      where: { schoolId: req.user.schoolId },
      orderBy: { startDate: 'desc' }
    });
    res.json(years);
  } catch (error) {
    console.error('Fetch academic years error:', error);
    res.status(500).json({ error: 'Failed to fetch academic years' });
  }
});

// POST /api/academic/years
router.post('/years', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { name, startDate, endDate, isCurrent } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'Name, start date, and end date are required' });
    }

    // If marked as current, unset any other current year
    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { schoolId: req.user.schoolId, isCurrent: true },
        data: { isCurrent: false }
      });
    }

    const year = await prisma.academicYear.create({
      data: {
        schoolId: req.user.schoolId,
        name: name.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isCurrent: Boolean(isCurrent)
      }
    });

    res.status(201).json(year);
  } catch (error) {
    console.error('Create academic year error:', error);
    res.status(500).json({ error: 'Failed to create academic year' });
  }
});

// PUT /api/academic/years/:id
router.put('/years/:id', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { name, startDate, endDate, isCurrent } = req.body;
    const schoolId = req.user.schoolId;

    const existing = await prisma.academicYear.findFirst({
      where: { id: req.params.id, schoolId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Academic year not found' });
    }

    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { schoolId, isCurrent: true, id: { not: req.params.id } },
        data: { isCurrent: false }
      });
    }

    const updated = await prisma.academicYear.update({
      where: { id: req.params.id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        ...(isCurrent !== undefined ? { isCurrent: Boolean(isCurrent) } : {})
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update academic year error:', error);
    res.status(500).json({ error: 'Failed to update academic year' });
  }
});

// DELETE /api/academic/years/:id
router.delete('/years/:id', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    const existing = await prisma.academicYear.findFirst({
      where: { id: req.params.id, schoolId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Academic year not found' });
    }

    await prisma.academicYear.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Academic year deleted successfully' });
  } catch (error) {
    console.error('Delete academic year error:', error);
    res.status(500).json({ error: 'Failed to delete academic year' });
  }
});

// --- CLASSES & SECTIONS ---

// GET /api/academic/classes
router.get('/classes', async (req, res) => {
  try {
    const prisma = req.prisma;
    const classes = await prisma.class.findMany({
      where: { schoolId: req.user.schoolId },
      include: {
        sections: true,
        subjects: true,
        academicYear: true,
        _count: {
          select: { students: true, assignments: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(classes);
  } catch (error) {
    console.error('Fetch classes error:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

// POST /api/academic/classes
router.post('/classes', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { name, academicYearId, sections } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Class name is required' });
    }

    const newClass = await prisma.class.create({
      data: {
        schoolId: req.user.schoolId,
        name: name.trim(),
        academicYearId: academicYearId || null,
        sections: {
          create: (Array.isArray(sections) && sections.length > 0 ? sections : ['A']).map(sec => ({
            name: typeof sec === 'string' ? sec.trim() : sec.name.trim(),
            schoolId: req.user.schoolId
          }))
        }
      },
      include: {
        sections: true
      }
    });

    res.status(201).json(newClass);
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Failed to create class' });
  }
});

// PUT /api/academic/classes/:id
router.put('/classes/:id', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { name, academicYearId } = req.body;
    const schoolId = req.user.schoolId;

    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, schoolId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (academicYearId) {
      const year = await prisma.academicYear.findFirst({
        where: { id: academicYearId, schoolId }
      });
      if (!year) {
        return res.status(400).json({ error: 'Academic year not found in this school' });
      }
    }

    const updated = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(academicYearId !== undefined ? { academicYearId } : {})
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: 'Failed to update class' });
  }
});

// DELETE /api/academic/classes/:id
router.delete('/classes/:id', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, schoolId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Class not found' });
    }

    await prisma.class.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ error: 'Failed to delete class' });
  }
});

// POST /api/academic/classes/:classId/sections
router.post('/classes/:classId/sections', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { name } = req.body;
    const schoolId = req.user.schoolId;

    if (!name) {
      return res.status(400).json({ error: 'Section name is required' });
    }

    const cls = await prisma.class.findFirst({
      where: { id: req.params.classId, schoolId }
    });
    if (!cls) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const section = await prisma.section.create({
      data: {
        schoolId,
        classId: req.params.classId,
        name: name.trim()
      }
    });

    res.status(201).json(section);
  } catch (error) {
    console.error('Create section error:', error);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// DELETE /api/academic/sections/:id
router.delete('/sections/:id', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    const existing = await prisma.section.findFirst({
      where: { id: req.params.id, schoolId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Section not found' });
    }

    await prisma.section.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Section deleted successfully' });
  } catch (error) {
    console.error('Delete section error:', error);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

// --- SUBJECTS ---

// GET /api/academic/subjects
router.get('/subjects', async (req, res) => {
  try {
    const prisma = req.prisma;
    const subjects = await prisma.subject.findMany({
      where: { schoolId: req.user.schoolId },
      include: {
        class: true
      },
      orderBy: { name: 'asc' }
    });
    res.json(subjects);
  } catch (error) {
    console.error('Fetch subjects error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// POST /api/academic/subjects
router.post('/subjects', async (req, res) => {
  try {
    const prisma = req.prisma;
    const { name, code, classId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Subject name is required' });
    }

    const subject = await prisma.subject.create({
      data: {
        schoolId: req.user.schoolId,
        name: name.trim(),
        code: code ? code.trim() : null,
        classId: classId || null
      }
    });

    res.status(201).json(subject);
  } catch (error) {
    console.error('Create subject error:', error);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// DELETE /api/academic/subjects/:id
router.delete('/subjects/:id', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    const existing = await prisma.subject.findFirst({
      where: { id: req.params.id, schoolId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    await prisma.subject.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

// --- COMPLETE SETUP GATEWAY ---

// POST /api/academic/complete-setup
// Finalizes setup and unlocks all downstream operational modules
router.post('/complete-setup', async (req, res) => {
  try {
    const prisma = req.prisma;
    const schoolId = req.user.schoolId;

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        _count: {
          select: { academicYears: true, classes: true }
        }
      }
    });

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    if (school._count.academicYears === 0 || school._count.classes === 0) {
      return res.status(400).json({ 
        error: 'Cannot complete setup: At least one Academic Year and one Class must be created.',
        counts: school._count 
      });
    }

    const updated = await prisma.school.update({
      where: { id: schoolId },
      data: { setupCompleted: true }
    });

    res.json({
      message: 'Academic setup completed successfully! Full dashboard unlocked.',
      setupCompleted: true,
      school: updated
    });
  } catch (error) {
    console.error('Complete setup error:', error);
    res.status(500).json({ error: 'Failed to complete academic setup' });
  }
});

module.exports = router;
