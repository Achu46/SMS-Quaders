const express = require('express');
const router = express.Router({ mergeParams: true });
const { authenticateToken, requireTenantAccess, requireRole } = require('../middleware');

// POST /api/schools/:schoolId/leaves
// Apply for a leave
router.post('/', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { leaveType, startDate, endDate, reason, studentId, supportingDoc } = req.body;
    const prisma = req.prisma;

    if (!leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({ error: 'leaveType, startDate, endDate, and reason are required' });
    }

    const leave = await prisma.leaveRequest.create({
      data: {
        schoolId,
        applicantId: req.user.id,
        applicantName: req.user.name || req.user.email || 'Applicant',
        applicantRole: req.user.role ? req.user.role.toLowerCase() : 'staff',
        studentId: studentId || null,
        leaveType,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason,
        supportingDoc: supportingDoc || null,
        status: 'PENDING'
      }
    });

    if (req.io) {
      req.io.to(schoolId).emit('leave_requested', leave);
    }

    res.status(201).json(leave);
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({ error: 'Failed to submit leave request' });
  }
});

// GET /api/schools/:schoolId/leaves
// Get leave requests for a school
router.get('/', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId, applicantId, status } = req.query;
    const prisma = req.prisma;

    const where = { schoolId };
    
    // Scoping for Parents: only view their own leave requests
    if (req.user.role === 'PARENT') {
      where.applicantId = req.user.id;
    } else {
      if (applicantId) where.applicantId = applicantId;
    }

    if (studentId) where.studentId = studentId;
    if (status) where.status = status.toUpperCase();

    const leaves = await prisma.leaveRequest.findMany({
      where,
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNo: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(leaves);
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// PUT /api/schools/:schoolId/leaves/:id/status
// Approve or Reject a leave request (Admin and Staff only)
router.put('/:id/status', authenticateToken, requireTenantAccess, requireRole(['ADMIN', 'STAFF', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const { status } = req.body;
    const prisma = req.prisma;

    if (!status || !['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      return res.status(400).json({ error: 'Valid status required (PENDING, APPROVED, REJECTED)' });
    }

    // Verify leave belongs to this tenant to prevent IDOR
    const existing = await prisma.leaveRequest.findFirst({
      where: { id, schoolId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Leave request not found for this tenant' });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: existing.id },
      data: {
        status: status.toUpperCase()
      }
    });

    if (req.io) {
      req.io.to(schoolId).emit('leave_status_updated', updated);
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating leave status:', error);
    res.status(500).json({ error: 'Failed to update leave status' });
  }
});

module.exports = router;
