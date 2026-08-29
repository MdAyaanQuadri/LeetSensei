import { getAuth } from "@clerk/express";
import prisma from "../config/db";

import type { Request, Response, NextFunction } from "express";


const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
    // const { userId } = getAuth(req);
    const userId = "user_3ITHExMHYavgaFsA1sG8xhH49G5" ;
    if (!userId) {
        return res.status(401).json({
            sucess: false,
            message: "Please login",
            code: "UNAUTHORISED"
        });
    }
    const clerkId = userId ;
    const dbUser = await prisma.user.findUnique({
        where: { clerkId: userId }
    });
    if (!dbUser) {
        return res.status(404).json({ success: false, message: "User not found ." });
    }
    
    res.locals.clerkId = clerkId ;
    res.locals.userId =  dbUser.id ;
    next();
}

export default requireAuth;