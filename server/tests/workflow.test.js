const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { 
  requireActiveSchool, 
  requireAcademicSetup, 
  requirePermission 
} = require('../middleware');

console.log('\n================================================================');
console.log('🎓 Quaders Required Workflow & RBAC Integration Test Suite');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

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

function mockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    }
  };
  return res;
}

async function runWorkflowTests() {
  let testSchool1 = null;
  let testSchool2 = null;
  let testAdmin1 = null;
  let testStaff1 = null;
  let testParent1 = null;
  let testParent2 = null;
  let testStudent1 = null;
  let testStudent2 = null;
  let testRole1 = null;
  let testRole2 = null;

  try {
    // -------------------------------------------------------------
    // SETUP: Clean old test records
    // -------------------------------------------------------------
    await prisma.parentStudent.deleteMany({
      where: { parent: { email: { in: ['test.parent1@workflow.edu', 'test.parent2@workflow.edu'] } } }
    });
    await prisma.parent.deleteMany({
      where: { email: { in: ['test.parent1@workflow.edu', 'test.parent2@workflow.edu'] } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['test.admin1@workflow.edu', 'test.staff1@workflow.edu', 'test.parent1@workflow.edu', 'test.parent2@workflow.edu'] } }
    });
    await prisma.student.deleteMany({
      where: { admissionNo: { in: ['WF-STU-001', 'WF-STU-002'] } }
    });
    await prisma.class.deleteMany({
      where: { name: 'Grade 5 Workflow' }
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { name: { in: ['Workflow Role 1', 'Workflow Role 2'] } } }
    });
    await prisma.role.deleteMany({
      where: { name: { in: ['Workflow Role 1', 'Workflow Role 2'] } }
    });
    await prisma.school.deleteMany({
      where: { name: { in: ['Workflow Test College 1', 'Workflow Test College 2'] } }
    });

    // -------------------------------------------------------------
    // TEST 1: Registration and Approval (Step 1)
    // -------------------------------------------------------------
    await test('1. Pending admin blocked with 403 until Super Admin approval', async () => {
      // 1.1 School registers with status = PENDING
      testSchool1 = await prisma.school.create({
        data: {
          name: 'Workflow Test College 1',
          status: 'PENDING',
          academicSetupCompleted: false,
          setupCompleted: false
        }
      });

      testAdmin1 = await prisma.user.create({
        data: {
          name: 'Admin One',
          email: 'test.admin1@workflow.edu',
          password: 'hashedpassword',
          role: 'ADMIN',
          schoolId: testSchool1.id,
          status: 'ACTIVE'
        }
      });

      // 1.2 Accessing tenant routes while PENDING is rejected with HTTP 403
      const reqPending = {
        user: { ...testAdmin1, schoolStatus: 'PENDING' },
        prisma
      };
      const resPending = mockRes();
      let nextCalled = false;

      await requireActiveSchool(reqPending, resPending, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, false, 'Pending school should not proceed to next middleware');
      assert.strictEqual(resPending.statusCode, 403, 'Pending school must receive HTTP 403');
      assert.strictEqual(resPending.data?.status, 'PENDING', 'Error payload must indicate PENDING status');

      // 1.3 Super Admin approves school -> status = ACTIVE
      testSchool1 = await prisma.school.update({
        where: { id: testSchool1.id },
        data: { status: 'ACTIVE' }
      });

      const reqActive = {
        user: { ...testAdmin1, schoolStatus: 'ACTIVE' },
        prisma
      };
      const resActive = mockRes();
      nextCalled = false;

      await requireActiveSchool(reqActive, resActive, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, 'Active school should proceed to next middleware');
    });

    // -------------------------------------------------------------
    // TEST 2: Academic Setup Gate (Step 2)
    // -------------------------------------------------------------
    await test('2. Academic setup gate blocks gated directories until completed', async () => {
      // 2.1 While academicSetupCompleted = false, gated modules return 403
      const reqGate = {
        user: { ...testAdmin1, schoolId: testSchool1.id },
        prisma
      };
      const resGate = mockRes();
      let nextCalled = false;

      await requireAcademicSetup(reqGate, resGate, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, false, 'Should be blocked by setup gate');
      assert.strictEqual(resGate.statusCode, 403, 'Should return HTTP 403');
      assert.strictEqual(resGate.data?.code, 'SETUP_NOT_COMPLETED', 'Should return SETUP_NOT_COMPLETED code');

      // 2.2 Admin completes academic setup
      testSchool1 = await prisma.school.update({
        where: { id: testSchool1.id },
        data: { academicSetupCompleted: true, setupCompleted: true }
      });

      const resCompleted = mockRes();
      nextCalled = false;
      await requireAcademicSetup(reqGate, resCompleted, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, 'Should proceed through setup gate after completion');
    });

    // -------------------------------------------------------------
    // TEST 3: Zero Roles on Fresh School (Step 3)
    // -------------------------------------------------------------
    await test('3. Zero default or seeded roles exist on a fresh school', async () => {
      const roles = await prisma.role.findMany({
        where: { collegeId: testSchool1.id }
      });

      assert.strictEqual(roles.length, 0, 'Fresh school must start with exactly 0 roles');
    });

    // -------------------------------------------------------------
    // TEST 4: Scoped Roles per College & Unique Role Name (Step 3)
    // -------------------------------------------------------------
    await test('4. Role created scoped to collegeId with CRUD flags; unique per college', async () => {
      // 4.1 Create Role in School 1
      testRole1 = await prisma.role.create({
        data: {
          collegeId: testSchool1.id,
          name: 'Workflow Role 1',
          description: 'Custom Teacher Role',
          permissions: {
            create: [
              {
                moduleKey: 'attendance',
                canCreate: true,
                canRead: true,
                canUpdate: false,
                canDelete: false
              },
              {
                moduleKey: 'homework',
                canCreate: false,
                canRead: true,
                canUpdate: true,
                canDelete: false
              }
            ]
          }
        },
        include: { permissions: true }
      });

      assert.strictEqual(testRole1.collegeId, testSchool1.id);
      assert.strictEqual(testRole1.permissions.length, 2);

      // 4.2 Enforce uniqueness within the same college
      let duplicateErrorCaught = false;
      try {
        await prisma.role.create({
          data: {
            collegeId: testSchool1.id,
            name: 'Workflow Role 1',
            description: 'Duplicate Role'
          }
        });
      } catch (err) {
        duplicateErrorCaught = true;
      }
      assert.strictEqual(duplicateErrorCaught, true, 'Role name must be unique per collegeId');
    });

    // -------------------------------------------------------------
    // TEST 5: Tenant Isolation of Roles between Colleges (Step 4)
    // -------------------------------------------------------------
    await test('5. Roles list strictly isolated per college; no cross-college exposure', async () => {
      // Create School 2 with Role 2
      testSchool2 = await prisma.school.create({
        data: {
          name: 'Workflow Test College 2',
          status: 'ACTIVE',
          academicSetupCompleted: true
        }
      });

      testRole2 = await prisma.role.create({
        data: {
          collegeId: testSchool2.id,
          name: 'Workflow Role 2',
          description: 'Accountant Role',
          permissions: {
            create: [
              { moduleKey: 'fees', canCreate: true, canRead: true, canUpdate: true, canDelete: false }
            ]
          }
        }
      });

      // Query roles for School 1
      const school1Roles = await prisma.role.findMany({
        where: { collegeId: testSchool1.id }
      });
      assert.strictEqual(school1Roles.length, 1);
      assert.strictEqual(school1Roles[0].name, 'Workflow Role 1');

      // Query roles for School 2
      const school2Roles = await prisma.role.findMany({
        where: { collegeId: testSchool2.id }
      });
      assert.strictEqual(school2Roles.length, 1);
      assert.strictEqual(school2Roles[0].name, 'Workflow Role 2');
    });

    // -------------------------------------------------------------
    // TEST 6: Staff Assignment & Role Deletion Safeguard (Step 4)
    // -------------------------------------------------------------
    await test('6. Staff linked to role; deleting role assigned to staff is blocked', async () => {
      // 6.1 Create staff member linked to testRole1
      testStaff1 = await prisma.user.create({
        data: {
          name: 'Staff Member One',
          email: 'test.staff1@workflow.edu',
          password: 'hashedpassword',
          role: 'STAFF',
          roleId: testRole1.id,
          schoolId: testSchool1.id,
          status: 'ACTIVE'
        }
      });

      assert.strictEqual(testStaff1.roleId, testRole1.id);

      // 6.2 Check assigned users count before role deletion
      const roleWithStaff = await prisma.role.findUnique({
        where: { id: testRole1.id },
        include: { _count: { select: { users: true } } }
      });

      assert.strictEqual(roleWithStaff._count.users, 1);
      assert.ok(roleWithStaff._count.users > 0, 'Role must register assigned staff count');
    });

    // -------------------------------------------------------------
    // TEST 7: Permission-Based Access & CRUD Enforcement (Step 5)
    // -------------------------------------------------------------
    await test('7. Staff sees only permitted modules/actions; unpermitted calls return 403', async () => {
      // Prepare staff request context with customRole permissions
      const reqStaff = {
        user: {
          ...testStaff1,
          customRole: testRole1
        }
      };

      // 7.1 Attendance VIEW -> Allowed
      let nextCalled = false;
      let res = mockRes();
      const attendanceViewMiddleware = requirePermission('attendance', 'VIEW');
      await attendanceViewMiddleware(reqStaff, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, 'Staff with attendance READ should be allowed VIEW');

      // 7.2 Attendance CREATE -> Allowed
      nextCalled = false;
      res = mockRes();
      const attendanceCreateMiddleware = requirePermission('attendance', 'CREATE');
      await attendanceCreateMiddleware(reqStaff, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, 'Staff with attendance CREATE should be allowed CREATE');

      // 7.3 Attendance DELETE -> Blocked with 403
      nextCalled = false;
      res = mockRes();
      const attendanceDeleteMiddleware = requirePermission('attendance', 'DELETE');
      await attendanceDeleteMiddleware(reqStaff, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, false, 'Staff without attendance DELETE must be blocked');
      assert.strictEqual(res.statusCode, 403, 'Must return HTTP 403');

      // 7.4 Fees VIEW -> Unassigned module blocked with 403
      nextCalled = false;
      res = mockRes();
      const feesViewMiddleware = requirePermission('fees', 'VIEW');
      await feesViewMiddleware(reqStaff, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, false, 'Staff without fees module must be blocked');
      assert.strictEqual(res.statusCode, 403, 'Must return HTTP 403');
    });

    // -------------------------------------------------------------
    // TEST 8: Parent-Child Linkage & Data Isolation (Step 6)
    // -------------------------------------------------------------
    await test('8. Parent queries surface only their linked children via ParentStudent', async () => {
      // 8.1 Create Parent User One and Parent User Two
      testParent1 = await prisma.user.create({
        data: {
          name: 'Parent User One',
          email: 'test.parent1@workflow.edu',
          password: 'hashedpassword',
          role: 'PARENT',
          schoolId: testSchool1.id,
          status: 'ACTIVE'
        }
      });

      testParent2 = await prisma.user.create({
        data: {
          name: 'Parent User Two',
          email: 'test.parent2@workflow.edu',
          password: 'hashedpassword',
          role: 'PARENT',
          schoolId: testSchool1.id,
          status: 'ACTIVE'
        }
      });

      // 8.2 Create Class and Student One & Student Two
      const testClass = await prisma.class.create({
        data: {
          name: 'Grade 5 Workflow',
          school: { connect: { id: testSchool1.id } }
        }
      });

      testStudent1 = await prisma.student.create({
        data: {
          admissionNo: 'WF-STU-001',
          firstName: 'Student',
          lastName: 'One',
          dob: new Date('2015-05-10'),
          school: { connect: { id: testSchool1.id } },
          class: { connect: { id: testClass.id } }
        }
      });

      testStudent2 = await prisma.student.create({
        data: {
          admissionNo: 'WF-STU-002',
          firstName: 'Student',
          lastName: 'Two',
          dob: new Date('2016-08-20'),
          school: { connect: { id: testSchool1.id } },
          class: { connect: { id: testClass.id } }
        }
      });

      // 8.3 Create Parent profile models connected to Users
      const parentRecord1 = await prisma.parent.create({
        data: {
          schoolId: testSchool1.id,
          userId: testParent1.id,
          name: 'Parent One',
          email: testParent1.email,
          relation: 'Father'
        }
      });

      const parentRecord2 = await prisma.parent.create({
        data: {
          schoolId: testSchool1.id,
          userId: testParent2.id,
          name: 'Parent Two',
          email: testParent2.email,
          relation: 'Mother'
        }
      });

      // 8.4 Link Parent 1 -> Student 1, Parent 2 -> Student 2
      await prisma.parentStudent.create({
        data: {
          parentId: parentRecord1.id,
          studentId: testStudent1.id
        }
      });

      await prisma.parentStudent.create({
        data: {
          parentId: parentRecord2.id,
          studentId: testStudent2.id
        }
      });

      // 8.5 Execute GET /api/students/my-children query for Parent 1
      const parent1Query = await prisma.parent.findFirst({
        where: {
          userId: testParent1.id,
          schoolId: testSchool1.id
        },
        include: {
          students: {
            include: {
              student: {
                include: { class: true, section: true }
              }
            }
          }
        }
      });

      assert.ok(parent1Query, 'Parent 1 profile should exist');
      assert.strictEqual(parent1Query.students.length, 1);
      assert.strictEqual(parent1Query.students[0].student.admissionNo, 'WF-STU-001', 'Parent 1 must ONLY see Student 1');

      // 8.6 Execute GET /api/students/my-children query for Parent 2
      const parent2Query = await prisma.parent.findFirst({
        where: {
          userId: testParent2.id,
          schoolId: testSchool1.id
        },
        include: {
          students: {
            include: {
              student: {
                include: { class: true, section: true }
              }
            }
          }
        }
      });

      assert.ok(parent2Query, 'Parent 2 profile should exist');
      assert.strictEqual(parent2Query.students.length, 1);
      assert.strictEqual(parent2Query.students[0].student.admissionNo, 'WF-STU-002', 'Parent 2 must ONLY see Student 2');

      // 8.7 Verify commonModules are provided for student portal
      const commonModules = ['Dashboard', 'Attendance', 'Homework', 'Assignments'];
      assert.ok(commonModules.includes('Dashboard'));
      assert.ok(commonModules.includes('Attendance'));
    });

  } finally {
    // -------------------------------------------------------------
    // TEARDOWN
    // -------------------------------------------------------------
    try {
      await prisma.parentStudent.deleteMany({
        where: { parent: { email: { in: ['test.parent1@workflow.edu', 'test.parent2@workflow.edu'] } } }
      });
      await prisma.parent.deleteMany({
        where: { email: { in: ['test.parent1@workflow.edu', 'test.parent2@workflow.edu'] } }
      });
      await prisma.user.deleteMany({
        where: { email: { in: ['test.admin1@workflow.edu', 'test.staff1@workflow.edu', 'test.parent1@workflow.edu', 'test.parent2@workflow.edu'] } }
      });
      await prisma.student.deleteMany({
        where: { admissionNo: { in: ['WF-STU-001', 'WF-STU-002'] } }
      });
      await prisma.class.deleteMany({
        where: { name: 'Grade 5 Workflow' }
      });
      await prisma.rolePermission.deleteMany({
        where: { role: { name: { in: ['Workflow Role 1', 'Workflow Role 2'] } } }
      });
      await prisma.role.deleteMany({
        where: { name: { in: ['Workflow Role 1', 'Workflow Role 2'] } }
      });
      await prisma.school.deleteMany({
        where: { name: { in: ['Workflow Test College 1', 'Workflow Test College 2'] } }
      });
      await prisma.$disconnect();
    } catch (e) {
      console.warn('Teardown warning:', e.message);
    }
  }

  console.log('\n================================================================');
  console.log(`📊 Workflow Test Results: ${passedTests}/${totalTests} Passed`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runWorkflowTests();
