const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken, requireTenantAccess } = require('../middleware');

// Allow public unauthenticated read for global subscription_plans collection
const checkCollectionReadAccess = (req, res, next) => {
  if (req.params.schoolId === 'global' && req.params.collection === 'subscription_plans') {
    req.schoolId = 'global';
    return next();
  }
  return authenticateToken(req, res, () => {
    requireTenantAccess(req, res, next);
  });
};

// GET /api/schools/:schoolId/collections/:collection
// Query all documents in a collection
router.get('/:collection', checkCollectionReadAccess, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { collection } = req.params;
    const prisma = req.prisma;

    const docs = await prisma.schoolDocument.findMany({
      where: {
        schoolId,
        collection
      },
      orderBy: { createdAt: 'desc' }
    });

    // Flatten document response to include id + all properties in data
    const result = docs.map(d => ({
      id: d.id,
      ...(typeof d.data === 'object' && d.data !== null ? d.data : {}),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt
    }));

    res.json(result);
  } catch (error) {
    console.error(`Error querying collection ${req.params.collection}:`, error);
    res.status(500).json({ error: 'Failed to fetch collection data' });
  }
});

// GET /api/schools/:schoolId/collections/:collection/:id
// Get single document
router.get('/:collection/:id', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { collection, id } = req.params;
    const prisma = req.prisma;

    const doc = await prisma.schoolDocument.findFirst({
      where: {
        id,
        schoolId,
        collection
      }
    });

    if (!doc) {
      if (collection === 'email_templates' && id === 'default') {
        return res.json({ id: 'default', collection: 'email_templates', schoolId });
      }
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      id: doc.id,
      ...(typeof doc.data === 'object' && doc.data !== null ? doc.data : {}),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// POST /api/schools/:schoolId/collections/:collection
// Add a new document
router.post('/:collection', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { collection } = req.params;
    const payload = req.body;
    const prisma = req.prisma;

    // Ensure 'global' pseudo-tenant exists for system collections to satisfy FK constraint
    if (schoolId === 'global') {
      await prisma.school.upsert({
        where: { id: 'global' },
        update: {},
        create: {
          id: 'global',
          name: 'Global System Workspace',
          status: 'ACTIVE',
          setupCompleted: true
        }
      }).catch(() => {});
    }

    // Separate explicit ID if provided, otherwise let Prisma generate UUID
    const customId = payload.id;
    const dataToStore = { ...payload };
    delete dataToStore.id;

    const created = await prisma.schoolDocument.create({
      data: {
        ...(customId ? { id: customId } : {}),
        schoolId,
        collection,
        data: dataToStore
      }
    });

    const responseDoc = {
      id: created.id,
      ...dataToStore,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    };

    // Real-time broadcast to tenant room
    if (req.io) {
      req.io.to(schoolId).emit('collection_change', {
        action: 'create',
        collection,
        doc: responseDoc
      });
    }

    res.status(201).json(responseDoc);
  } catch (error) {
    console.error(`Error adding to collection ${req.params.collection}:`, error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// PUT /api/schools/:schoolId/collections/:collection/:id
// Update an existing document
router.put('/:collection/:id', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { collection, id } = req.params;
    const updates = req.body;
    const prisma = req.prisma;

    const existing = await prisma.schoolDocument.findFirst({
      where: { id, schoolId, collection }
    });

    if (!existing) {
      // Ensure 'global' pseudo-tenant exists if schoolId is global
      if (schoolId === 'global') {
        await prisma.school.upsert({
          where: { id: 'global' },
          update: {},
          create: {
            id: 'global',
            name: 'Global System Workspace',
            status: 'ACTIVE',
            setupCompleted: true
          }
        }).catch(() => {});
      }

      // Upsert if not exists
      const created = await prisma.schoolDocument.create({
        data: {
          id,
          schoolId,
          collection,
          data: updates
        }
      });

      const responseDoc = { id: created.id, ...updates, createdAt: created.createdAt, updatedAt: created.updatedAt };
      if (req.io) req.io.to(schoolId).emit('collection_change', { action: 'create', collection, doc: responseDoc });
      return res.json(responseDoc);
    }

    const currentData = typeof existing.data === 'object' && existing.data !== null ? existing.data : {};
    const mergedData = { ...currentData, ...updates };

    const updated = await prisma.schoolDocument.update({
      where: { id: existing.id },
      data: {
        data: mergedData
      }
    });

    const responseDoc = {
      id: updated.id,
      ...mergedData,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };

    if (req.io) {
      req.io.to(schoolId).emit('collection_change', {
        action: 'update',
        collection,
        doc: responseDoc
      });
    }

    res.json(responseDoc);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// DELETE /api/schools/:schoolId/collections/:collection/:id
// Delete document
router.delete('/:collection/:id', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { collection, id } = req.params;
    const prisma = req.prisma;

    await prisma.schoolDocument.deleteMany({
      where: {
        id,
        schoolId,
        collection
      }
    });

    if (req.io) {
      req.io.to(schoolId).emit('collection_change', {
        action: 'delete',
        collection,
        docId: id
      });
    }

    res.json({ message: 'Document deleted successfully', id });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
