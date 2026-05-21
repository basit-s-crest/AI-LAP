"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMemberOrganizationId = getMemberOrganizationId;
exports.getActiveCoachesForMemberOrganization = getActiveCoachesForMemberOrganization;
exports.memberOrganizationHasActiveCoach = memberOrganizationHasActiveCoach;
const prisma_1 = __importDefault(require("../lib/prisma"));
/** User.organizationId for a member (nullable). */
async function getMemberOrganizationId(userId) {
    const user = await prisma_1.default.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
    });
    return user?.organizationId ?? null;
}
/**
 * Active coaches assigned to the member's org via OrganizationCoach only
 * (do not use Coach.organizationId).
 */
async function getActiveCoachesForMemberOrganization(memberUserId) {
    const orgId = await getMemberOrganizationId(memberUserId);
    if (!orgId)
        return [];
    const assignments = await prisma_1.default.organizationCoach.findMany({
        where: { organizationId: orgId },
        include: {
            coach: {
                include: {
                    orgAssignments: {
                        include: { organization: { select: { name: true } } },
                    },
                },
            },
        },
    });
    return assignments
        .map((a) => a.coach)
        .filter((c) => c.isActive)
        .sort((a, b) => a.name.localeCompare(b.name));
}
/** True if coach is linked to the member's org and is active. */
async function memberOrganizationHasActiveCoach(memberUserId, coachId) {
    const orgId = await getMemberOrganizationId(memberUserId);
    if (!orgId)
        return false;
    const link = await prisma_1.default.organizationCoach.findUnique({
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
