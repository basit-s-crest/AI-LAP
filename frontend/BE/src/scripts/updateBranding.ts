import prisma from "../lib/prisma";

async function main() {
  await prisma.platformSettings.upsert({
    where: { id: "platform" },
    update: {
      brandTitle: "SafeCircle",
      supportEmail: "support@safecircle.com",
    },
    create: {
      id: "platform",
      brandTitle: "SafeCircle",
      supportEmail: "support@safecircle.com",
    },
  });
  console.log("Database platform settings updated to SafeCircle.");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
