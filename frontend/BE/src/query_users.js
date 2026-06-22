const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log("USERS_LIST:", JSON.stringify(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, isVerified: u.isVerified }))));
  const coaches = await prisma.coach.findMany();
  console.log("COACHES_LIST:", JSON.stringify(coaches.map(c => ({ id: c.id, email: c.email, name: c.name, isActive: c.isActive }))));
}

main().catch(console.error).finally(() => prisma.$disconnect());
