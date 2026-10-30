const path = require('path');
const fs = require('fs');
const net = require('net');

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function startLocalDatabase() {
  // Never attempt to run embedded postgres in production or inside cloud containers (e.g. Railway, Render, Docker)
  if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_STATIC_URL) {
    return null;
  }

  const isOpen = await isPortOpen(5432);
  if (isOpen) {
    console.log('✅ PostgreSQL is already running on port 5432.');
    return null;
  }

  console.log('🚀 Starting local embedded PostgreSQL on port 5432...');
  try {
    let EmbeddedPostgres;
    try {
      EmbeddedPostgres = require('embedded-postgres').default || require('embedded-postgres');
    } catch (e) {
      console.warn('⚠️ [localDb] embedded-postgres not available:', e.message);
      return null;
    }

    const dataDir = path.join(__dirname, 'data', 'pgdata');
    const pg = new EmbeddedPostgres({
      databaseDir: dataDir,
      port: 5432,
      user: 'postgres',
      password: 'Cgs@001a',
      persistent: true
    });

    const isInitialized = fs.existsSync(path.join(dataDir, 'PG_VERSION'));
    if (!isInitialized) {
      await pg.initialise();
    }
    await pg.start();

    try {
      await pg.createDatabase('railway');
    } catch (err) {
      // Database might already exist
    }

    try {
      await pg.createDatabase('quaders');
    } catch (err) {
      // Database might already exist
    }

    console.log('✅ Local PostgreSQL started and ready on port 5432.');
    return pg;
  } catch (err) {
    console.warn('⚠️ [localDb] Embedded PostgreSQL start skipped:', err.message);
    return null;
  }
}

module.exports = { startLocalDatabase, isPortOpen };

if (require.main === module) {
  startLocalDatabase().then(() => {
    console.log('PostgreSQL runner active. Press Ctrl+C to terminate.');
  }).catch(err => {
    console.error('Failed to start local PostgreSQL:', err);
    process.exit(1);
  });
}
