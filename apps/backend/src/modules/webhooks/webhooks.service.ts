import prisma from "../../config/db"

//types 
import type { UserJSON } from "@clerk/backend"

export const createUser = async (data : UserJSON) => {
    await prisma.user.upsert({
        where :{
            clerkId: data.id
        },
        update: {
            email: data.email_addresses[0]?.email_address ?? "",
            firstName: data.first_name ?? "",
            lastName: data.last_name ?? "",
        },
        create: {
            clerkId: data.id,
            email: data.email_addresses[0]?.email_address ?? "",
            firstName: data.first_name ?? "",
            lastName: data.last_name ?? ""
        }
    })
}


export const deleteUser = async (clerkId : string) =>{
    await prisma.user.delete({
        where : {
            clerkId 
        }
    })
}