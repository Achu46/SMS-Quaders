const express = require('express');
const router = express.Router({ mergeParams: true });
const crypto = require('crypto');
const { authenticateToken, requireTenantAccess, requireRole } = require('../middleware');

// =========================================================================
// PAYMENT GATEWAY WEBHOOK (No JWT auth - verified cryptographically via HMAC)
// =========================================================================
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'] || 
                      req.headers['x-razorpay-signature'] || 
                      req.headers['stripe-signature'];
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'quaders_webhook_secret_dev';

    if (!signature) {
      return res.status(401).json({ error: 'Webhook signature header missing' });
    }

    // Determine payload to hash: prioritize rawBody if captured, otherwise JSON body string
    const payloadBuffer = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadBuffer)
      .digest('hex');

    let signatureMatches = false;
    try {
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expectedSignature, 'hex');
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        signatureMatches = true;
      }
    } catch (e) {
      signatureMatches = false;
    }

    if (!signatureMatches) {
      const sigBuf = Buffer.from(String(signature));
      const expBuf = Buffer.from(String(expectedSignature));
      if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
        signatureMatches = true;
      }
    }

    if (!signatureMatches) {
      console.warn('Payment webhook rejected: invalid signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const prisma = req.prisma;
    const body = req.body || {};
    const invoiceId = body.invoiceId || 
                      body.data?.object?.metadata?.invoiceId || 
                      body.payload?.payment?.entity?.notes?.invoiceId;
    const transactionId = body.transactionId || 
                          body.data?.object?.id || 
                          body.payload?.payment?.entity?.id || 
                          `tx_${Date.now()}`;

    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID missing from webhook payload' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Idempotency: If already marked as PAID, acknowledge without error
    if (invoice.status === 'PAID') {
      return res.status(200).json({
        status: 'ok',
        message: 'Invoice already processed (idempotent)',
        invoiceId: invoice.id
      });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        transactionId: transactionId
      }
    });

    // Real-time notification if socket.io is available
    if (req.io && invoice.schoolId) {
      req.io.to(invoice.schoolId).emit('invoice_paid', {
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        amount: invoice.amount,
        transactionId
      });
    }

    res.status(200).json({
      status: 'ok',
      message: 'Payment processed successfully',
      invoice: updated
    });
  } catch (error) {
    console.error('Payment webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// =========================================================================
// TENANT FEES API (Authenticated & Role-Scoped)
// =========================================================================

// GET /api/schools/:schoolId/fees/structures
router.get('/structures', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const prisma = req.prisma;

    const structures = await prisma.feeStructure.findMany({
      where: { schoolId },
      include: {
        class: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(structures);
  } catch (error) {
    console.error('Error fetching fee structures:', error);
    res.status(500).json({ error: 'Failed to fetch fee structures' });
  }
});

// POST /api/schools/:schoolId/fees/structures
router.post('/structures', authenticateToken, requireTenantAccess, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { classId, name, amount, dueDate } = req.body;
    const prisma = req.prisma;

    if (!classId || !name || amount === undefined || !dueDate) {
      return res.status(400).json({ error: 'classId, name, amount, and dueDate are required' });
    }

    // Verify class belongs to tenant
    const cls = await prisma.class.findFirst({
      where: { id: classId, schoolId }
    });
    if (!cls) {
      return res.status(400).json({ error: 'Class not found in this school' });
    }

    const structure = await prisma.feeStructure.create({
      data: {
        schoolId,
        classId,
        name: name.trim(),
        amount: parseFloat(amount),
        dueDate: new Date(dueDate)
      }
    });

    res.status(201).json(structure);
  } catch (error) {
    console.error('Error creating fee structure:', error);
    res.status(500).json({ error: 'Failed to create fee structure' });
  }
});

// GET /api/schools/:schoolId/fees/invoices
router.get('/invoices', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId, status } = req.query;
    const prisma = req.prisma;

    const where = { schoolId };
    if (status) where.status = status.toUpperCase();

    // Strict Parent Authorization Scoping: Parents can ONLY see invoices for their linked children
    if (req.user.role === 'PARENT') {
      const parent = await prisma.parent.findFirst({
        where: { userId: req.user.id },
        include: { students: true }
      });
      const allowedStudentIds = parent?.students.map(s => s.studentId) || [];
      
      if (studentId) {
        if (!allowedStudentIds.includes(studentId)) {
          return res.status(403).json({ error: 'Unauthorized to view fee details for this student' });
        }
        where.studentId = studentId;
      } else {
        where.studentId = { in: allowedStudentIds };
      }
    } else if (studentId) {
      where.studentId = studentId;
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        feeStructure: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// PUT /api/schools/:schoolId/fees/invoices/:id/pay
// RESTRICTED TO ADMIN / SUPER_ADMIN ONLY (for manual in-person cash receipts)
// Online parent payments must go through verified webhook
router.put('/invoices/:id/pay', authenticateToken, requireTenantAccess, requireRole(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const prisma = req.prisma;

    // Verify invoice belongs to the authenticated school
    const existing = await prisma.invoice.findFirst({
      where: { id, schoolId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found in this school' });
    }

    if (existing.status === 'PAID') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        transactionId: `manual_cash_${Date.now()}`
      }
    });

    res.json({ message: 'Offline invoice payment recorded successfully', invoice: updated });
  } catch (error) {
    console.error('Error paying invoice:', error);
    res.status(500).json({ error: 'Failed to record invoice payment' });
  }
});

module.exports = router;
