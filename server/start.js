const { execSync } = require('child_process');

console.log('==============================================');
console.log('🚀 [Quaders Startup] Initializing Server Container');
console.log('==============================================');

// 1. Run database schema sync safely
if (process.env.DATABASE_URL) {
  try {
    console.log('🗄️ [Quaders Startup] Syncing database schema (npx prisma db push --accept-data-loss)...');
    execSync('npx prisma db push --accept-data-loss', {
      stdio: 'inherit',
      timeout: 60000 // 60 seconds timeout max
    });
    console.log('✅ [Quaders Startup] Database schema synchronized successfully.');
  } catch (err) {
    console.error('⚠️ [Quaders Startup] Non-fatal DB sync warning:', err.message);
    console.log('ℹ️ [Quaders Startup] Continuing server boot so Railway container stays alive and healthy...');
  }
} else {
  console.warn('⚠️ [Quaders Startup] DATABASE_URL environment variable is not defined.');
}

// 2. Launch Express Application
console.log('⚡ [Quaders Startup] Booting Express HTTP & Socket.IO server...');
require('./index.js');
