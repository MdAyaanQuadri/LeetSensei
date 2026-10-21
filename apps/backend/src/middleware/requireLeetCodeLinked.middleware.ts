import type { Request, Response, NextFunction } from "express";

export const requireLeetCodeLinked = (req: Request, res: Response, next: NextFunction) => {
    const leetCodeStats = res.locals.leetcodeStats;

    if (!leetCodeStats) {
        return res.status(400).json({
            success: false,
            code: "USER_NOT_LINKED",
            message: "No LeetCode account linked. Please link your LeetCode account first.",
        });
    }

    next();
};

export default requireLeetCodeLinked;
