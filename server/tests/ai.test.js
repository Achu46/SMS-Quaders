/**
 * Automated Test Suite for AI Assistant, Quota Engine & Controlled Tools
 * Run with: node tests/ai.test.js
 */

const assert = require('assert');
const aiQuotaService = require('../services/aiQuotaService');
const aiToolRegistry = require('../services/ai/aiToolRegistry');
const IAiProvider = require('../services/ai/aiProvider');
const AI_CONFIG = require('../config/aiConfig');

// Mock in-memory database representation to simulate Prisma for isolated deterministic testing
class MockPrisma {
  constructor() {
    this.schools = [];
    this.schoolDocuments = [];
    this.aiUsages = [];
    this.aiAuditLogs = [];
    this.students = [];
    this.attendances = [];
    this.attendanceEntries = [];
    this.invoices = [];
    this.feeStructures = [];
    this.classes = [];
    this.users = [];
  }

  get school() {
    return {
      findUnique: async ({ where }) => this.schools.find(s => s.id === where.id) || null,
      findFirst: async ({ where }) => this.schools.find(s => s.id === where.id) || null,
      findMany: async ({ where = {} } = {}) => {
        return this.schools.filter(s => !where.status || s.status === where.status).map(s => ({
          ...s,
          _count: { students: 0, classes: 0, users: 0 }
        }));
      },
      count: async ({ where = {} } = {}) => {
        return this.schools.filter(s => !where.status || s.status === where.status).length;
      }
    };
  }

  get schoolDocument() {
    return {
      findFirst: async ({ where }) => {
        return this.schoolDocuments.find(d => 
          d.schoolId === where.schoolId && 
          d.collection === where.collection
        ) || null;
      },
      findMany: async ({ where }) => {
        return this.schoolDocuments.filter(d => 
          d.schoolId === where.schoolId && 
          d.collection === where.collection
        );
      }
    };
  }

  get aiUsage() {
    return {
      findUnique: async ({ where }) => {
        const query = where.schoolId_usageDate;
        return this.aiUsages.find(u => u.schoolId === query.schoolId && u.usageDate === query.usageDate) || null;
      },
      create: async ({ data }) => {
        const record = { id: `usage-${Date.now()}-${Math.random()}`, ...data, requestCount: data.requestCount || 0 };
        this.aiUsages.push(record);
        return record;
      },
      update: async ({ where, data }) => {
        const record = this.aiUsages.find(u => u.id === where.id);
        if (!record) throw new Error('Usage record not found');
        if (data.requestCount?.increment) {
          record.requestCount += data.requestCount.increment;
        } else if (data.requestCount?.decrement) {
          record.requestCount -= data.requestCount.decrement;
        } else if (typeof data.requestCount === 'number') {
          record.requestCount = data.requestCount;
        }
        if (data.plan) record.plan = data.plan;
        return record;
      }
    };
  }

  get aiAuditLog() {
    return {
      create: async ({ data }) => {
        const log = { id: `log-${Date.now()}`, ...data, createdAt: new Date() };
        this.aiAuditLogs.push(log);
        return log;
      },
      findMany: async ({ where }) => {
        return this.aiAuditLogs.filter(l => !where.schoolId || l.schoolId === where.schoolId);
      }
    };
  }

  get student() {
    return {
      findFirst: async ({ where }) => {
        return this.students.find(s => {
          if (s.schoolId !== where.schoolId) return false;
          if (where.id && s.id !== where.id) return false;
          if (where.admissionNo && s.admissionNo !== where.admissionNo) return false;
          return true;
        }) || null;
      },
      findMany: async ({ where }) => {
        return this.students.filter(s => {
          if (s.schoolId !== where.schoolId) return false;
          if (where.classId && s.classId !== where.classId) return false;
          if (where.OR && Array.isArray(where.OR)) {
            const matchesOr = where.OR.some(clause => {
              if (clause.firstName?.contains) {
                return (s.firstName || '').toLowerCase().includes(clause.firstName.contains.toLowerCase());
              }
              if (clause.lastName?.contains) {
                return (s.lastName || '').toLowerCase().includes(clause.lastName.contains.toLowerCase());
              }
              if (clause.admissionNo?.contains) {
                return (s.admissionNo || '').toLowerCase().includes(clause.admissionNo.contains.toLowerCase());
              }
              return false;
            });
            if (!matchesOr) return false;
          }
          return true;
        });
      }
    };
  }

