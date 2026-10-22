require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log('🚀 Quaders Database Migration & Table Setup');
  console.log('======================================================');
  console.log(`📡 Target Database URL: ${databaseUrl.replace(/:[^:@]+@/, ':***@')}`);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1') && (databaseUrl.includes('railway') || databaseUrl.includes('supabase') || databaseUrl.includes('neon'))
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    console.log('⏳ Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected successfully.\n');

    // 1. Read and execute master SQL schema
    const schemaSqlPath = path.join(__dirname, 'init_schema.sql');
    console.log(`📄 Reading schema from: ${schemaSqlPath}`);
    const sql = fs.readFileSync(schemaSqlPath, 'utf8');

    console.log('🔨 Executing table creation, indexes, and foreign keys...');
    await client.query(sql);
    console.log('✅ All tables, enums, unique constraints, and indexes created successfully!\n');

    // 2. Ensure Super Admin user exists
    const superAdminEmail = 'info.quaders@gmail.com';
    const rawPassword = 'Quad@1010';
    const name = 'Super Administrator';

    console.log(`👤 Checking Super Admin user: ${superAdminEmail}...`);
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const crypto = require('crypto');
    const userId = crypto.randomUUID();

    // Seed into dedicated 'superadmin' table
    await client.query(
      `INSERT INTO "superadmin" ("id", "email", "password", "name", "role", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'SUPER_ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("email") DO UPDATE SET
         "password" = EXCLUDED."password",
         "name" = EXCLUDED."name",
         "status" = 'ACTIVE',
         "updatedAt" = CURRENT_TIMESTAMP`,
      [userId, superAdminEmail, hashedPassword, name]
    );

    // Also sync User table for unified JWT auth
    await client.query(
      `INSERT INTO "User" ("id", "email", "password", "name", "role", "status", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'SUPER_ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT ("email") DO UPDATE SET
         "password" = EXCLUDED."password",
         "name" = EXCLUDED."name",
         "role" = 'SUPER_ADMIN',
         "updatedAt" = CURRENT_TIMESTAMP`,
      [userId, superAdminEmail, hashedPassword, name]
    );
    console.log('✅ Super Admin credentials seeded in "superadmin" and "User" tables successfully!');

    // 3. Verify seeded modules
    const moduleCountResult = await client.query('SELECT COUNT(*) as count FROM "Module"');
    const moduleCount = moduleCountResult.rows[0]?.count || 0;
    console.log(`📦 System Modules seeded: ${moduleCount} modules ready in database.`);

    console.log('\n======================================================');
    console.log('🎉 Database is 100% prepared and ready for production!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.stack) console.error(err.stack);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

migrate();
