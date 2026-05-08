let PrismaClientConstructor: new () => any;

try {
  PrismaClientConstructor = require("../../../packages/database/node_modules/@prisma/client").PrismaClient;
} catch (error) {
  PrismaClientConstructor = require("../../../node_modules/@prisma/client").PrismaClient;
}

const prisma = new PrismaClientConstructor();

export default prisma;
