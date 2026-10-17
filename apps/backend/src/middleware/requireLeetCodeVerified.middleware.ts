import type { Request, Response, NextFunction } from "express";

export const requireLeetCodeVerified = async (req: Request, res: Response, next: NextFunction) => {
    const leetCodeStats = res.locals.leetcodeStats;

    if (!leetCodeStats?.isVerified) {
        return res.status(400).json({
            success: false,
            code: "USER_NOT_VERIFIED",
            message: "Your LeetCode account is not verified. Please verify your account first.",
        });
    }

    next();
};

export default requireLeetCodeVerified;
