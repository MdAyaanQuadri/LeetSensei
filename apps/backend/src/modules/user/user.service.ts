import prisma from "../../config/db"

export const getUserDataService = async (userId : string) =>{
    const userData = await prisma.user.findUnique({
        where: {
            id : userId
        } ,
        include:{
            college : true ,
            leetcodeStats : true
        }
    })
    
    return userData ;

}


export const getUserDataByUsernameService = async (username : string) =>{
    const userData = await prisma.user.findUnique({
        where: {
            username
        } ,
        include:{
            college : true ,
            leetcodeStats : true
        }
    })
    
    return userData ;

}
