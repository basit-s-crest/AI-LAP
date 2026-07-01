"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const sessions = await prisma.session.findMany({
        orderBy: { scheduledAt: "asc" }
    });
    console.log("SESSIONS_JSON:" + JSON.stringify(sessions, null, 2));
}
main()
    .catch(console.error)
    .finally(async () => {
    await prisma.$disconnect();
});
