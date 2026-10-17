import prisma from "../../config/db"

//types 
import type { UserJSON } from "@clerk/backend"


// create or update user
export const createUser = async (data : UserJSON) => {
    const email = data.email_addresses[0]?.email_address ?? "";
    const userData = {
        firstName: data.first_name ?? "",
        lastName: data.last_name ?? "",
        profileImageUrl: data.image_url,
        username: data.username ?? "",
    };

    // 1. Check if user already exists by clerkId
    const existingByClerkId = await prisma.user.findUnique({
        where: { clerkId: data.id }
    });

    if (existingByClerkId) {
        // User exists, update them normally
        await prisma.user.update({
            where: { clerkId: data.id },
            data: { ...userData, email }
        });
        return;
    }

    // 2. Check if a user with this email already exists (e.g. deleted and recreated Clerk account)
    if (email) {
        const existingByEmail = await prisma.user.findUnique({
            where: { email }
        });

        if (existingByEmail) {
            // Re-link the new clerkId to the existing user record
            await prisma.user.update({
                where: { email },
                data: { ...userData, clerkId: data.id }
            });
            return;
        }
    }

    // 3. Create brand new user
    await prisma.user.create({
        data: {
            clerkId: data.id,
            email,
            ...userData
        }
    });
}

// delete user
export const deleteUser = async (clerkId : string) =>{
    await prisma.user.deleteMany({
        where : {
            clerkId 
        }
    })
}