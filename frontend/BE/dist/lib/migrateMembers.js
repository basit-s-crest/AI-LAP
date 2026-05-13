"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma_1 = __importDefault(require("./prisma"));
async function migrate() {
    const groups = await prisma_1.default.communityGroup.findMany();
    for (const group of groups) {
        for (const memberId of group.memberIds) {
            const userExists = await prisma_1.default.user.findUnique({
                where: { id: memberId },
            });
            if (!userExists)
                continue;
            await prisma_1.default.groupMembership.upsert({
                where: { memberId_groupId: { memberId, groupId: group.id } },
                update: { isActive: true },
                create: { memberId, groupId: group.id, isActive: true },
            });
        }
        console.log(`Migrated ${group.memberIds.length} members for: ${group.name}`);
    }
    console.log("✅ Migration done");
    await prisma_1.default.$disconnect();
}
migrate().catch(console.error);
