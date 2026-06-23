import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/seed-admin.ts <email> <password>');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const person = await prisma.person.upsert({
    where: { email: email.toLowerCase().trim() },
    update: { isAdmin: true, passwordHash },
    create: { email: email.toLowerCase().trim(), isAdmin: true, passwordHash },
  });

  console.log(`Admin created/updated: ${person.email} (id: ${person.id})`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
