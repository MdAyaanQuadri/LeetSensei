import prisma from "../../config/db.js";

// Search colleges by name (used for dropdown search)
export const searchCollegesService = async (query: string) => {
    return await prisma.college.findMany({
        where: {
            name: { contains: query, mode: "insensitive" }
        },
        take: 10,
        orderBy: { name: "asc" },
        select: { id: true, name: true, city: true, state: true }
    });
};

// Get a single college by its Prisma UUID
export const getCollegeByIdService = async (id: string) => {
    return await prisma.college.findUnique({
        where: { id }
    });
};

// User suggests a college that doesn't exist in the DB yet
export const suggestCollegeService = async (name: string, city: string, state: string) => {
    // Check if it already exists before creating
    const existing = await prisma.college.findFirst({
        where: { name: { equals: name, mode: "insensitive" } }
    });
    if (existing) {
        return { alreadyExists: true, college: existing };
    }
    const newCollege = await prisma.college.create({
        data: {
            name,
            city,
            state,
            collegeId: `USER-${Date.now()}`, // Auto-generated ID for user-submitted colleges
        }
    });
    return { alreadyExists: false, college: newCollege };
};

// Link a college to a user and save their degree info
export const linkCollegeToUserService = async (
    userId: string, 
    collegeId: string, 
    degree: string, 
    branch: string, 
    graduationYear: number
) => {
    // Verify the college exists
    const college = await prisma.college.findUnique({ where: { id: collegeId } });
    if (!college) return null;

    return await prisma.user.update({
        where: { id: userId },
        data: { 
            collegeId,
            degree,
            branch,
            graduationYear
        },
        select: { 
            id: true, 
            firstName: true, 
            collegeId: true,
            degree: true,
            branch: true,
            graduationYear: true
        }
    });
};
