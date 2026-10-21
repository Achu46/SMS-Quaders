const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware');

// GET /api/schools
// SuperAdmin only: list all schools, filterable by status
router.get('/', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const prisma = req.prisma;
    const { status } = req.query;

    const normalizedStatus = status && ['PENDING', 'ACTIVE', 'SUSPENDED'].includes(status.toUpperCase()) 
      ? status.toUpperCase() 
      : undefined;

    const schools = await prisma.school.findMany({
      where: {
        ...(normalizedStatus ? { status: normalizedStatus } : {})
      },
      include: {
        users: {
          where: { role: 'ADMIN' },
          select: { id: true, name: true, email: true, phone: true }
        },
        _count: {
          select: {
            students: true,
            classes: true,
            users: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(schools);
  } catch (error) {
    console.error('Fetch schools error:', error);
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
});

// GET /api/schools/:id
// Get a specific school's details
router.get('/:id', async (req, res) => {
  try {
    const prisma = req.prisma;
    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        status: true,
        setupCompleted: true,
        board: true,
        address: true,
        phone: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    res.json(school);
  } catch (error) {
    console.error('Fetch school error:', error);
    res.status(500).json({ error: 'Failed to fetch school details' });
  }
});

// GET /api/schools/:id/status
// Status polling endpoint
router.get('/:id/status', async (req, res) => {
  try {
    const prisma = req.prisma;
    const school = await prisma.school.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, status: true, setupCompleted: true }
    });

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    res.json(school);
  } catch (error) {
    console.error('Fetch status error:', error);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// Handler for status update
async function updateSchoolStatusHandler(req, res) {
  try {
    const { status } = req.body;
    const prisma = req.prisma;

    let mappedStatus = status ? status.toUpperCase() : '';
    if (mappedStatus === 'APPROVED') {
      mappedStatus = 'ACTIVE';
    }

    if (!mappedStatus || !['PENDING', 'ACTIVE', 'SUSPENDED'].includes(mappedStatus)) {
      return res.status(400).json({ error: 'Valid status required: PENDING, ACTIVE, SUSPENDED' });
    }

    const updatedSchool = await prisma.school.update({
      where: { id: req.params.id },
      data: { status: mappedStatus }
    });

    res.json({ message: `School status updated to ${mappedStatus}`, school: updatedSchool });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update school status' });
  }
}

// PATCH /api/schools/:id/status
router.patch('/:id/status', authenticateToken, requireRole(['SUPER_ADMIN']), updateSchoolStatusHandler);

// PUT /api/schools/:id/status (backward compatibility)
router.put('/:id/status', authenticateToken, requireRole(['SUPER_ADMIN']), updateSchoolStatusHandler);

module.exports = router;
