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
    log: ["query", "info", "warn", "error"],
});
async function main() {
    console.log("Testing connection with DATABASE_URL and ipv4first...");
    try {
        const result = await prisma.$queryRaw `SELECT 1`;
        console.log("Success! Query result:", result);
    }
    catch (err) {
        console.error("Connection failed:", err);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
