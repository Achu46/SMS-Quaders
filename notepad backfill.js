const { execSync } = require('child_process');

try {
  // Get git log history in format: date|message
  const log = execSync('git log --reverse --format="%ad|%s" --date=short', { encoding: 'utf8' });
  const lines = log.trim().split('\n');

  console.log(`Found ${lines.length} past commits to backfill...`);

  lines.forEach((line, index) => {
    const pipeIdx = line.indexOf('|');
    if (pipeIdx === -1) return;
    const cdate = line.substring(0, pipeIdx);
    const cmsg = line.substring(pipeIdx + 1).replace(/"/g, "'");

    const payload = JSON.stringify({
      task: "Project: Queflow-ERP",
      commits: 1,
      status: "Committed (Past)",
      notes: `[${cdate}] ${cmsg}`
    });

    // Use PowerShell curl to send the POST request safely on Windows
    const curlCmd = `powershell -Command "Invoke-RestMethod -Uri 'https://script.google.com/macros/s/AKfycbxB8sW7QRQfJZ-jSXg49D1CdptC00_7fFoFSklxgzBXZWdbrLxxLGb30yTM_mfDJdjxpw/exec' -Method Post -ContentType 'application/json' -Body '${payload}'"`;
    
    execSync(curlCmd);
    console.log(`[${index + 1}/${lines.length}] Backfilled: ${cdate} - ${cmsg}`);
  });

  console.log('Backfill complete!');
} catch (error) {
  console.error('Error during backfill:', error.message);
}