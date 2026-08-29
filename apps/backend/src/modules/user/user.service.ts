import prisma from "../../config/db"

export const getUserDataService = async (userId : string) =>{
    const userData = await prisma.user.findUnique({
        where: {
            id : userId
        }
    })
    return userData ;

}
