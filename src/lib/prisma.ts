import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: ['query'], // Mostra um log em toda query do banco
})