  get attendance() {
    return {
      findFirst: async ({ where }) => {
        return this.attendances.find(a => 
          a.schoolId === where.schoolId && 
          a.classId === where.classId && 
          a.date === where.date
        ) || null;
      },
      findMany: async ({ where }) => {
        return this.attendances.filter(a => a.schoolId === where.schoolId && (!where.date || a.date === where.date));
      }
    };
  }

  get invoice() {
    return {
      findMany: async ({ where }) => {
        return this.invoices.filter(i => {
          if (i.schoolId !== where.schoolId) return false;
          if (where.studentId && i.studentId !== where.studentId) return false;
          if (where.status && i.status !== where.status) return false;
          return true;
        });
      }
    };
  }

  get class() {
    return {
      findFirst: async ({ where }) => {
        return this.classes.find(c => c.schoolId === where.schoolId) || null;
      }
    };
  }

  get user() {
    return {
      findFirst: async ({ where }) => {
        return this.users.find(u => u.schoolId === where.schoolId) || null;
      },
      findMany: async ({ where }) => {
        return this.users.filter(u => u.schoolId === where.schoolId);
      }
    };
  }

  get parentStudent() {
    return {
      findFirst: async () => null,
      findMany: async () => []
    };
  }

  async $transaction(fn) {
    // Simulate database isolation lock with serial mutex queue
    if (!this._txMutex) this._txMutex = Promise.resolve();
    const currentMutex = this._txMutex;
    let release;
    this._txMutex = new Promise(resolve => { release = resolve; });

    await currentMutex;
    try {
      return await fn(this);
    } finally {
      release();
    }
  }
}

// Mock AI Provider for deterministic test assertions
class MockAiProvider extends IAiProvider {
  constructor(cannedResponse) {
    super();
    this.cannedResponse = cannedResponse;
    this.calls = [];
  }

  async generateCompletion(options) {
    this.calls.push(options);
    if (typeof this.cannedResponse === 'function') {
      return this.cannedResponse(options);
    }
    return this.cannedResponse || {
      text: 'Mocked AI answer',
      toolCalls: [],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: 'test-model'
    };
  }
}

