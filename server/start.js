const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { exec } = require('child_process');

console.log('==============================================');
console.log('🚀 [Queflow Startup] Starting server environment...');
console.log('==============================================');

// 1. Immediately boot Express HTTP & Socket.IO server
try {
  require('./index.js');
  console.log('⚡ [Queflow Startup] Express & Socket.IO server loaded successfully.');
} catch (err) {
  console.error('CRITICAL: Failed to load Express application:', err);
}

// 2. Non-blocking background schema sync against Railway PostgreSQL
(async () => {
  const dbUrl = process.env.DATABASE_URL || '';

  if (dbUrl) {
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':***@');
    console.log(`🗄️ [Queflow Startup] Railway Database detected (${maskedUrl}). Initiating background schema sync...`);
    
    const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
    const cmd = `npx --no-install prisma db push --accept-data-loss --skip-generate --schema="${schemaPath}"`;

    exec(cmd, { cwd: __dirname }, (err, stdout, stderr) => {
      if (err) {
        console.warn('⚠️ [Queflow Startup] Background DB sync notice:', err.message);
        if (stderr) console.warn(stderr);
      } else {
        console.log('✅ [Queflow Startup] Railway database schema sync completed successfully.');
        if (stdout) console.log(stdout);
      }
    });
  } else {
    console.warn('⚠️ [Queflow Startup] DATABASE_URL is not defined in environment variables.');
  }
})().catch(err => {
  console.warn('⚠️ [Queflow Startup] Background initialization warning:', err.message);
});
