import type { Request, Response, NextFunction } from "express";

export const requireLeetCodeUsernameMatch = (req: Request, res: Response, next: NextFunction) => {
    const leetCodeStats = res.locals.leetcodeStats;
    const submittedUsername = req.body?.data?.submissionDetails?.user?.username;

    if (submittedUsername && leetCodeStats?.userName !== submittedUsername) {
        return res.status(400).json({
            success: false,
            code: "USERNAME_MISMATCH",
            message: "The LeetCode username on the submission does not match your linked account.",
            linkedUsername: leetCodeStats?.userName,
        });
    }

    next();
};

export default requireLeetCodeUsernameMatch;
