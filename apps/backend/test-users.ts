import { PrismaClient } from './generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany();
  console.log(users);
}
main();
