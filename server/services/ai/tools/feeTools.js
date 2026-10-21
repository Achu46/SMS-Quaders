/**
 * Controlled Read-Only Fee & Invoicing Tools
 * Handles Student Invoices, Pending Dues, and Collection Summaries
 */

const feeTools = [
  {
    name: 'get_student_fee_status',
    description: 'Get fee status, pending invoices, and paid history for a specific student.',
    module: 'fees',
    parameters: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: 'Unique UUID of the student'
        },
        admissionNo: {
          type: 'string',
          description: 'Admission number of the student'
        }
      }
    },
    handler: async ({ studentId, admissionNo }, context) => {
      const { schoolId, user, prisma } = context;

      const student = await prisma.student.findFirst({
        where: {
          schoolId,
          ...(studentId ? { id: studentId } : {}),
          ...(admissionNo ? { admissionNo: admissionNo.trim() } : {})
        },
        include: { class: true }
      });

      if (!student) {
        return { error: 'Student not found.' };
      }

      // If user is a Parent, make sure they only view their child's fees
      if (user.role === 'PARENT') {
        const link = await prisma.parentStudent.findFirst({
          where: { parent: { userId: user.id, schoolId }, studentId: student.id }
        });
        if (!link) {
          return { error: 'Access denied: You can only view fee records of your own children.' };
        }
      }

      const invoices = await prisma.invoice.findMany({
        where: { schoolId, studentId: student.id },
        include: { feeStructure: true },
        orderBy: { dueDate: 'asc' }
      });

      let totalPending = 0;
      let totalPaid = 0;

      const pendingInvoices = [];
      const paidInvoices = [];

      for (const inv of invoices) {
        const feeName = inv.feeStructure ? inv.feeStructure.name : 'School Fee';
        if (inv.status === 'PAID') {
          totalPaid += inv.amount;
          paidInvoices.push({
            feeName,
            amount: inv.amount,
            paidAt: inv.paidAt ? inv.paidAt.toISOString().split('T')[0] : 'Paid'
          });
        } else {
          totalPending += inv.amount;
          pendingInvoices.push({
            id: inv.id,
            feeName,
            amount: inv.amount,
            dueDate: inv.dueDate.toISOString().split('T')[0],
            isOverdue: new Date(inv.dueDate) < new Date()
          });
        }
      }

      return {
        student: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
        className: student.class ? student.class.name : 'N/A',
        totalDues: totalPending,
        totalPaid,
        hasPendingFees: totalPending > 0,
        pendingInvoices,
        recentPaidInvoices: paidInvoices.slice(0, 5)
      };
    }
  },

  {
    name: 'get_pending_fees',
    description: 'Get list of students who have pending or overdue fees, with optional class filtering.',
    module: 'fees',
    parameters: {
      type: 'object',
      properties: {
        className: {
          type: 'string',
          description: 'Optional class name to filter (e.g. "Class 10")'
        },
        limit: {
          type: 'integer',
          description: 'Maximum records to return (default 20, max 50)'
        }
      }
    },
    handler: async ({ className, limit = 20 }, context) => {
      const { schoolId, user, prisma } = context;

      if (user.role === 'PARENT') {
        return { error: 'Access denied: General pending fee reports are restricted to school administrators.' };
      }

      const cleanLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 50);

      let classIdFilter = undefined;
      if (className) {
        const found = await prisma.class.findFirst({
          where: { schoolId, name: { contains: className.trim(), mode: 'insensitive' } }
        });
        if (found) {
          classIdFilter = found.id;
        }
      }

      const pendingInvoices = await prisma.invoice.findMany({
        where: {
          schoolId,
          status: 'PENDING',
          ...(classIdFilter ? { student: { classId: classIdFilter } } : {})
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNo: true, class: true }
          },
          feeStructure: { select: { name: true } }
        },
        take: cleanLimit,
        orderBy: { dueDate: 'asc' }
      });

      const totalPendingAmount = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

      return {
        count: pendingInvoices.length,
        totalPendingAmount,
        invoices: pendingInvoices.map(inv => ({
          studentName: `${inv.student.firstName} ${inv.student.lastName}`.trim(),
          admissionNo: inv.student.admissionNo,
          className: inv.student.class ? inv.student.class.name : 'N/A',
          feeType: inv.feeStructure?.name || 'Fee',
          amount: inv.amount,
          dueDate: inv.dueDate.toISOString().split('T')[0],
          isOverdue: new Date(inv.dueDate) < new Date()
        }))
      };
    }
  },

  {
    name: 'get_payment_history',
    description: 'Summarize fee collection totals for a specific month, year, or overall collection summary.',
    module: 'fees',
    parameters: {
      type: 'object',
      properties: {
        month: {
          type: 'integer',
          description: 'Month number (1-12, e.g. 8 for August)'
        },
        year: {
          type: 'integer',
          description: 'Year (e.g. 2026)'
        }
      }
    },
    handler: async ({ month, year }, context) => {
      const { schoolId, user, prisma } = context;

      if (user.role === 'PARENT') {
        return { error: 'Access denied: Aggregate fee collection statistics are restricted to staff.' };
      }

      const now = new Date();
      const targetYear = year || now.getFullYear();
      const targetMonth = month || (now.getMonth() + 1);

      const startOfMonth = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
      const endOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59));

      const paidInvoices = await prisma.invoice.findMany({
        where: {
          schoolId,
          status: 'PAID',
          paidAt: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });

      const totalCollected = paidInvoices.reduce((acc, inv) => acc + inv.amount, 0);

      // Pending invoices created or due in this period
      const pendingInvoices = await prisma.invoice.findMany({
        where: {
          schoolId,
          status: 'PENDING',
          dueDate: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        }
      });

      const totalPending = pendingInvoices.reduce((acc, inv) => acc + inv.amount, 0);

      return {
        month: targetMonth,
        year: targetYear,
        totalPaidInvoicesCount: paidInvoices.length,
        totalAmountCollected: totalCollected,
        totalPendingInvoicesCount: pendingInvoices.length,
        totalPendingAmount: totalPending,
        collectionRate: (totalCollected + totalPending > 0)
          ? `${((totalCollected / (totalCollected + totalPending)) * 100).toFixed(1)}%`
          : '0%'
      };
    }
  }
];

module.exports = feeTools;
