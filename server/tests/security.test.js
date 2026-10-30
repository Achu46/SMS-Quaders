const assert = require('assert');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_me_in_production';
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'queflow_webhook_secret_dev';

console.log('\n========================================');
console.log('🔒 Starting P0 Security & Isolation Test Suite');
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

// Helper to create mock Express req/res
function createMockReqRes(options = {}) {
  const req = {
    method: options.method || 'GET',
    url: options.url || '/',
    headers: options.headers || {},
    params: options.params || {},
    query: options.query || {},
    body: options.body || {},
    rawBody: options.rawBody || null,
    user: options.user || null,
    prisma: options.prisma || {},
    io: options.io || null
  };

  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key.toLowerCase()] = val;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
    send(payload) {
      this.data = payload;
      return this;
    }
  };

  return { req, res };
}

async function runAllSecurityTests() {
  const { requireTenantAccess, requireRole, authenticateToken } = require('../middleware');
  const rateLimiter = require('../services/rateLimiter');

  // -------------------------------------------------------------
  // 1. MULTI-TENANT ISOLATION & IDOR PREVENTION
  // -------------------------------------------------------------
  await test('Tenant Isolation: Normal user cannot supply another schoolId in params/body', async () => {
    const { req, res } = createMockReqRes({
      params: { schoolId: 'school_attacker_target' },
      user: { id: 'user_1', schoolId: 'school_victim_home', role: 'ADMIN' }
    });

    let nextCalled = false;
    requireTenantAccess(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Middleware should not have called next()');
    assert.strictEqual(res.statusCode, 403, 'Should reject with 403');
    assert.strictEqual(res.data.code, 'TENANT_ACCESS_DENIED');
  });

  await test('Tenant Isolation: req.schoolId is strictly derived from verified JWT user token', async () => {
    const { req, res } = createMockReqRes({
      params: { schoolId: 'school_authorized' },
      user: { id: 'user_1', schoolId: 'school_authorized', role: 'ADMIN' }
    });

    let nextCalled = false;
    requireTenantAccess(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Middleware should allow valid tenant access');
    assert.strictEqual(req.schoolId, 'school_authorized', 'req.schoolId must match user.schoolId');
  });

  await test('Tenant Isolation: SUPER_ADMIN can manage target tenant schoolId', async () => {
    const { req, res } = createMockReqRes({
      params: { schoolId: 'school_target_branch' },
      user: { id: 'super_1', schoolId: null, role: 'SUPER_ADMIN' }
    });

    let nextCalled = false;
    requireTenantAccess(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.schoolId, 'school_target_branch');
  });

  // -------------------------------------------------------------
  // 2. BACKEND ROLE-BASED ACCESS CONTROL (RBAC)
  // -------------------------------------------------------------
  await test('RBAC Enforcement: Parent role is blocked from Admin endpoints', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'parent_1', schoolId: 'school_1', role: 'PARENT' }
    });

    const adminOnlyMiddleware = requireRole(['ADMIN', 'SUPER_ADMIN']);
    let nextCalled = false;
    adminOnlyMiddleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.data.code, 'FORBIDDEN');
  });

  await test('RBAC Enforcement: Staff role without authorization is blocked from SuperAdmin actions', async () => {
    const { req, res } = createMockReqRes({
      user: { id: 'staff_1', schoolId: 'school_1', role: 'STAFF' }
    });

    const superAdminOnly = requireRole(['SUPER_ADMIN']);
    let nextCalled = false;
    superAdminOnly(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 403);
  });

  // -------------------------------------------------------------
  // 3. IN-MEMORY RATE LIMITING
  // -------------------------------------------------------------
  await test('Rate Limiter: Blocks requests after exceeding maximum threshold', async () => {
    const limiter = rateLimiter.middleware({
      windowMs: 60 * 1000,
      max: 3,
      message: 'Rate limit exceeded',
      keyGenerator: () => 'test_ip_client_1'
    });

    let blocked = false;
    for (let i = 0; i < 5; i++) {
      const { req, res } = createMockReqRes();
      let nextCalled = false;
      limiter(req, res, () => { nextCalled = true; });
      if (i >= 3) {
        assert.strictEqual(res.statusCode, 429);
        assert.strictEqual(res.data.error, 'Rate limit exceeded');
        blocked = true;
      } else {
        assert.strictEqual(nextCalled, true);
      }
    }
    assert.strictEqual(blocked, true);
  });

  // -------------------------------------------------------------
  // 4. REAL PASSWORD RESET (CRYPTO HASH, NO ENUMERATION, ONE-TIME USE)
  // -------------------------------------------------------------
  await test('Password Reset: Generic message returned when email is not found (prevents user enumeration)', async () => {
    const mockPrisma = {
      user: {
        findUnique: async () => null
      }
    };

    const authRouter = require('../routes/auth');
    // Find forgot-password handler
    const forgotRoute = authRouter.stack.find(layer => layer.route && layer.route.path === '/forgot-password');
    assert(forgotRoute, 'Forgot password route must exist');

    const handler = forgotRoute.route.stack[forgotRoute.route.stack.length - 1].handle;
    const { req, res } = createMockReqRes({
      body: { email: 'nonexistent_user@example.com' },
      prisma: mockPrisma
    });

    await handler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.message, 'If this email is registered, password reset instructions have been sent.');
  });

  await test('Password Reset: Generates SHA-256 hash in DB, accepts raw token on reset, prevents token re-use', async () => {
    let savedTokenHash = null;
    let savedExpiresAt = null;
    let tokenUsed = false;
    let userPasswordUpdated = null;

    const mockUser = {
      id: 'usr_reset_1',
      email: 'student.parent@school.com',
      password: 'old_hashed_password'
    };

    const mockPrisma = {
      user: {
        findUnique: async ({ where }) => (where.email === mockUser.email ? mockUser : null),
        update: async ({ data }) => { userPasswordUpdated = data.password; }
      },
      passwordResetToken: {
        deleteMany: async () => { },
        create: async ({ data }) => {
          savedTokenHash = data.tokenHash;
          savedExpiresAt = data.expiresAt;
        },
        findUnique: async ({ where }) => {
          if (where.tokenHash === savedTokenHash) {
            return {
              id: 'tok_1',
              userId: mockUser.id,
              tokenHash: savedTokenHash,
              expiresAt: savedExpiresAt,
              usedAt: tokenUsed ? new Date() : null,
              user: mockUser
            };
          }
          return null;
        },
        update: async () => { tokenUsed = true; }
      },
      $transaction: async (fn) => fn(mockPrisma)
    };

    const authRouter = require('../routes/auth');
    const forgotHandler = authRouter.stack.find(l => l.route?.path === '/forgot-password').route.stack.slice(-1)[0].handle;
    const resetHandler = authRouter.stack.find(l => l.route?.path === '/reset-password').route.stack.slice(-1)[0].handle;

    // 1. Request forgot password
    process.env.NODE_ENV = 'test';
    const { req: req1, res: res1 } = createMockReqRes({
      body: { email: 'student.parent@school.com' },
      prisma: mockPrisma
    });
    await forgotHandler(req1, res1);

    assert.strictEqual(res1.statusCode, 200);
    const rawToken = res1.data.devResetToken;
    assert(rawToken, 'Dev reset token should be returned in test environment');
    assert(savedTokenHash, 'Token hash should be saved in DB');

    // Verify token stored is indeed the SHA-256 digest of rawToken, NOT the raw token
    const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    assert.strictEqual(savedTokenHash, expectedHash, 'Database must only store the SHA-256 hash');
    assert.notStrictEqual(rawToken, savedTokenHash, 'Raw token and hash must never be identical');

    // 2. Perform reset password with rawToken
    const { req: req2, res: res2 } = createMockReqRes({
      body: { token: rawToken, newPassword: 'NewSecurePassword123!' },
      prisma: mockPrisma
    });
    await resetHandler(req2, res2);

    assert.strictEqual(res2.statusCode, 200);
    assert(userPasswordUpdated, 'User password should have been updated');
    const isNewPasswordValid = await bcrypt.compare('NewSecurePassword123!', userPasswordUpdated);
    assert.strictEqual(isNewPasswordValid, true, 'Stored password must be valid bcrypt hash of new password');

    // 3. Try to re-use the token (must be rejected as already used)
    const { req: req3, res: res3 } = createMockReqRes({
      body: { token: rawToken, newPassword: 'AnotherPassword456!' },
      prisma: mockPrisma
    });
    await resetHandler(req3, res3);

    assert.strictEqual(res3.statusCode, 400, 'Re-using a token must be rejected with 400');
    assert.match(res3.data.error, /invalid, expired, or already used/i);
  });

  // -------------------------------------------------------------
  // 5. PAYMENT WEBHOOK CRYPTOGRAPHIC INTEGRITY & IDEMPOTENCY
  // -------------------------------------------------------------
  await test('Payment Webhook: Missing signature header is rejected with 401', async () => {
    const feeRouter = require('../routes/fees');
    const webhookHandler = feeRouter.stack.find(l => l.route?.path === '/webhook').route.stack[0].handle;

    const { req, res } = createMockReqRes({
      headers: {},
      body: { invoiceId: 'inv_101', status: 'PAID' }
    });

    await webhookHandler(req, res);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.data.error, /signature header missing/i);
  });

  await test('Payment Webhook: Tampered or invalid HMAC signature is rejected with 401', async () => {
    const feeRouter = require('../routes/fees');
    const webhookHandler = feeRouter.stack.find(l => l.route?.path === '/webhook').route.stack[0].handle;

    const payload = JSON.stringify({ invoiceId: 'inv_101', amount: 5000 });
    const forgedSignature = crypto.createHmac('sha256', 'wrong_secret').update(payload).digest('hex');

    const { req, res } = createMockReqRes({
      headers: { 'x-webhook-signature': forgedSignature },
      rawBody: Buffer.from(payload),
      body: JSON.parse(payload)
    });

    await webhookHandler(req, res);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.data.error, /invalid webhook signature/i);
  });

  await test('Payment Webhook: Valid HMAC signature updates invoice to PAID and records transactionId', async () => {
    const feeRouter = require('../routes/fees');
    const webhookHandler = feeRouter.stack.find(l => l.route?.path === '/webhook').route.stack[0].handle;

    let invoiceState = {
      id: 'inv_real_1',
      schoolId: 'school_main',
      status: 'PENDING',
      amount: 12000,
      paidAt: null,
      transactionId: null
    };

    const mockPrisma = {
      invoice: {
        findUnique: async () => invoiceState,
        update: async ({ data }) => {
          invoiceState = { ...invoiceState, ...data };
          return invoiceState;
        }
      }
    };

    const payload = JSON.stringify({
      invoiceId: 'inv_real_1',
      transactionId: 'txn_razorpay_998877'
    });
    const validSignature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');

    const { req, res } = createMockReqRes({
      headers: { 'x-webhook-signature': validSignature },
      rawBody: Buffer.from(payload),
      body: JSON.parse(payload),
      prisma: mockPrisma
    });

    await webhookHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(invoiceState.status, 'PAID');
    assert.strictEqual(invoiceState.transactionId, 'txn_razorpay_998877');
    assert(invoiceState.paidAt instanceof Date);
  });

  await test('Payment Webhook: Idempotency protection prevents duplicate updates on repeat webhook delivery', async () => {
    const feeRouter = require('../routes/fees');
    const webhookHandler = feeRouter.stack.find(l => l.route?.path === '/webhook').route.stack[0].handle;

    const alreadyPaidInvoice = {
      id: 'inv_already_paid_1',
      schoolId: 'school_main',
      status: 'PAID',
      amount: 12000,
      paidAt: new Date('2026-09-01T10:00:00Z'),
      transactionId: 'txn_existing_123'
    };

    let updateCalled = false;
    const mockPrisma = {
      invoice: {
        findUnique: async () => alreadyPaidInvoice,
        update: async () => { updateCalled = true; }
      }
    };

    const payload = JSON.stringify({
      invoiceId: 'inv_already_paid_1',
      transactionId: 'txn_existing_123'
    });
    const validSignature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');

    const { req, res } = createMockReqRes({
      headers: { 'x-webhook-signature': validSignature },
      rawBody: Buffer.from(payload),
      body: JSON.parse(payload),
      prisma: mockPrisma
    });

    await webhookHandler(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(updateCalled, false, 'Prisma update must NOT be called for already PAID invoice');
    assert.match(res.data.message, /already processed \(idempotent\)/i);
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n========================================');
  console.log(`📊 Security Test Results: ${passedTests}/${totalTests} Passed`);
  console.log('========================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runAllSecurityTests().catch(err => {
  console.error('Test runner encountered uncaught error:', err);
  process.exit(1);
});
