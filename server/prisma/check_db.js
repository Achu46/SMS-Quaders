require('dotenv').config();
const { Client } = require('pg');

async function checkDatabase() {
  const url = process.env.DATABASE_URL;

  console.log('\n======================================================');
  console.log('🔍 Checking Database Connection & Tables');
  console.log('======================================================');

  if (!url) {
    console.error('❌ Error: DATABASE_URL is not set in .env file.');
    return;
  }

  // Detect Railway internal URL being used locally
  if (url.includes('.railway.internal')) {
    console.warn('⚠️  NOTICE: Your DATABASE_URL is pointing to "postgres.railway.internal".');
    console.warn('   This domain ONLY works inside Railway cloud containers.');
    console.warn('   To run scripts from your computer, use Railway\'s Public Networking URL:');
    console.warn('   (Railway Dashboard -> Postgres -> Connect / Networking -> Public URL)\n');
  }

  const masked = url.replace(/:[^:@]+@/, ':***@');
  console.log(`📡 Connecting to: ${masked}`);

  const client = new Client({
    connectionString: url,
    ssl: url.includes('railway') || url.includes('supabase') || url.includes('neon')
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    await client.connect();
    console.log('✅ Connected to database successfully!\n');

    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name ASC;
    `);

    const tables = result.rows.map(r => r.table_name);

    if (tables.length === 0) {
      console.log('❌ No tables found in the database yet.');
      console.log('👉 To create all tables, run: npm run db:init');
      console.log('   Or paste server/prisma/init_schema.sql into Railway Query editor.');
    } else {
      console.log(`📋 Found ${tables.length} tables in the public schema:\n`);
      for (const t of tables) {
        try {
          const countRes = await client.query(`SELECT COUNT(*) as cnt FROM "${t}"`);
          const count = countRes.rows[0]?.cnt || 0;
          console.log(`   • ${t.padEnd(25)} (${count} rows)`);
        } catch {
          console.log(`   • ${t}`);
        }
      }

      console.log('\n------------------------------------------------------');
      const hasSuperAdmin = tables.includes('superadmin');
      const hasModules = tables.includes('Module');
      console.log(`superadmin table: ${hasSuperAdmin ? '✅ Created' : '❌ Missing'}`);
      console.log(`Module table:     ${hasModules ? '✅ Created' : '❌ Missing'}`);
      console.log('------------------------------------------------------');
    }
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  } finally {
    await client.end().catch(() => {});
    console.log('\n======================================================\n');
  }
}

checkDatabase();
