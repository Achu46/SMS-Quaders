const { exec } = require('child_process');

console.log('==============================================');
console.log('🚀 [Quaders Startup] Starting Express server immediately...');
console.log('==============================================');

// 1. Immediately boot Express HTTP & Socket.IO server so Railway port scanner passes instantly (< 1s)
require('./index.js');

// 2. Run database schema sync in background without blocking server health checks
if (process.env.DATABASE_URL) {
  console.log('🗄️ [Quaders Startup] Initiating background schema sync (prisma db push --accept-data-loss)...');
  exec('npx prisma db push --accept-data-loss', (err, stdout, stderr) => {
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
