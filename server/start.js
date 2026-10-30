const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { exec } = require('child_process');

console.log('==============================================');
console.log('🚀 [Queflow Startup] Starting server environment...');
console.log('==============================================');

// 1. Immediately boot Express HTTP & Socket.IO server
// This binds 0.0.0.0:${PORT} within < 50ms so Railway / Cloud health checks pass instantly
try {
  require('./index.js');
  console.log('⚡ [Queflow Startup] Express & Socket.IO server loaded successfully.');
} catch (err) {
  console.error('CRITICAL: Failed to load Express application:', err);
}

// 2. Non-blocking background initialization (database, migrations, local db if applicable)
(async () => {
  const dbUrl = process.env.DATABASE_URL || '';
  const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const isCloud = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL || process.env.NODE_ENV === 'production');

  // If local offline development and local database is not running
  if (isLocalDb && !isCloud) {
    try {
      const { startLocalDatabase, isPortOpen } = require('./localDb');
      const running = await isPortOpen(5432);
      if (!running) {
        console.log('🗄️ [Queflow Startup] Local PostgreSQL not detected on port 5432. Launching embedded database...');
        await startLocalDatabase();
      } else {
        console.log('✅ [Queflow Startup] Detected active PostgreSQL server on port 5432.');
      }
    } catch (err) {
      console.warn('⚠️ [Queflow Startup] Local embedded database notice:', err.message);
    }
  }

  // 3. Sync database schema in background without blocking web traffic or port checks
  if (dbUrl) {
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
    console.log(`🗄️ [Queflow Startup] Database URL detected (${maskedUrl}). Initiating background schema sync...`);
    
    const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
    const cmd = `npx --no-install prisma db push --accept-data-loss --skip-generate --schema="${schemaPath}"`;

    exec(cmd, { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        console.warn('⚠️ [Queflow Startup] Background DB sync notice:', err.message);
        if (stderr) console.warn(stderr);
      } else {
        console.log('✅ [Queflow Startup] Background database schema sync completed successfully.');
        if (stdout) console.log(stdout);
      }
    });
  } else {
    console.warn('⚠️ [Queflow Startup] DATABASE_URL is not defined in environment variables.');
  }
})().catch(err => {
  console.warn('⚠️ [Queflow Startup] Background initialization warning:', err.message);
});
