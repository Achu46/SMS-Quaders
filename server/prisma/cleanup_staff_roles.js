/**
 * cleanup_staff_roles.js
 * Inspects all staff records in the database:
 * - Identifies staff whose roleId is null or missing.
 * - Identifies staff whose roleId points to a role from another college/institution.
 * - Reports them clearly for administrative reassignment (without guessing a role).
 */

require('dotenv').config();
const prisma = require('../prismaClient');

async function cleanupStaffRoles() {
  console.log('====================================================');
  console.log('🔍 Staff Roles Audit & Integrity Verification Script');
  console.log('====================================================');

  try {
    const allStaff = await prisma.user.findMany({
      where: { role: 'STAFF' },
      include: {
        customRole: true,
        school: { select: { id: true, name: true } }
      }
    });

    console.log(`Total staff records found: ${allStaff.length}`);

    const missingRole = [];
    const crossCollegeRole = [];
    const validStaff = [];

    for (const member of allStaff) {
      if (!member.roleId || !member.customRole) {
        missingRole.push({
          id: member.id,
          name: member.name,
          email: member.email,
          employeeId: member.employeeId,
          schoolId: member.schoolId,
          schoolName: member.school?.name || 'Unknown'
        });
        continue;
      }

      // Check college match
      if (member.customRole.collegeId !== member.schoolId) {
        crossCollegeRole.push({
          id: member.id,
          name: member.name,
          email: member.email,
          employeeId: member.employeeId,
          assignedRoleId: member.roleId,
          assignedRoleName: member.customRole.name,
          roleCollegeId: member.customRole.collegeId,
          staffCollegeId: member.schoolId,
          schoolName: member.school?.name || 'Unknown'
        });
        continue;
      }

      validStaff.push({
        id: member.id,
        name: member.name,
        roleName: member.customRole.name,
        permissionsCount: member.customRole.permissions?.length || 0
      });
    }

    console.log(`\n✅ Valid Staff with Scoped Roles: ${validStaff.length}`);
    validStaff.forEach(s => {
      console.log(`   - ${s.name} -> Role: "${s.roleName}"`);
    });

    if (missingRole.length > 0) {
      console.warn(`\n⚠️  Staff with MISSING / NULL roleId (${missingRole.length}):`);
      missingRole.forEach(s => {
        console.warn(`   - ID: ${s.id} | ${s.name} (${s.email}) | School: ${s.schoolName} (${s.schoolId})`);
        console.warn(`     👉 ACTION REQUIRED: School admin must assign a role from Roles & Permissions.`);
      });
    } else {
      console.log('\n✅ Zero staff records with missing roleId.');
    }

    if (crossCollegeRole.length > 0) {
      console.error(`\n🚨 Staff with MISMATCHED / CROSS-COLLEGE role (${crossCollegeRole.length}):`);
      crossCollegeRole.forEach(s => {
        console.error(`   - ID: ${s.id} | ${s.name} (${s.email})`);
        console.error(`     Assigned Role: "${s.assignedRoleName}" (${s.assignedRoleId}) belonging to college ${s.roleCollegeId}`);
        console.error(`     Staff belongs to college: ${s.staffCollegeId}`);
        console.error(`     👉 ACTION REQUIRED: Role linkage severed to maintain tenant boundary. Admin must reassign.`);
      });

      // Detach cross-college roles safely
      for (const s of crossCollegeRole) {
        await prisma.user.update({
          where: { id: s.id },
          data: { roleId: null }
        });
      }
      console.log('   🔄 Detached cross-college roles for security.');
    } else {
      console.log('✅ Zero cross-college role linkages detected.');
    }

    console.log('\n====================================================');
    console.log('Audit completed successfully.');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  cleanupStaffRoles();
}

module.exports = cleanupStaffRoles;

