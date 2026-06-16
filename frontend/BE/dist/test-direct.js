"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const dns_1 = __importDefault(require("dns"));
// Force IPv4 first for DNS lookup
dns_1.default.setDefaultResultOrder("ipv4first");
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: "postgresql://postgres.yadujibjugyegtombulb:crest2026cipl@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres",
        },
    },
    log: ["query", "info", "warn", "error"],
});
async function main() {
    console.log("Testing connection with DIRECT_URL (5432) and ipv4first...");
    try {
        const result = await prisma.$queryRaw `SELECT 1`;
        console.log("Success with DIRECT_URL! Query result:", result);
    }
    catch (err) {
        console.error("DIRECT_URL connection failed:", err);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
