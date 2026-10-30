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
      include: {
        modules: {
          where: { isEnabled: true },
          select: { moduleId: true }
        }
      }
    });

    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    // Attempt to load extra settings persisted in SchoolDocument
    let extraSettings = {};
    try {
      const doc = await prisma.schoolDocument.findUnique({
        where: {
          schoolId_collection_docId: {
            schoolId: req.params.id,
            collection: 'settings',
            docId: 'environment_setup'
          }
        }
      });
      if (doc && doc.data && typeof doc.data === 'object') {
        extraSettings = doc.data;
      }
    } catch (_) {}

    const { modules, ...schoolData } = school;
    res.json({
      ...schoolData,
      contactPhone: school.phone || extraSettings.contactPhone || '',
      location: school.address || extraSettings.location || '',
      branding: {
        logoUrl: school.logoUrl || extraSettings.branding?.logoUrl || ''
      },
      website: extraSettings.website || '',
      academicConfig: extraSettings.academicConfig || { currentYear: '2026-2027', termType: 'Semester' },
      customData: extraSettings.customData || {},
      permittedModules: modules ? modules.map(m => m.moduleId) : []
    });
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
      select: { id: true, name: true, status: true, setupCompleted: true, academicSetupCompleted: true }
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

// Update school settings (General / Environment / Branding / Setup)
async function updateSchoolDetailsHandler(req, res) {
  try {
    const prisma = req.prisma;
    const schoolId = req.params.id;

    // Check authorization: SuperAdmin or school's Admin
    if (req.user.role !== 'SUPER_ADMIN' && (req.user.schoolId !== schoolId || req.user.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Unauthorized to update this school' });
    }

    const {
      name,
      contactPhone,
      phone,
      location,
      address,
      website,
      branding,
      logoUrl,
      board,
      academicConfig,
      customData,
      setupCompleted,
      academicSetupCompleted
    } = req.body;

    const resolvedLogo = branding?.logoUrl !== undefined ? branding.logoUrl : logoUrl;
    const resolvedPhone = contactPhone !== undefined ? contactPhone : phone;
    const resolvedAddress = location !== undefined ? location : address;

    const dataToUpdate = {};
    if (name && typeof name === 'string') dataToUpdate.name = name.trim();
    if (resolvedPhone !== undefined) dataToUpdate.phone = resolvedPhone ? String(resolvedPhone).trim() : null;
    if (resolvedAddress !== undefined) dataToUpdate.address = resolvedAddress ? String(resolvedAddress).trim() : null;
    if (resolvedLogo !== undefined) dataToUpdate.logoUrl = resolvedLogo;
    if (board !== undefined) dataToUpdate.board = board;
    if (setupCompleted !== undefined) dataToUpdate.setupCompleted = Boolean(setupCompleted);
    if (academicSetupCompleted !== undefined) dataToUpdate.academicSetupCompleted = Boolean(academicSetupCompleted);

    const updatedSchool = await prisma.school.update({
      where: { id: schoolId },
      data: dataToUpdate
    });

    // Upsert full environment / branding metadata in SchoolDocument
    try {
      await prisma.schoolDocument.upsert({
        where: {
          schoolId_collection_docId: {
            schoolId,
            collection: 'settings',
            docId: 'environment_setup'
          }
        },
        create: {
          schoolId,
          collection: 'settings',
          docId: 'environment_setup',
          data: {
            website: website || '',
            academicConfig: academicConfig || { currentYear: '2026-2027', termType: 'Semester' },
            customData: customData || {},
            branding: branding || { logoUrl: resolvedLogo || '' }
          }
        },
        update: {
          data: {
            website: website || '',
            academicConfig: academicConfig || { currentYear: '2026-2027', termType: 'Semester' },
            customData: customData || {},
            branding: branding || { logoUrl: resolvedLogo || '' }
          }
        }
      });
    } catch (docErr) {
      console.warn('Could not persist environment_setup document:', docErr.message);
    }

    res.json({
      message: 'School settings updated successfully',
      school: {
        ...updatedSchool,
        contactPhone: updatedSchool.phone,
        location: updatedSchool.address,
        branding: { logoUrl: updatedSchool.logoUrl || '' },
        website,
        academicConfig,
        customData
      }
    });
  } catch (error) {
    console.error('Update school error:', error);
    res.status(500).json({ error: error.message || 'Failed to update school' });
  }
}

// PUT /api/schools/:id
router.put('/:id', authenticateToken, updateSchoolDetailsHandler);

// PATCH /api/schools/:id
router.patch('/:id', authenticateToken, updateSchoolDetailsHandler);

// Handler for status update
async function updateSchoolStatusHandler(req, res) {
  // If request contains general school fields, delegate to updateSchoolDetailsHandler for backward compatibility
  if (!req.body.status && (req.body.name || req.body.branding || req.body.contactPhone || req.body.phone || req.body.location || req.body.address || req.body.website || req.body.academicConfig || req.body.customData)) {
    return updateSchoolDetailsHandler(req, res);
  }
  try {
    const { status, setupCompleted, academicSetupCompleted } = req.body;
    const prisma = req.prisma;

    // If request only updates setupCompleted or academicSetupCompleted, allow Admin
    if (!status && (setupCompleted !== undefined || academicSetupCompleted !== undefined)) {
      if (req.user.role !== 'SUPER_ADMIN' && req.user.schoolId !== req.params.id) {
        return res.status(403).json({ error: 'Unauthorized to update this school' });
      }
      const updatedSchool = await prisma.school.update({
        where: { id: req.params.id },
        data: {
          ...(setupCompleted !== undefined ? { setupCompleted: Boolean(setupCompleted) } : {}),
          ...(academicSetupCompleted !== undefined ? { academicSetupCompleted: Boolean(academicSetupCompleted) } : {})
        }
      });
      return res.json({ message: 'Setup status updated successfully', school: updatedSchool });
    }

    // Status change (PENDING / ACTIVE / SUSPENDED) requires SUPER_ADMIN
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SuperAdmin can change institution approval status' });
    }

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
router.patch('/:id/status', authenticateToken, updateSchoolStatusHandler);

// PUT /api/schools/:id/status (backward compatibility)
router.put('/:id/status', authenticateToken, updateSchoolStatusHandler);

module.exports = router;
