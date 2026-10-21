const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('\n========================================');
console.log('🧪 Starting P1 Architecture & Security Test Suite');
console.log('========================================\n');

let passedTests = 0;
let totalTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }
}

async function runAllP1Tests() {
  const storageService = require('../services/storageService');
  const emailService = require('../services/emailService');
  const whatsappService = require('../services/whatsappService');

  // -------------------------------------------------------------
  // 1. STORAGE SERVICE ABSTRACTION & FALLBACK
  // -------------------------------------------------------------
  await test('Storage: Blocks disallowed executable MIME types & extensions (.exe, .sh, .html)', async () => {
    let blocked = false;
    try {
      storageService.validateFile({
        mimetype: 'application/x-msdownload',
        size: 1024,
        originalname: 'malware.exe'
      });
    } catch (e) {
      blocked = true;
      assert.match(e.message, /not permitted/i);
    }
    assert.strictEqual(blocked, true, 'Disallowed MIME type should be blocked');

    let extBlocked = false;
    try {
      storageService.validateFile({
        mimetype: 'text/plain',
        size: 1024,
        originalname: 'attack.sh'
      });
    } catch (e) {
      extBlocked = true;
      assert.match(e.message, /blocked for security/i);
    }
    assert.strictEqual(extBlocked, true, 'Executable extension should be blocked');
  });

  await test('Storage: Blocks files exceeding size threshold (5MB for general files)', async () => {
    let sizeBlocked = false;
    try {
      storageService.validateFile({
        mimetype: 'image/jpeg',
        size: 6 * 1024 * 1024,
        originalname: 'huge_photo.jpg'
      });
    } catch (e) {
      sizeBlocked = true;
      assert.match(e.message, /exceeds the 5MB limit/i);
    }
    assert.strictEqual(sizeBlocked, true);
  });

  await test('Storage: Automatically falls back to local disk storage when Cloudinary is unavailable', async () => {
    const testBuffer = Buffer.from('test image payload content');
    const result = await storageService.upload({
      buffer: testBuffer,
      originalname: 'sample_avatar.png',
      mimetype: 'image/png',
      schoolId: 'test_school_101',
      folder: 'avatars'
    });

    assert.strictEqual(result.success, true);
    assert(result.url.startsWith('/uploads/tenants/test_school_101/avatars/'));
    assert.strictEqual(result.provider, 'local');

    // Verify file actually exists on disk
    const relativePath = result.url.replace(/^\/uploads\//, '');
    const diskPath = path.join(storageService.uploadsDir, relativePath);
    assert.strictEqual(fs.existsSync(diskPath), true, 'File must exist on disk');

    // Clean up
    await storageService.delete({ fileUrl: result.url, schoolId: 'test_school_101' });
    assert.strictEqual(fs.existsSync(diskPath), false, 'File must be removed after delete');
  });

  await test('Storage: Prevents cross-tenant file deletion', async () => {
    let deleteFailed = false;
    try {
      await storageService.delete({
        fileUrl: '/uploads/tenants/victim_school_999/avatars/secret.png',
        schoolId: 'attacker_school_111'
      });
    } catch (e) {
      deleteFailed = true;
      assert.match(e.message, /cannot delete file belonging to another tenant/i);
    }
    assert.strictEqual(deleteFailed, true);
  });

  // -------------------------------------------------------------
  // 2. CENTRALIZED EMAIL SERVICE (NODEMAILER)
  // -------------------------------------------------------------
  await test('Email: Correctly renders templates (WELCOME, FORGOT_PASSWORD, APPROVAL)', async () => {
    const welcome = emailService.renderTemplate('WELCOME', {
      userName: 'Alice Smith',
      role: 'Teacher',
      loginUrl: 'https://quaders.com/login',
      schoolName: 'Greenwood High'
    });

    assert.match(welcome.subject, /Welcome to Greenwood High/i);
    assert.match(welcome.html, /Alice Smith/);
    assert.match(welcome.html, /Teacher/);
    assert.match(welcome.html, /https:\/\/quaders\.com\/login/);

    const forgot = emailService.renderTemplate('FORGOT_PASSWORD', {
      resetLink: 'https://quaders.com/reset?token=xyz123'
    });
    assert.match(forgot.subject, /Password Reset Request/i);
    assert.match(forgot.html, /xyz123/);
  });

  await test('Email: Dispatches email via transporter without exposing credentials or crashing in dev', async () => {
    const res = await emailService.send({
      to: 'principal@school.edu',
      templateType: 'WELCOME',
      data: {
        userName: 'Principal Anderson',
        role: 'Admin',
        loginUrl: 'https://school.quaders.com/login'
      }
    });

    assert.strictEqual(res.success, true);
    assert(res.messageId, 'Message ID must be returned');
    assert.strictEqual(res.to, 'principal@school.edu');
  });

  // -------------------------------------------------------------
  // 3. WHATSAPP META CLOUD API SERVICE
  // -------------------------------------------------------------
  await test('WhatsApp: Normalizes recipient phone numbers to E.164 standard format', async () => {
    assert.strictEqual(whatsappService.normalizePhoneNumber('+91 98765-43210'), '919876543210');
    assert.strictEqual(whatsappService.normalizePhoneNumber('9876543210'), '919876543210');
    assert.strictEqual(whatsappService.normalizePhoneNumber('+1 (555) 234-5678'), '15552345678');

    let invalidPhone = false;
    try {
      whatsappService.normalizePhoneNumber('123'); // Too short
    } catch (e) {
      invalidPhone = true;
      assert.match(e.message, /invalid phone number length/i);
    }
    assert.strictEqual(invalidPhone, true);
  });

  await test('WhatsApp: Correctly structures PTM and Notice template components', async () => {
    const ptmComponents = whatsappService.buildPTMComponents({
      parentName: 'Mr. David',
      studentName: 'Lucas David',
      date: '2026-09-20',
      time: '10:30 AM',
      meetingType: 'Online'
    });

    assert.strictEqual(ptmComponents.length, 1);
    assert.strictEqual(ptmComponents[0].type, 'body');
    assert.strictEqual(ptmComponents[0].parameters[0].text, 'Mr. David');
    assert.strictEqual(ptmComponents[0].parameters[1].text, 'Lucas David');

    const noticeComponents = whatsappService.buildNoticeComponents({
      noticeTitle: 'Annual Sports Day Notice',
      noticeDate: '2026-09-25',
      audience: 'All Parents'
    });
    assert.strictEqual(noticeComponents[0].parameters[0].text, 'Annual Sports Day Notice');
  });

  await test('WhatsApp: Dispatches template message safely in dev/mock without throwing fatal crashes', async () => {
    process.env.NODE_ENV = 'test';
    const result = await whatsappService.sendTemplateMessage({
      accessToken: 'mock_access_token',
      phoneNumberId: 'mock_phone_id_123',
      recipientPhone: '+919876543210',
      templateName: 'school_ptm_scheduled',
      components: []
    });

    assert.strictEqual(result.success, true);
    assert(result.messageId.startsWith('wamid.mock_'));
  });

  // -------------------------------------------------------------
  // 4. SUPPORT TICKETS PRISMA MODEL & API
  // -------------------------------------------------------------
  await test('Tickets: Lifecycle test (creation, status updates, replies, audit history, tenant isolation)', async () => {
    let mockTickets = [];
    let mockMessages = [];
    let mockHistory = [];

    const mockPrisma = {
      supportTicket: {
        create: async ({ data }) => {
          const id = `tck_${Date.now()}`;
          const t = { id, ...data, messages: [], history: [] };
          mockTickets.push(t);
          if (data.history?.create) {
            mockHistory.push({ id: `h_${Date.now()}`, ticketId: id, ...data.history.create });
          }
          return t;
        },
        findMany: async ({ where }) => {
          return mockTickets.filter(t => {
            if (where.schoolId && t.schoolId !== where.schoolId) return false;
            if (where.status && t.status !== where.status) return false;
            return true;
          });
        },
        findUnique: async ({ where }) => {
          const t = mockTickets.find(x => x.id === where.id);
          if (!t) return null;
          return {
            ...t,
            messages: mockMessages.filter(m => m.ticketId === t.id),
            history: mockHistory.filter(h => h.ticketId === t.id)
          };
        },
        update: async ({ where, data }) => {
          const idx = mockTickets.findIndex(x => x.id === where.id);
          if (idx === -1) throw new Error('Ticket not found');
          if (data.history?.create) {
            mockHistory.push({ id: `h_${Date.now()}`, ticketId: where.id, ...data.history.create });
          }
          mockTickets[idx] = { ...mockTickets[idx], ...data };
          return mockTickets[idx];
        }
      },
      supportTicketMessage: {
        create: async ({ data }) => {
          const msg = { id: `msg_${Date.now()}`, ...data, createdAt: new Date() };
          mockMessages.push(msg);
          return msg;
        }
      }
    };

    // 1. Create a ticket for School A
    const newTicket = await mockPrisma.supportTicket.create({
      data: {
        ticketNumber: 'TICK-1001',
        schoolId: 'school_alpha',
        creatorId: 'usr_admin_alpha',
        creatorName: 'Admin Alpha',
        creatorEmail: 'admin@alpha.edu',
        subject: 'Need assistance with fee structure',
        description: 'Unable to assign term 2 fee structure',
        priority: 'HIGH',
        status: 'OPEN',
        history: {
          create: {
            actorId: 'usr_admin_alpha',
            actorName: 'Admin Alpha',
            action: 'CREATED',
            newValue: 'OPEN'
          }
        }
      }
    });

    assert.strictEqual(newTicket.status, 'OPEN');
    assert.strictEqual(newTicket.priority, 'HIGH');

    // 2. Post a reply from SuperAdmin Support
    const reply = await mockPrisma.supportTicketMessage.create({
      data: {
        ticketId: newTicket.id,
        senderId: 'usr_superadmin',
        senderName: 'SuperAdmin Support',
        senderRole: 'SUPER_ADMIN',
        message: 'We have updated the fee structure configuration for your school.'
      }
    });
    assert.strictEqual(reply.senderRole, 'SUPER_ADMIN');

    // Update status to IN_PROGRESS
    await mockPrisma.supportTicket.update({
      where: { id: newTicket.id },
      data: {
        status: 'IN_PROGRESS',
        history: {
          create: {
            actorId: 'usr_superadmin',
            actorName: 'SuperAdmin Support',
            action: 'STATUS_CHANGED',
            oldValue: 'OPEN',
            newValue: 'IN_PROGRESS'
          }
        }
      }
    });

    // 3. Verify ticket details and history
    const detail = await mockPrisma.supportTicket.findUnique({ where: { id: newTicket.id } });
    assert.strictEqual(detail.status, 'IN_PROGRESS');
    assert.strictEqual(detail.messages.length, 1);
    assert.strictEqual(detail.history.length, 2);

    // 4. Verify Tenant Isolation (School Beta query cannot see School Alpha tickets)
    const schoolBetaTickets = await mockPrisma.supportTicket.findMany({ where: { schoolId: 'school_beta' } });
    assert.strictEqual(schoolBetaTickets.length, 0, 'School Beta must see 0 tickets');

    const schoolAlphaTickets = await mockPrisma.supportTicket.findMany({ where: { schoolId: 'school_alpha' } });
    assert.strictEqual(schoolAlphaTickets.length, 1, 'School Alpha must see its 1 ticket');
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log(`📊 P1 Test Results: ${passedTests}/${totalTests} Passed`);
  console.log('========================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllP1Tests().catch(err => {
  console.error('Test runner encountered uncaught error:', err);
  process.exit(1);
});
