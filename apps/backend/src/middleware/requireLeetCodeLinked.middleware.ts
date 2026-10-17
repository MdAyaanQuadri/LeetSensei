import prisma from "../config/db.js";
import type { Request, Response, NextFunction } from "express";

export const requireLeetCodeLinked = async (req: Request, res: Response, next: NextFunction) => {
    const userId = res.locals.userId as string;

    const leetCodeStats = await prisma.leetCodeStats.findUnique({
        where: { userId }
    });

    if (!leetCodeStats) {
        return res.status(400).json({
            success: false,
            code: "USER_NOT_LINKED",
            message: "No LeetCode account linked. Please link your LeetCode account first.",
        });
    }

    // Attach to res.locals so requireLeetCodeVerified and controllers can reuse it with 0 extra queries
    res.locals.leetcodeStats = leetCodeStats;
    next();
};

export default requireLeetCodeLinked;
