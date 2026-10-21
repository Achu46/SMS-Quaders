const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware');

// Generate unique human-readable ticket number (e.g. "TICK-839201")
function generateTicketNumber() {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `TICK-${rand}`;
}

// GET /api/tickets
// SuperAdmin views all tickets; Tenant users view tickets for their school/account
router.get('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const userRole = (req.user.role || '').toUpperCase();
    const userSchoolId = req.user.schoolId;
    const { status, priority, schoolId } = req.query;

    const where = {};

    if (userRole === 'SUPER_ADMIN') {
      if (schoolId) where.schoolId = schoolId;
    } else {
      // Tenant Isolation: strictly restrict to current school or tickets created by user
      if (userSchoolId) {
        where.OR = [
          { schoolId: userSchoolId },
          { creatorId: req.user.id }
        ];
      } else {
        where.creatorId = req.user.id;
      }
    }

    if (status && status !== 'all') {
      where.status = status.toUpperCase().replace('-', '_');
    }

    if (priority && priority !== 'all') {
      where.priority = priority.toUpperCase();
    }

    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        school: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' }
        },
        history: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(tickets);
  } catch (error) {
    console.error('Fetch support tickets error:', error);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
});

// POST /api/tickets
// Create a new support ticket
router.post('/', authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const { subject, description, priority = 'MEDIUM', schoolId } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }

    const userRole = (req.user.role || '').toUpperCase();
    // Non-superadmins are strictly tied to their own schoolId
    const targetSchoolId = userRole === 'SUPER_ADMIN' ? (schoolId || null) : (req.user.schoolId || null);

    const validPriority = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(priority?.toUpperCase()) 
      ? priority.toUpperCase() 
      : 'MEDIUM';

    const ticketNumber = generateTicketNumber();

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        schoolId: targetSchoolId,
        creatorId: req.user.id,
        creatorName: req.user.name || 'User',
        creatorEmail: req.user.email,
        subject: subject.trim(),
        description: description.trim(),
        priority: validPriority,
        status: 'OPEN',
        history: {
          create: {
            actorId: req.user.id,
            actorName: req.user.name || 'User',
            action: 'CREATED',
            newValue: 'OPEN'
          }
        }
      },
      include: {
        school: true,
        messages: true,
        history: true
      }
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Create support ticket error:', error);
    res.status(500).json({ error: 'Failed to create support ticket' });
  }
});

// GET /api/tickets/:id
// Get details of a single ticket with isolation check
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: req.params.id },
      include: {
        school: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        history: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Tenant Isolation Check
    const userRole = (req.user.role || '').toUpperCase();
    if (userRole !== 'SUPER_ADMIN') {
      const isOwner = ticket.creatorId === req.user.id;
      const isSchoolMatch = ticket.schoolId && ticket.schoolId === req.user.schoolId;
      if (!isOwner && !isSchoolMatch) {
        return res.status(403).json({ error: 'Access denied to this ticket' });
      }
    }

    res.json(ticket);
  } catch (error) {
    console.error('Fetch ticket detail error:', error);
    res.status(500).json({ error: 'Failed to fetch ticket details' });
  }
});

// PUT /api/tickets/:id/status
// Update status of a ticket
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const normalizedStatus = status.toUpperCase().replace('-', '_');
    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].includes(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Tenant Isolation
    const userRole = (req.user.role || '').toUpperCase();
    if (userRole !== 'SUPER_ADMIN') {
      const isOwner = ticket.creatorId === req.user.id;
      const isSchoolMatch = ticket.schoolId && ticket.schoolId === req.user.schoolId;
      if (!isOwner && !isSchoolMatch) {
        return res.status(403).json({ error: 'Access denied to this ticket' });
      }
    }

    const oldStatus = ticket.status;

    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: {
        status: normalizedStatus,
        history: {
          create: {
            actorId: req.user.id,
            actorName: req.user.name || 'User',
            action: 'STATUS_CHANGED',
            oldValue: oldStatus,
            newValue: normalizedStatus
          }
        }
      },
      include: {
        messages: true,
        history: { orderBy: { createdAt: 'desc' } }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

// PUT /api/tickets/:id/assign
// SuperAdmin assigns ticket to staff/agent
router.put('/:id/assign', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const prisma = req.prisma;
    const { assignedToId } = req.body;

    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    const updated = await prisma.supportTicket.update({
      where: { id: req.params.id },
      data: {
        assignedToId: assignedToId || null,
        history: {
          create: {
            actorId: req.user.id,
            actorName: req.user.name || 'SuperAdmin',
            action: 'ASSIGNED',
            oldValue: ticket.assignedToId,
            newValue: assignedToId || 'UNASSIGNED'
          }
        }
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        history: { orderBy: { createdAt: 'desc' } }
      }
    });

    res.json(updated);
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({ error: 'Failed to assign ticket' });
  }
});

// POST /api/tickets/:id/reply
// Post a reply message on a ticket
router.post('/:id/reply', authenticateToken, async (req, res) => {
  try {
    const prisma = req.prisma;
    const { message, attachments = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

    // Isolation check
    const userRole = (req.user.role || '').toUpperCase();
    if (userRole !== 'SUPER_ADMIN') {
      const isOwner = ticket.creatorId === req.user.id;
      const isSchoolMatch = ticket.schoolId && ticket.schoolId === req.user.schoolId;
      if (!isOwner && !isSchoolMatch) {
        return res.status(403).json({ error: 'Access denied to this ticket' });
      }
    }

    const newReply = await prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: req.user.id,
        senderName: req.user.name || (userRole === 'SUPER_ADMIN' ? 'SuperAdmin Support' : 'User'),
        senderRole: userRole,
        message: message.trim(),
        attachments: Array.isArray(attachments) ? attachments : []
      }
    });

    // Auto-update status to IN_PROGRESS if currently OPEN or RESOLVED
    let nextStatus = ticket.status;
    if (ticket.status === 'RESOLVED' || ticket.status === 'OPEN') {
      nextStatus = 'IN_PROGRESS';
    }

    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        history: {
          create: {
            actorId: req.user.id,
            actorName: req.user.name || 'User',
            action: 'REPLIED',
            newValue: `Replied by ${userRole}`
          }
        }
      }
    });

    res.status(201).json(newReply);
  } catch (error) {
    console.error('Post ticket reply error:', error);
    res.status(500).json({ error: 'Failed to post ticket reply' });
  }
});

// DELETE /api/tickets/:id
router.delete('/:id', authenticateToken, requireRole(['SUPER_ADMIN']), async (req, res) => {
  try {
    const prisma = req.prisma;
    await prisma.supportTicket.delete({ where: { id: req.params.id } });
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Delete ticket error:', error);
    res.status(500).json({ error: 'Failed to delete ticket' });
  }
});

module.exports = router;
