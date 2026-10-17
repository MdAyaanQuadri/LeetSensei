// prisma/seed.ts
import prisma from '../src/config/db';
import collegesData from '../Data/colleges.json';
import leetcodeTopics from '../Data/topics.json';

const colleges = collegesData as Array<{
    university: string;
    college: string;
    college_type: string;
    state: string;
    district: string;
}>;

async function main() {
    console.log("Seeding colleges...");

    await prisma.college.createMany({
    data: colleges.map((item) => ({
        name: item.college.replace(/\s*\(Id:[^)]+\)/, "").trim(),
        collegeId: item.college.match(/Id: ([^)]+)/)?.[1] || "",
        collegeType: item.college_type,
        city: item.district,
        state: item.state,
    })),
    skipDuplicates: true, // Works perfectly because collegeId is @unique!
});
    console.log("Seeding topics...");
    await prisma.topic.createMany({
    data: leetcodeTopics.data.map((item) => ({
        name : item.name,
        slug :  item.slug ,

    })),
    skipDuplicates: true, 
});

    console.log("Done seeding!");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());