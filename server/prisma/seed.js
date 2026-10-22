const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = 'info.quaders@gmail.com';
  const rawPassword = 'Quad@1010';
  const name = 'Super Administrator';

  console.log(`Seeding Super Admin user: ${email}...`);

  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  // 1. Seed into the dedicated 'superadmin' table
  let superAdminEntry = null;
  if (prisma.superAdmin) {
    superAdminEntry = await prisma.superAdmin.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        name,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      },
      create: {
        email,
        password: hashedPassword,
        name,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE'
      }
    });
  } else {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "superadmin" ("id", "email", "password", "name", "role", "status", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, $1, $2, $3, 'SUPER_ADMIN', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("email") DO UPDATE SET
        "password" = EXCLUDED."password",
        "name" = EXCLUDED."name",
        "status" = 'ACTIVE',
        "updatedAt" = CURRENT_TIMESTAMP
    `, email, hashedPassword, name);
  }

  // 2. Also keep universal User table synchronized for platform auth
  const superAdmin = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      name,
      role: 'SUPER_ADMIN'
    },
    create: {
      email,
      password: hashedPassword,
      name,
      role: 'SUPER_ADMIN'
    }
  });

  console.log('✅ Super Admin credentials successfully seeded in "superadmin" table!');
  console.log({
    id: superAdminEntry?.id || superAdmin.id,
    email: superAdmin.email,
    name: superAdmin.name,
    role: superAdmin.role,
    table: 'superadmin'
  });
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
