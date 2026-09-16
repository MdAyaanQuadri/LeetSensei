import prisma from './src/config/db.js';

async function run() {
    try {
        const stats = await prisma.leetCodeStats.findUnique({
            where: { userId: "user_3JH5vxJs4NqUtoTgFJuKRL02mVH" }
        });
        console.log("Stats found", !!stats);
    } catch(e) {
        console.log("Error:", e.message);
    }
}
run();
