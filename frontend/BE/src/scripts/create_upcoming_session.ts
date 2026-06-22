import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const coachId = "cmp0p0cof0002q2w1wjngzrrq"; // Dr. Emmy Osei
  const memberId = "cmq6f97qg0000fvzdiq0t0lgn"; // Ishita Bhojani

  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  const member = await prisma.user.findUnique({ where: { id: memberId } });

  if (!coach || !member) {
    console.error("Coach or Member not found");
    return;
  }

  // Create session 30 minutes in the future
  const scheduledTime = new Date(Date.now() + 30 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      coachId,
      memberId,
      scheduledAt: scheduledTime,
      duration: 15,
      type: "Weekly Check-in",
      status: "upcoming"
    }
  });

  console.log("Created upcoming session:", session);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
