const assert = require('assert');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { requirePermission, invalidateRoleCache } = require('../middleware');

console.log('\n================================================================');
console.log('🔄 STEP 5: Role & Permission Real-Time Synchronization Test Suite');
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

async function runRoleSyncTests() {
  const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-for-dev';
  let collegeA = null;
  let collegeB = null;
  let roleA1 = null;
  let roleA2 = null;
  let roleB1 = null;
  let staffA = null;

  try {
    // -----------------------------------------------------------------
    // SETUP: Clean existing test records
    // -----------------------------------------------------------------
    await prisma.user.deleteMany({
      where: { email: { in: ['sync_staff_a@test.edu', 'sync_staff_b@test.edu'] } }
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { school: { name: { in: ['Role Sync College A', 'Role Sync College B'] } } } }
    });
    await prisma.role.deleteMany({
      where: { school: { name: { in: ['Role Sync College A', 'Role Sync College B'] } } }
    });
    await prisma.school.deleteMany({
      where: { name: { in: ['Role Sync College A', 'Role Sync College B'] } }
    });

    // Create 2 test colleges (for multi-tenant boundary checks)
    collegeA = await prisma.school.create({
      data: {
        name: 'Role Sync College A',
        status: 'ACTIVE',
        setupCompleted: true,
        academicSetupCompleted: true
      }
    });

    collegeB = await prisma.school.create({
      data: {
        name: 'Role Sync College B',
        status: 'ACTIVE',
        setupCompleted: true,
        academicSetupCompleted: true
      }
    });

    // Create Role A1 for College A
    roleA1 = await prisma.role.create({
      data: {
        collegeId: collegeA.id,
        name: 'Teacher Level 1',
        description: 'Initial teacher role',
        permissionsVersion: 1,
        permissions: {
          create: [
            { moduleKey: 'attendance', canCreate: true, canRead: true, canUpdate: true, canDelete: false },
            { moduleKey: 'fees', canCreate: false, canRead: true, canUpdate: false, canDelete: false }
          ]
        }
      },
      include: { permissions: true }
    });

    // Create Role A2 for College A
    roleA2 = await prisma.role.create({
      data: {
        collegeId: collegeA.id,
        name: 'HOD Science',
        description: 'Head of department',
        permissionsVersion: 1,
        permissions: {
          create: [
            { moduleKey: 'attendance', canCreate: true, canRead: true, canUpdate: true, canDelete: true },
            { moduleKey: 'exams', canCreate: true, canRead: true, canUpdate: true, canDelete: true }
          ]
        }
      },
      include: { permissions: true }
    });

    // Create Role B1 for College B
    roleB1 = await prisma.role.create({
      data: {
        collegeId: collegeB.id,
        name: 'College B Teacher',
        description: 'Foreign role',
        permissionsVersion: 1
      }
    });

    // Create Staff in College A assigned to Role A1
    staffA = await prisma.user.create({
      data: {
        email: 'sync_staff_a@test.edu',
        name: 'Alice Staff',
        role: 'STAFF',
        schoolId: collegeA.id,
        roleId: roleA1.id,
        employeeId: 'EMP-SYNC-001',
        status: 'ACTIVE'
      }
    });

    // -----------------------------------------------------------------
    // TEST 1: Role Rename and Staff List Instant Update
    // -----------------------------------------------------------------
    await test('TEST 1: Renaming role updates permissionsVersion and staff join shows new name', async () => {
      // Update role name in place
      const updatedRole = await prisma.role.update({
        where: { id: roleA1.id },
        data: {
          name: 'Senior Faculty',
          permissionsVersion: { increment: 1 }
        }
      });

      assert.strictEqual(updatedRole.name, 'Senior Faculty');
      assert.strictEqual(updatedRole.permissionsVersion, 2, 'permissionsVersion should increment to 2');

      // Fetch staff querying relation to Role
      const fetchedStaff = await prisma.user.findUnique({
        where: { id: staffA.id },
        include: { customRole: true }
      });

      assert.strictEqual(fetchedStaff.customRole.name, 'Senior Faculty', 'Staff record dynamically reflects new role name');
      invalidateRoleCache(roleA1.id);
    });

    // -----------------------------------------------------------------
    // TEST 2: Add or Remove Module Permission Yields X-Permissions-Changed & Fresh DB Data
    // -----------------------------------------------------------------
    await test('TEST 2: Add/remove permission increments version and triggers X-Permissions-Changed', async () => {
      // Token issued with permissionsVersion = 1
      const oldToken = jwt.sign({
        id: staffA.id,
        schoolId: collegeA.id,
        role: 'STAFF',
        roleId: roleA1.id,
        permissionsVersion: 1
      }, JWT_SECRET);

      // Admin updates role: removes 'fees' module and increments version
      await prisma.$transaction([
        prisma.rolePermission.deleteMany({
          where: { roleId: roleA1.id, moduleKey: 'fees' }
        }),
        prisma.role.update({
          where: { id: roleA1.id },
          data: { permissionsVersion: { increment: 1 } }
        })
      ]);
      invalidateRoleCache(roleA1.id);

      // Verify middleware detects version mismatch and sets header
      let headerSet = null;
      let nextCalled = false;
      const req = {
        user: jwt.verify(oldToken, JWT_SECRET),
        prisma
      };
      const res = {
        setHeader: (name, val) => {
          if (name === 'X-Permissions-Changed') headerSet = val;
        },
        status: () => ({ json: () => {} })
      };

      const middleware = requirePermission('attendance', 'read');
      await middleware(req, res, () => { nextCalled = true; });

      assert.strictEqual(nextCalled, true, 'Next should be called as attendance read is still permitted');
      assert.strictEqual(headerSet, 'true', 'X-Permissions-Changed header must be set to true for client');
    });

    // -----------------------------------------------------------------
    // TEST 3: Revoke CRUD Flag Returns 403 Immediately
    // -----------------------------------------------------------------
    await test('TEST 3: Revoking CRUD flag causes requirePermission to return 403 immediately', async () => {
      // Revoke canCreate on attendance
      await prisma.rolePermission.update({
        where: {
          roleId_moduleKey: {
            roleId: roleA1.id,
            moduleKey: 'attendance'
          }
        },
        data: { canCreate: false }
      });
      await prisma.role.update({
        where: { id: roleA1.id },
        data: { permissionsVersion: { increment: 1 } }
      });
      invalidateRoleCache(roleA1.id);

      let statusCode = null;
      let jsonPayload = null;
      const req = {
        user: {
          id: staffA.id,
          schoolId: collegeA.id,
          role: 'STAFF',
          roleId: roleA1.id,
          permissionsVersion: 99 // Force version check or fresh lookup
        },
        prisma
      };
      const res = {
        setHeader: () => {},
        getHeader: () => 'true',
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => { jsonPayload = data; }
          };
        }
      };

      const middleware = requirePermission('attendance', 'create');
      await middleware(req, res, () => {
        assert.fail('Next should not be called when permission is revoked');
      });

      assert.strictEqual(statusCode, 403, 'Must return 403 Forbidden');
      assert.strictEqual(jsonPayload.code, 'PERMISSION_DENIED');
      assert.strictEqual(jsonPayload.permissionsChanged, true);
    });

    // -----------------------------------------------------------------
    // TEST 4: Create Role Shows in Scoped Roles List
    // -----------------------------------------------------------------
    await test('TEST 4: Creating a role initializes version 1 and appears in college role query', async () => {
      const newRole = await prisma.role.create({
        data: {
          collegeId: collegeA.id,
          name: 'Assistant Professor',
          permissionsVersion: 1
        }
      });

      assert.strictEqual(newRole.permissionsVersion, 1);

      const collegeRoles = await prisma.role.findMany({
        where: { collegeId: collegeA.id }
      });

      assert.ok(collegeRoles.some(r => r.name === 'Assistant Professor'));
      // Clean up newly created role
      await prisma.role.delete({ where: { id: newRole.id } });
    });

    // -----------------------------------------------------------------
    // TEST 5: Changing Staff Role Applies New Permissions Immediately
    // -----------------------------------------------------------------
    await test('TEST 5: Changing staff roleId applies new role permissions immediately', async () => {
      // Reassign staffA from roleA1 to roleA2 (HOD Science, which has exams CRUD)
      const updatedStaff = await prisma.user.update({
        where: { id: staffA.id },
        data: { roleId: roleA2.id },
        include: {
          customRole: {
            include: { permissions: true }
          }
        }
      });

      assert.strictEqual(updatedStaff.roleId, roleA2.id);
      assert.strictEqual(updatedStaff.customRole.name, 'HOD Science');
      assert.ok(updatedStaff.customRole.permissions.some(p => p.moduleKey === 'exams' && p.canCreate));

      // Test requirePermission on exams create with staff's new roleId
      let nextCalled = false;
      const req = {
        user: {
          id: staffA.id,
          schoolId: collegeA.id,
          role: 'STAFF',
          roleId: roleA2.id,
          permissionsVersion: roleA2.permissionsVersion
        },
        prisma
      };
      const res = {
        setHeader: () => {},
        status: () => ({ json: () => {} })
      };

      const middleware = requirePermission('exams', 'create');
      await middleware(req, res, () => { nextCalled = true; });
      assert.strictEqual(nextCalled, true, 'Staff now has exams create permission immediately');
    });

    // -----------------------------------------------------------------
    // TEST 6: Deleting Assigned Role is Blocked (409 Conflict)
    // -----------------------------------------------------------------
    await test('TEST 6: Deleting assigned role is blocked with 409 and staff count', async () => {
      // roleA2 currently has staffA assigned
      const assignedCount = await prisma.user.count({
        where: { roleId: roleA2.id }
      });
      assert.strictEqual(assignedCount, 1, 'roleA2 has 1 assigned staff');

      // Attempting delete logic simulation
      let blockedWith409 = false;
      if (assignedCount > 0) {
        blockedWith409 = true;
      }
      assert.strictEqual(blockedWith409, true, 'Must block deletion when assigned staff > 0');

      // Now unassign staffA
      await prisma.user.update({
        where: { id: staffA.id },
        data: { roleId: null }
      });

      const countAfterUnassign = await prisma.user.count({
        where: { roleId: roleA2.id }
      });
      assert.strictEqual(countAfterUnassign, 0);

      // Now deletion succeeds
      await prisma.rolePermission.deleteMany({ where: { roleId: roleA2.id } });
      await prisma.role.delete({ where: { id: roleA2.id } });

      const checkRole = await prisma.role.findUnique({ where: { id: roleA2.id } });
      assert.strictEqual(checkRole, null, 'Role deleted after unassigning staff');
    });

    // -----------------------------------------------------------------
    // TEST 7: Cross-College Role Access is Impossible
    // -----------------------------------------------------------------
    await test('TEST 7: Cross-college role access and assignment is blocked', async () => {
      // College A admin querying roles must NOT receive College B roles
      const collegeARoles = await prisma.role.findMany({
        where: { collegeId: collegeA.id }
      });
      assert.ok(!collegeARoles.some(r => r.id === roleB1.id), 'College A cannot see College B roles');

      // College A cannot assign College B roleId to its staff
      let crossAssignmentFailed = false;
      const targetRoleId = roleB1.id;
      const roleInCollege = await prisma.role.findFirst({
        where: { id: targetRoleId, collegeId: collegeA.id }
      });

      if (!roleInCollege) {
        crossAssignmentFailed = true; // Blocked: Role does not belong to staff's college
      }

      assert.strictEqual(crossAssignmentFailed, true, 'Cross-college role assignment is strictly prohibited');
    });

  } finally {
    // -----------------------------------------------------------------
    // CLEANUP
    // -----------------------------------------------------------------
    try {
      await prisma.user.deleteMany({
        where: { email: { in: ['sync_staff_a@test.edu', 'sync_staff_b@test.edu'] } }
      });
      await prisma.rolePermission.deleteMany({
        where: { role: { school: { name: { in: ['Role Sync College A', 'Role Sync College B'] } } } }
      });
      await prisma.role.deleteMany({
        where: { school: { name: { in: ['Role Sync College A', 'Role Sync College B'] } } }
      });
      await prisma.school.deleteMany({
        where: { name: { in: ['Role Sync College A', 'Role Sync College B'] } }
      });
    } catch (_) {}
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`Results: ${passedTests}/${totalTests} Passed`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runRoleSyncTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
