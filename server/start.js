require('dotenv').config();
const { exec } = require('child_process');
const { startLocalDatabase, isPortOpen } = require('./localDb');

console.log('==============================================');
console.log('🚀 [Quaders Startup] Starting server environment...');
console.log('==============================================');

async function boot() {
  const dbUrl = process.env.DATABASE_URL || '';
  const isLocalDb = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

  // If local development requires PostgreSQL and port 5432 is closed, boot embedded PostgreSQL
  if (isLocalDb) {
    const running = await isPortOpen(5432);
    if (!running) {
      console.log('🗄️ [Quaders Startup] Local PostgreSQL not detected on port 5432. Launching embedded database...');
      try {
        await startLocalDatabase();
      } catch (err) {
        console.warn('⚠️ [Quaders Startup] Failed to start local embedded PostgreSQL:', err.message);
      }
    } else {
      console.log('✅ [Quaders Startup] Detected active PostgreSQL server on port 5432.');
    }
  }

  // 1. Boot Express HTTP & Socket.IO server
  require('./index.js');

  // 2. Run database schema sync in background without blocking server health checks
  if (process.env.DATABASE_URL) {
    console.log('🗄️ [Quaders Startup] Initiating background schema sync (prisma db push --accept-data-loss --skip-generate)...');
    exec('npx prisma db push --accept-data-loss --skip-generate', (err, stdout, stderr) => {
      if (err) {
        console.warn('⚠️ [Quaders Startup] Background DB sync notice:', err.message);
        if (stderr) console.warn(stderr);
      } else {
        console.log('✅ [Quaders Startup] Background database sync completed successfully.');
        if (stdout) console.log(stdout);
      }
    });
  } else {
    console.warn('⚠️ [Quaders Startup] DATABASE_URL is not defined in environment variables.');
  }
}

boot().catch((err) => {
  console.error('CRITICAL: Server startup failed:', err);
  process.exit(1);
});