// --- Test Runner ---

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 Starting AI Assistant Test Suite');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  // 1. Quota: Free Plan (1 request/day limit)
  await test('Free Plan allows 1st request and blocks 2nd request', async () => {
    const mockPrisma = new MockPrisma();
    const schoolId = 'school-free-1';

    // 1st request -> should allow
    const firstReq = await aiQuotaService.checkAndReserveQuota(schoolId, mockPrisma);
    assert.strictEqual(firstReq.allowed, true, 'First request on free plan must be allowed');
    assert.strictEqual(firstReq.usage.usedToday, 1);
    assert.strictEqual(firstReq.usage.remaining, 0);

    // 2nd request -> should block
    const secondReq = await aiQuotaService.checkAndReserveQuota(schoolId, mockPrisma);
    assert.strictEqual(secondReq.allowed, false, 'Second request on free plan must be blocked');
    assert.strictEqual(secondReq.usage.usedToday, 1);
    assert.strictEqual(secondReq.usage.remaining, 0);
  });

  // 2. Quota: Plan Tiers (Basic: 5, Standard: 10, Enterprise: 30)
  await test('Plan Quotas are accurately enforced (Basic=5, Standard=10, Enterprise=30)', async () => {
    const mockPrisma = new MockPrisma();

    // Basic School
    mockPrisma.schoolDocuments.push({
      schoolId: 'school-basic',
      collection: 'settings',
      data: { plan: 'BASIC' }
    });

    const basicUsageStatus = await aiQuotaService.getUsageStatus('school-basic', mockPrisma);
    assert.strictEqual(basicUsageStatus.limit, 5, 'Basic plan should have 5 requests limit');

    // Standard School
    mockPrisma.schoolDocuments.push({
      schoolId: 'school-standard',
      collection: 'settings',
      data: { plan: 'STANDARD' }
    });
    const standardUsageStatus = await aiQuotaService.getUsageStatus('school-standard', mockPrisma);
    assert.strictEqual(standardUsageStatus.limit, 10, 'Standard plan should have 10 requests limit');

    // Enterprise School
    mockPrisma.schoolDocuments.push({
      schoolId: 'school-enterprise',
      collection: 'settings',
      data: { plan: 'ENTERPRISE' }
    });
    const enterpriseUsageStatus = await aiQuotaService.getUsageStatus('school-enterprise', mockPrisma);
    assert.strictEqual(enterpriseUsageStatus.limit, 30, 'Enterprise plan should have 30 requests limit');
  });

  // 3. Quota: Unused requests do NOT carry over
  await test('Unused requests do NOT carry over to new days', async () => {
    const mockPrisma = new MockPrisma();
    const schoolId = 'school-carryover-test';

    // Mock an older usage record from yesterday with 0 used
    mockPrisma.aiUsages.push({
      id: 'old-1',
      schoolId,
      plan: 'BASIC',
      usageDate: '2026-08-20',
      requestCount: 2
    });

    // Query status for today -> should start fresh at 0 used today
    const todayStatus = await aiQuotaService.getUsageStatus(schoolId, mockPrisma);
    assert.strictEqual(todayStatus.usedToday, 0, 'Today starts at 0 used');
    assert.strictEqual(todayStatus.remaining, 1, 'Today has standard limit without accumulating past unused days');
  });

  // 4. Concurrency: Atomic quota deduction
  await test('Concurrent requests cannot bypass quota limits', async () => {
    const mockPrisma = new MockPrisma();
    const schoolId = 'school-concurrent';

    // Free plan allows only 1 request. Fire 5 simultaneous requests:
    const results = await Promise.all([
      aiQuotaService.checkAndReserveQuota(schoolId, mockPrisma),
      aiQuotaService.checkAndReserveQuota(schoolId, mockPrisma),
      aiQuotaService.checkAndReserveQuota(schoolId, mockPrisma),
      aiQuotaService.checkAndReserveQuota(schoolId, mockPrisma),
      aiQuotaService.checkAndReserveQuota(schoolId, mockPrisma)
    ]);

    const allowedCount = results.filter(r => r.allowed).length;
    const blockedCount = results.filter(r => !r.allowed).length;

    assert.strictEqual(allowedCount, 1, 'Exactly 1 concurrent request must be granted');
    assert.strictEqual(blockedCount, 4, 'Remaining 4 requests must be blocked');
  });

  // 5. Security & Tenant Isolation: School A cannot see School B data
  await test('Tenant Isolation: School A student query cannot access School B student records', async () => {
    const mockPrisma = new MockPrisma();
    
    // Seed Student in School A and School B
    mockPrisma.students.push(
      { id: 's1', schoolId: 'school-A', firstName: 'Alice', lastName: 'A', admissionNo: '101', status: 'ACTIVE' },
      { id: 's2', schoolId: 'school-B', firstName: 'Bob', lastName: 'B', admissionNo: '102', status: 'ACTIVE' }
    );

    const contextSchoolA = {
      schoolId: 'school-A',
      user: { id: 'admin-A', role: 'ADMIN' },
      prisma: mockPrisma
    };

    const searchTool = aiToolRegistry.tools.get('search_student');
    assert(searchTool, 'search_student tool must exist');

    // Search from School A context
    const result = await searchTool.handler({ query: 'Bob' }, contextSchoolA);
    assert.strictEqual(result.count, 0, 'School A user must NOT see Bob from School B');

    const resultAlice = await searchTool.handler({ query: 'Alice' }, contextSchoolA);
    assert.strictEqual(resultAlice.count, 1, 'School A user should see Alice from School A');
    assert.strictEqual(resultAlice.students[0].name, 'Alice A');
  });

  // 6. Security: AI Tools are strictly read-only and protect against arbitrary SQL
  await test('AI tool registry only contains verified read-only tools (no delete/modify/sql tools)', () => {
    const tools = Array.from(aiToolRegistry.tools.keys());
    
    const forbiddenTools = ['execute_any_sql', 'delete_student', 'delete_payment', 'modify_marks', 'issue_refund', 'bulk_send_message'];
    forbiddenTools.forEach(badTool => {
      assert.strictEqual(tools.includes(badTool), false, `Forbidden dangerous tool "${badTool}" must not be registered`);
    });

    const expectedTools = ['search_student', 'get_student_attendance', 'get_attendance_summary', 'get_pending_fees', 'get_class_performance'];
    expectedTools.forEach(goodTool => {
      assert.strictEqual(tools.includes(goodTool), true, `Expected tool "${goodTool}" must be registered`);
    });
  });

  // 7. Data Privacy: Passwords and sensitive secrets are never returned in student or teacher tools
  await test('Data Minimization: Sensitive password hashes and secret tokens are stripped from tools', async () => {
    const mockPrisma = new MockPrisma();
    mockPrisma.users.push({
      id: 'u1',
      schoolId: 'school-A',
      name: 'John Teacher',
      email: 'john@school.com',
      password: 'hashed_password_123',
      role: 'STAFF',
      classAssignments: []
    });

    const context = {
      schoolId: 'school-A',
      user: { id: 'parent-1', role: 'PARENT' },
      prisma: mockPrisma
    };

    const teacherTool = aiToolRegistry.tools.get('get_teacher');
    const result = await teacherTool.handler({ name: 'John' }, context);

    assert(result.teachers && result.teachers.length > 0);
    const teacherData = result.teachers[0];
    assert.strictEqual(teacherData.password, undefined, 'Password must never be exposed in tool output');
    assert.strictEqual(teacherData.email, undefined, 'Staff private email should not be exposed to parents');
  });

  // 8. Rollback Quota on Catastrophic Failure
  await test('Rollback Quota restores daily count if an unexpected error occurs', async () => {
    const mockPrisma = new MockPrisma();
    const schoolId = 'school-rollback';

    // Reserve 1 quota
    const res = await aiQuotaService.checkAndReserveQuota(schoolId, mockPrisma);
    assert.strictEqual(res.usage.usedToday, 1);

    // Rollback
    await aiQuotaService.rollbackQuota(schoolId, mockPrisma);

    // Verify usage is 0 again
    const status = await aiQuotaService.getUsageStatus(schoolId, mockPrisma);
    assert.strictEqual(status.usedToday, 0, 'Used count must decrement back to 0 on rollback');
  });

  // 9. Full Orchestration: AI decides to call ERP tool and returns formatted answer
  await test('AI Tool Calling: User asks for pending fees, AI calls get_pending_fees tool and formats reply', async () => {
    const mockPrisma = new MockPrisma();
    const schoolId = 'school-orchestration-1';

    mockPrisma.schools.push({ id: schoolId, name: 'St. Mary High School', board: 'CBSE' });
    mockPrisma.invoices.push({
      id: 'inv-1',
      schoolId,
      studentId: 'stud-1',
      status: 'PENDING',
      amount: 1500,
      dueDate: new Date('2026-09-15'),
      student: { firstName: 'Sam', lastName: 'Wilson', admissionNo: 'ADM-99' },
      feeStructure: { name: 'Tuition Fee' }
    });

    let turnCount = 0;
    const mockProvider = new MockAiProvider((options) => {
      turnCount++;
      if (turnCount === 1) {
        // First turn: AI emits tool call
        return {
          text: '',
          rawMessage: {
            tool_calls: [{
              id: 'call_abc123',
              type: 'function',
              function: {
                name: 'get_pending_fees',
                arguments: JSON.stringify({ limit: 10 })
              }
            }]
          },
          toolCalls: [{
            id: 'call_abc123',
            name: 'get_pending_fees',
            arguments: { limit: 10 }
          }],
          usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 },
          model: 'meta-llama/llama-3.3-70b-instruct'
        };
      } else {
        // Second turn: AI receives tool result and produces final answer
        return {
          text: 'There is 1 student with pending fees: **Sam Wilson** (ADM-99) has a pending Tuition Fee of **₹1,500**.',
          toolCalls: [],
          usage: { promptTokens: 80, completionTokens: 30, totalTokens: 110 },
          model: 'meta-llama/llama-3.3-70b-instruct'
        };
      }
    });

    const customAiService = new (require('../services/ai/aiService').constructor)(mockProvider);

    const result = await customAiService.processChat({
      messages: [{ role: 'user', content: 'Which students have pending fees?' }],
      schoolId,
      user: { id: 'user-admin', role: 'ADMIN', name: 'Principal Jane' },
      prisma: mockPrisma
    });

    assert.strictEqual(result.toolsUsed.includes('get_pending_fees'), true, 'get_pending_fees tool must be logged as used');
    assert(result.reply.includes('Sam Wilson'), 'Reply must include student name returned by tool');
    assert(result.reply.includes('1,500'), 'Reply must include amount returned by tool');
  });

  // 10. RBAC: Staff without fee permissions calling restricted tool gets rejected
  await test('RBAC: Staff account without fee permissions is blocked from executing fee tools', async () => {
    const mockPrisma = new MockPrisma();
    const staffContext = {
      schoolId: 'school-rbac',
      user: {
        id: 'staff-1',
        role: 'STAFF',
        staffRole: {
          name: 'Teacher',
          permissions: { attendance: { view: true }, students: { view: true } } // NO fees permission
        }
      },
      prisma: mockPrisma
    };

    const feeToolExec = await aiToolRegistry.executeTool('get_pending_fees', {}, staffContext);
    assert.strictEqual(feeToolExec.success, false, 'Execution must fail for unauthorized staff');
    assert(feeToolExec.error.includes('Permission Denied'), 'Error must specify permission denied');
  });

  // 11. Graceful AI Provider Failure
  await test('Graceful AI Provider Outage handling without crashing the server', async () => {
    const mockPrisma = new MockPrisma();
    const failingProvider = new MockAiProvider(() => {
      const err = new Error('OpenRouter 503 Service Unavailable');
      err.code = 'PROVIDER_ERROR';
      throw err;
    });

    const failingAiService = new (require('../services/ai/aiService').constructor)(failingProvider);

    let threw = false;
    try {
      await failingAiService.processChat({
        messages: [{ role: 'user', content: 'Hello' }],
        schoolId: 'school-fail-test',
        user: { id: 'u1', role: 'ADMIN' },
        prisma: mockPrisma
      });
    } catch (err) {
      threw = true;
      assert.strictEqual(err.code, 'PROVIDER_ERROR');
    }
    assert.strictEqual(threw, true, 'Service must reject gracefully on provider outage');
  });

  // 12. Super Admin: Always Unlimited AI Chat
  await test('Super Admin: Grants unlimited AI requests regardless of school plan tier', async () => {
    const mockPrisma = new MockPrisma();
    const superAdminUser = { id: 'super-1', role: 'SUPER_ADMIN', name: 'Platform Admin' };

    // Fire 50 requests in a row
    for (let i = 0; i < 50; i++) {
      const quotaCheck = await aiQuotaService.checkAndReserveQuota('school-free', mockPrisma, superAdminUser);
      assert.strictEqual(quotaCheck.allowed, true, `Super admin request #${i + 1} must be allowed`);
      assert.strictEqual(quotaCheck.usage.limit, 'Unlimited');
      assert.strictEqual(quotaCheck.usage.remaining, 'Unlimited');
      assert.strictEqual(quotaCheck.usage.isUnlimited, true);
    }

    const status = await aiQuotaService.getUsageStatus('school-free', mockPrisma, superAdminUser);
    assert.strictEqual(status.isUnlimited, true);
    assert.strictEqual(status.limit, 'Unlimited');
  });

  // 13. Super Admin: Query registered schools overview
  await test('School Registration Tool: Super Admin can query registered schools and count', async () => {
    const mockPrisma = new MockPrisma();
    mockPrisma.schools.push(
      { id: 'sch-1', name: 'Oakridge International', status: 'ACTIVE', board: 'CBSE' },
      { id: 'sch-2', name: 'Greenwood High', status: 'PENDING', board: 'ICSE' }
    );

    const superAdminContext = {
      user: { id: 'super-1', role: 'SUPER_ADMIN' },
      prisma: mockPrisma
    };

    const overviewTool = aiToolRegistry.tools.get('get_schools_overview');
    assert(overviewTool, 'get_schools_overview tool must exist');

    const result = await overviewTool.handler({ limit: 10 }, superAdminContext);
    assert.strictEqual(result.totalSchoolsRegistered, 2, 'Must report 2 registered schools');
    assert.strictEqual(result.statusBreakdown.activeSchools, 1);
    assert.strictEqual(result.statusBreakdown.pendingApprovalSchools, 1);
    assert.strictEqual(result.schools.length, 2);
  });

  console.log('\n========================================');
  console.log(`📊 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
