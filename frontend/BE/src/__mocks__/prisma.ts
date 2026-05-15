import { PrismaClient } from "@prisma/client";

// Create a manual mock for Prisma that works reliably with Prisma 5
const createModelMock = () => ({
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  upsert: jest.fn(),
});

const prisma = {
  coachMessage: createModelMock(),
  coachMember: createModelMock(),
  coach: createModelMock(),
  user: createModelMock(),
  organizationCoach: createModelMock(),
  message: createModelMock(),
  communityGroup: createModelMock(),
  emailVerification: createModelMock(),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
} as unknown as PrismaClient;

beforeEach(() => {
  jest.clearAllMocks();
});

export default prisma;
