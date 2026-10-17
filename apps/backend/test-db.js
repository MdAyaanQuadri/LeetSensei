import pkg from '@prisma/client';
const { PrismaClient } = pkg;
const prisma = new PrismaClient();
async function main() {
  const columns = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'SubmissionHistory';
  `);
  console.log("COLUMNS:", JSON.stringify(columns, null, 2));
}
main().finally(() => prisma.$disconnect());
