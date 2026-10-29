require('dotenv').config();
const { Client } = require('pg');

async function cleanupAndMigrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL for Data Cleanup & Backfill...');

    // 1. Ensure academicSetupCompleted column exists and backfill
    await client.query(`
      ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "academicSetupCompleted" BOOLEAN DEFAULT false;
      UPDATE "School" SET "academicSetupCompleted" = "setupCompleted" WHERE "setupCompleted" IS TRUE;
      UPDATE "School" SET "status" = 'ACTIVE' WHERE "status" IS NULL;
    `);
    console.log('✅ Backfilled academicSetupCompleted and status on School table.');

    // 2. Remove all default/seeded roles everywhere
    // Delete any legacy StaffRole entries marked as isSystemRole or matching default names
    const deletedLegacy = await client.query(`
      DELETE FROM "StaffRole" 
      WHERE "isSystemRole" = true 
         OR "name" IN ('Principal', 'Vice Principal', 'Class Teacher', 'Subject Teacher', 'Accountant', 'Correspondent', 'Staffs');
    `);
    console.log(`✅ Deleted ${deletedLegacy.rowCount} legacy seeded roles from StaffRole.`);

    // Also ensure zero seeded roles in new roles table
    const deletedRoles = await client.query(`
      DELETE FROM "roles"
      WHERE "name" IN ('Principal', 'Vice Principal', 'Class Teacher', 'Subject Teacher', 'Accountant', 'Correspondent', 'Staffs');
    `);
    console.log(`✅ Deleted ${deletedRoles.rowCount} default roles from roles table.`);

    console.log('🎉 Data cleanup and backfill finished successfully!');
  } catch (err) {
    console.error('Data cleanup error:', err);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  cleanupAndMigrate();
}

module.exports = cleanupAndMigrate;

