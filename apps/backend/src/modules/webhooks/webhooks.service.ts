import prisma from "../../config/db"

//types 
import type { UserJSON } from "@clerk/backend"


// create or update user
export const createUser = async (data : UserJSON) => {
    await prisma.user.upsert({
        where :{
            clerkId: data.id
        },
        update: {
            email: data.email_addresses[0]?.email_address ?? "",
            firstName: data.first_name ?? "",
            lastName: data.last_name ?? "",
            profileImageUrl:data.image_url,
        },
        create: {
            clerkId: data.id,
            email: data.email_addresses[0]?.email_address ?? "",
            firstName: data.first_name ?? "",
            lastName: data.last_name ?? "",
            profileImageUrl:data.image_url,
        }
    })
}

// delete user
export const deleteUser = async (clerkId : string) =>{
    await prisma.user.delete({
        where : {
            clerkId 
        }
    })
}