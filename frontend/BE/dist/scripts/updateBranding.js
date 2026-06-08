"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../lib/prisma"));
async function main() {
    await prisma_1.default.platformSettings.upsert({
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
    await prisma_1.default.$disconnect();
});
