const { spawn } = require('child_process');
const path = require('path');

console.log('========================================================');
console.log('🌟 Starting Queflow ERP (Backend Server & Frontend Client)');
console.log('========================================================\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// 1. Start Server
const serverProcess = spawn(npmCmd, ['run', 'start'], {
  cwd: path.join(__dirname, '..', 'server'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});

// 2. Start Client
const clientProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, '..', 'client'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, FORCE_COLOR: '1' }
});

const cleanup = () => {
  console.log('\nShutting down Queflow ERP services...');
  if (serverProcess) serverProcess.kill();
  if (clientProcess) clientProcess.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

