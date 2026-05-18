import type { Coach } from "@prisma/client";

import prisma from "../lib/prisma";

/** User.organizationId for a member (nullable). */
export async function getMemberOrganizationId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return user?.organizationId ?? null;
}

/**
 * Active coaches assigned to the member's org via OrganizationCoach only
 * (do not use Coach.organizationId).
 */
export async function getActiveCoachesForMemberOrganization(
  memberUserId: string
): Promise<Coach[]> {
  const orgId = await getMemberOrganizationId(memberUserId);
  if (!orgId) return [];

  const assignments = await prisma.organizationCoach.findMany({
    where: { organizationId: orgId },
    include: { coach: true },
  });

  return assignments
    .map((a) => a.coach)
    .filter((c) => c.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** True if coach is linked to the member's org and is active. */
export async function memberOrganizationHasActiveCoach(
  memberUserId: string,
  coachId: string
): Promise<boolean> {
  const orgId = await getMemberOrganizationId(memberUserId);
  if (!orgId) return false;

  const link = await prisma.organizationCoach.findUnique({
    where: {
      organizationId_coachId: {
        organizationId: orgId,
        coachId,
      },
    },
    include: { coach: true },
  });

  return !!(link && link.coach.isActive);
}
