const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = 'info.quaders@gmail.com';
  const rawPassword = 'Quad@1010';
  const name = 'Super Administrator';

  console.log(`Seeding Super Admin user: ${email}...`);

  const hashedPassword = await bcrypt.hash(rawPassword, 10);

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

  console.log('✅ Super Admin successfully seeded!');
  console.log({
    id: superAdmin.id,
    email: superAdmin.email,
    name: superAdmin.name,
    role: superAdmin.role
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
