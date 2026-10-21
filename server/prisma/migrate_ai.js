require('dotenv').config();
const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected.');

    console.log('Creating AiUsage and AiAuditLog tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS "AiUsage" (
        "id" TEXT PRIMARY KEY,
        "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE,
        "plan" TEXT NOT NULL DEFAULT 'FREE',
        "usageDate" TEXT NOT NULL,
        "requestCount" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "AiUsage_schoolId_usageDate_key" ON "AiUsage"("schoolId", "usageDate");
      CREATE INDEX IF NOT EXISTS "AiUsage_schoolId_idx" ON "AiUsage"("schoolId");

      CREATE TABLE IF NOT EXISTS "AiAuditLog" (
        "id" TEXT PRIMARY KEY,
        "schoolId" TEXT NOT NULL REFERENCES "School"("id") ON DELETE CASCADE,
        "userId" TEXT NOT NULL,
        "model" TEXT NOT NULL,
        "toolsUsed" JSONB NOT NULL DEFAULT '[]',
        "status" TEXT NOT NULL,
        "latencyMs" INTEGER,
        "tokensPrompt" INTEGER,
        "tokensCompletion" INTEGER,
        "errorCategory" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "AiAuditLog_schoolId_createdAt_idx" ON "AiAuditLog"("schoolId", "createdAt");

      CREATE TABLE IF NOT EXISTS "AiConversation" (
        "id" TEXT PRIMARY KEY,
        "schoolId" TEXT REFERENCES "School"("id") ON DELETE CASCADE,
        "userId" TEXT NOT NULL,
        "title" TEXT NOT NULL DEFAULT 'New Chat',
        "messages" JSONB NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS "AiConversation_userId_updatedAt_idx" ON "AiConversation"("userId", "updatedAt");
      CREATE INDEX IF NOT EXISTS "AiConversation_schoolId_idx" ON "AiConversation"("schoolId");
    `);

    console.log('✅ Database migration for AI tables completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

migrate();
