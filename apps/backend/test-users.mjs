import { PrismaClient } from './generated/prisma/index.js';
const prisma = new PrismaClient();
const users = await prisma.user.findMany();
console.log(users);
