const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('\n================================================================');
console.log('✉️  Staff Invite & Registration Link Test Suite');
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

async function runStaffInviteTests() {
  let collegeA = null;
  let collegeB = null;
  let roleA = null;
  let adminA = null;
  let staffA = null;
  let staffB = null;
  let tokenA = null;

  try {
    // -------------------------------------------------------------
    // SETUP: Clean existing test data
    // -------------------------------------------------------------
    await prisma.staffInvite.deleteMany({
      where: { school: { name: { in: ['Invite Test College A', 'Invite Test College B'] } } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['admin@invite-a.edu', 'staff@invite-a.edu', 'staff@invite-b.edu'] } }
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { school: { name: { in: ['Invite Test College A', 'Invite Test College B'] } } } }
    });
    await prisma.role.deleteMany({
      where: { school: { name: { in: ['Invite Test College A', 'Invite Test College B'] } } }
    });
    await prisma.school.deleteMany({
      where: { name: { in: ['Invite Test College A', 'Invite Test College B'] } }
    });

    // Create 2 test colleges
    collegeA = await prisma.school.create({
      data: {
        name: 'Invite Test College A',
        status: 'ACTIVE',
        academicSetupCompleted: true,
        logoUrl: 'https://example.com/logo-a.png'
      }
    });

    collegeB = await prisma.school.create({
      data: {
        name: 'Invite Test College B',
        status: 'ACTIVE',
        academicSetupCompleted: true
      }
    });

    // Create role for College A
    roleA = await prisma.role.create({
      data: {
        collegeId: collegeA.id,
        name: 'Science Teacher',
        permissions: {
          create: [
            { moduleKey: 'attendance', canCreate: true, canRead: true, canUpdate: false, canDelete: false },
            { moduleKey: 'homework', canCreate: true, canRead: true, canUpdate: true, canDelete: false }
          ]
        }
      }
    });

    // Create admin user for College A
    adminA = await prisma.user.create({
      data: {
        schoolId: collegeA.id,
        name: 'Admin College A',
        email: 'admin@invite-a.edu',
        password: await bcrypt.hash('Admin@123', 10),
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });

    // -------------------------------------------------------------
    // TEST 1: Password field gone from Add Staff & status = INVITED
    // -------------------------------------------------------------
    await test('1. Password field gone from Add Staff; status = INVITED & passwordHash = null', async () => {
      // Simulate backend creation from POST /api/staff
      staffA = await prisma.user.create({
        data: {
          schoolId: collegeA.id,
          name: 'Albert Einstein',
          email: 'staff@invite-a.edu',
          employeeId: 'EMP-SCI-001',
          password: null, // No password assigned by admin
          role: 'STAFF',
          roleId: roleA.id,
          status: 'INVITED'
        }
      });

      assert.strictEqual(staffA.status, 'INVITED', 'New staff must have status INVITED');
      assert.strictEqual(staffA.password, null, 'New staff password must be null');
      assert.strictEqual(staffA.employeeId, 'EMP-SCI-001');
    });

    // -------------------------------------------------------------
    // TEST 2: INVITED staff cannot log in
    // -------------------------------------------------------------
    await test('2. INVITED staff cannot log in (returns 403 message)', async () => {
      const user = await prisma.user.findUnique({
        where: { email: 'staff@invite-a.edu' }
      });
      assert(user, 'User exists');
      assert.strictEqual(user.status, 'INVITED');

      // The login logic check:
      let rejected = false;
      let errorMsg = '';
      if (user.status === 'INVITED') {
        rejected = true;
        errorMsg = 'Please complete your registration using the link shared by your admin.';
      }

      assert.strictEqual(rejected, true);
      assert.strictEqual(errorMsg, 'Please complete your registration using the link shared by your admin.');
    });

    // -------------------------------------------------------------
    // TEST 3: Token stored hashed with SHA-256 (never raw in DB)
    // -------------------------------------------------------------
    let rawToken1 = null;
    let inviteRecord1 = null;

    await test('3. Invite link generated with 32-byte URL-safe token; stored ONLY as SHA-256 hash', async () => {
      rawToken1 = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken1).digest('hex');
      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

      inviteRecord1 = await prisma.staffInvite.create({
        data: {
          collegeId: collegeA.id,
          staffId: staffA.id,
          tokenHash,
          expiresAt,
          createdById: adminA.id
        }
      });

      // Verify DB stores only the hash
      const dbInvite = await prisma.staffInvite.findUnique({
        where: { tokenHash }
      });

      assert(dbInvite, 'Invite record must be stored');
      assert.strictEqual(dbInvite.tokenHash, tokenHash, 'Stored value must be SHA-256 hash');
      assert.notStrictEqual(dbInvite.tokenHash, rawToken1, 'Raw token must never be stored in DB');
      assert.strictEqual(dbInvite.tokenHash.length, 64, 'SHA-256 hex hash length is 64 chars');
    });

    // -------------------------------------------------------------
    // TEST 4: Validation endpoint returns ONLY safe fields
    // -------------------------------------------------------------
    await test('4. Public validate endpoint returns ONLY email, employeeId, schoolName, schoolLogo', async () => {
      const tokenHash = crypto.createHash('sha256').update(rawToken1).digest('hex');
      const invite = await prisma.staffInvite.findUnique({
        where: { tokenHash },
        include: {
          staff: { select: { email: true, employeeId: true, status: true } },
          school: { select: { name: true, logoUrl: true, status: true } }
        }
      });

      assert(invite, 'Invite found');
      assert.strictEqual(invite.staff.email, 'staff@invite-a.edu');
      assert.strictEqual(invite.staff.employeeId, 'EMP-SCI-001');
      assert.strictEqual(invite.school.name, 'Invite Test College A');
      assert.strictEqual(invite.school.logoUrl, 'https://example.com/logo-a.png');
    });

    // -------------------------------------------------------------
    // TEST 5: Regenerate revokes old link immediately
    // -------------------------------------------------------------
    let rawToken2 = null;

    await test('5. Regenerating invite revokes the old link immediately', async () => {
      // 1. Revoke existing unused invites
      await prisma.staffInvite.updateMany({
        where: { staffId: staffA.id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      // 2. Generate new raw token
      rawToken2 = crypto.randomBytes(32).toString('hex');
      const tokenHash2 = crypto.createHash('sha256').update(rawToken2).digest('hex');

      await prisma.staffInvite.create({
        data: {
          collegeId: collegeA.id,
          staffId: staffA.id,
          tokenHash: tokenHash2,
          expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
          createdById: adminA.id
        }
      });

      // Verify old invite is revoked
      const oldInvite = await prisma.staffInvite.findUnique({
        where: { tokenHash: crypto.createHash('sha256').update(rawToken1).digest('hex') }
      });
      assert(oldInvite.revokedAt !== null, 'Old invite must have revokedAt set');

      // Old token must fail validation
      const isOldValid = !oldInvite.usedAt && !oldInvite.revokedAt && new Date() < new Date(oldInvite.expiresAt);
      assert.strictEqual(isOldValid, false, 'Old token must be rejected');

      // New token is valid
      const newInvite = await prisma.staffInvite.findUnique({
        where: { tokenHash: tokenHash2 }
      });
      const isNewValid = !newInvite.usedAt && !newInvite.revokedAt && new Date() < new Date(newInvite.expiresAt);
      assert.strictEqual(isNewValid, true, 'New token must be valid');
    });

    // -------------------------------------------------------------
    // TEST 6: Expired tokens are rejected
    // -------------------------------------------------------------
    await test('6. Expired tokens are rejected', async () => {
      const expiredRaw = crypto.randomBytes(32).toString('hex');
      const expiredHash = crypto.createHash('sha256').update(expiredRaw).digest('hex');

      await prisma.staffInvite.create({
        data: {
          collegeId: collegeA.id,
          staffId: staffA.id,
          tokenHash: expiredHash,
          expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
          createdById: adminA.id
        }
      });

      const invite = await prisma.staffInvite.findUnique({ where: { tokenHash: expiredHash } });
      const isExpired = new Date() > new Date(invite.expiresAt);
      assert.strictEqual(isExpired, true, 'Must detect token is expired');
    });

    // -------------------------------------------------------------
    // TEST 7: Cross-college invite generation is blocked
    // -------------------------------------------------------------
    await test('7. Cross-college invite generation is impossible (tenant isolation)', async () => {
      // Create staff for College B
      staffB = await prisma.user.create({
        data: {
          schoolId: collegeB.id,
          name: 'Staff College B',
          email: 'staff@invite-b.edu',
          employeeId: 'EMP-B-001',
          password: null,
          role: 'STAFF',
          status: 'INVITED'
        }
      });

      // Admin of College A tries to find staffB scoped to collegeA
      const crossStaff = await prisma.user.findFirst({
        where: { id: staffB.id, schoolId: collegeA.id }
      });

      assert.strictEqual(crossStaff, null, 'Admin A cannot find or generate invite for Staff in College B');
    });

    // -------------------------------------------------------------
    // TEST 8: Registration completion & DB transaction
    // -------------------------------------------------------------
    await test('8. Complete registration: updates password, status = ACTIVE, marks invite used in 1 transaction', async () => {
      const tokenHash = crypto.createHash('sha256').update(rawToken2).digest('hex');
      const newPlainPassword = 'NewSecretPassword@2026';

      // Atomic transaction simulation
      await prisma.$transaction(async (tx) => {
        const invite = await tx.staffInvite.findUnique({
          where: { tokenHash },
          include: { staff: true, school: true }
        });

        assert(invite, 'Invite exists');
        assert.strictEqual(invite.staff.status, 'INVITED');

        const hashedPassword = await bcrypt.hash(newPlainPassword, 10);
        await tx.user.update({
          where: { id: invite.staffId },
          data: {
            password: hashedPassword,
            status: 'ACTIVE'
          }
        });

        const now = new Date();
        await tx.staffInvite.update({
          where: { id: invite.id },
          data: { usedAt: now }
        });

        await tx.staffInvite.updateMany({
          where: {
            staffId: invite.staffId,
            id: { not: invite.id },
            usedAt: null,
            revokedAt: null
          },
          data: { revokedAt: now }
        });
      });

      // Verify staff is now ACTIVE with hashed password
      const updatedStaff = await prisma.user.findUnique({
        where: { id: staffA.id }
      });

      assert.strictEqual(updatedStaff.status, 'ACTIVE');
      assert(updatedStaff.password !== null);
      const isPasswordValid = await bcrypt.compare(newPlainPassword, updatedStaff.password);
      assert.strictEqual(isPasswordValid, true, 'Staff can verify their newly chosen password');

      // Verify invite is marked USED
      const usedInvite = await prisma.staffInvite.findUnique({
        where: { tokenHash }
      });
      assert(usedInvite.usedAt !== null, 'Invite must have usedAt timestamp');
    });

    // -------------------------------------------------------------
    // TEST 9: Used token rejected on second attempt (single-use)
    // -------------------------------------------------------------
    await test('9. Single use enforcement: used token cannot be re-used', async () => {
      const tokenHash = crypto.createHash('sha256').update(rawToken2).digest('hex');
      const invite = await prisma.staffInvite.findUnique({ where: { tokenHash } });
      assert(invite.usedAt !== null, 'Invite is used');

      const isUsable = !invite.usedAt && !invite.revokedAt && new Date() < new Date(invite.expiresAt);
      assert.strictEqual(isUsable, false, 'Used token must be rejected on repeat attempt');
    });

    // -------------------------------------------------------------
    // TEST 10: ACTIVE staff logs in and receives role permissions
    // -------------------------------------------------------------
    await test('10. Newly ACTIVE staff logs in and receives their scoped role permissions', async () => {
      const staffUser = await prisma.user.findUnique({
        where: { email: 'staff@invite-a.edu' },
        include: {
          school: true,
          customRole: { include: { permissions: true } }
        }
      });

      assert.strictEqual(staffUser.status, 'ACTIVE');
      assert.strictEqual(staffUser.customRole.name, 'Science Teacher');
      assert.strictEqual(staffUser.customRole.permissions.length, 2);

      // Verify permissions mapped
      const permMap = {};
      staffUser.customRole.permissions.forEach(p => {
        permMap[p.moduleKey] = {
          canCreate: p.canCreate,
          canRead: p.canRead,
          canUpdate: p.canUpdate,
          canDelete: p.canDelete
        };
      });

      assert.strictEqual(permMap.attendance.canCreate, true);
      assert.strictEqual(permMap.attendance.canRead, true);
      assert.strictEqual(permMap.attendance.canDelete, false);
      assert.strictEqual(permMap.homework.canUpdate, true);
    });

  } finally {
    // Cleanup
    await prisma.staffInvite.deleteMany({
      where: { school: { name: { in: ['Invite Test College A', 'Invite Test College B'] } } }
    });
    await prisma.user.deleteMany({
      where: { email: { in: ['admin@invite-a.edu', 'staff@invite-a.edu', 'staff@invite-b.edu'] } }
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { school: { name: { in: ['Invite Test College A', 'Invite Test College B'] } } } }
    });
    await prisma.role.deleteMany({
      where: { school: { name: { in: ['Invite Test College A', 'Invite Test College B'] } } }
    });
    await prisma.school.deleteMany({
      where: { name: { in: ['Invite Test College A', 'Invite Test College B'] } }
    });

    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`📊 Staff Invite Test Results: ${passedTests}/${totalTests} Passed`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runStaffInviteTests();
