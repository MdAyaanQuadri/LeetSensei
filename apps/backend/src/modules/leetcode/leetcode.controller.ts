import type { Request, Response } from "express";
import { z } from "zod";

// validations
import { leetcodeUsernameInputSchema } from "./leetcode.validation";

// errors
import {
    ZodParsingError,
    LeetCodeProfileFetchError,
    LeetCodeCalendarFetchError,
} from "../../errorHandler.js";

// services
import {
    fetchLeetCodeProfileData,
    fetchLeetcodeSubmissionCalender,
    createAndUpdateLeetcodeProfile,
    genrateAndSaveVerificationId,
    getLeetcodeStatsDataService,
    fetchUsersBioService,
    verifiedLeetcodeAccount,
    retryAfterRateLimitRateLimit,
} from "./leetcode.service.js";

export const linkLeetCodeAccount = async (req: Request, res: Response) => {
    const { data, success: isValid, error } = leetcodeUsernameInputSchema.safeParse(req.body);

    if (!isValid) {
        const message = error instanceof Error
            ? z.flattenError(error).fieldErrors.leetCodeUsername?.[0] ?? error.message
            : "Unidentified Zod Error";
        const code = "ZodError";
        const details = "leetCodeUsername parsing error";
        throw new ZodParsingError(message, code, details);
    }

    const userName = data.leetCodeUsername;
    const userId = res.locals.userId;

    const leetcodeProfileData = await retryAfterRateLimitRateLimit(fetchLeetCodeProfileData, 2000, userName);
    if (!leetcodeProfileData) {
        throw new LeetCodeProfileFetchError(
            "Unable to fetch Leetcode account",
            `No profile data found for LeetCode username: ${userName}`
        );
    }

    const leetcodeSubmissionCalenderData = await retryAfterRateLimitRateLimit(
        fetchLeetcodeSubmissionCalender,
        2000,
        userName
    );

    if (!leetcodeSubmissionCalenderData) {
        throw new LeetCodeCalendarFetchError(
            "Unable to fetch Leetcode accounts submission calender",
            `No calendar data found for LeetCode username: ${userName}`
        );
    }

    const leetcodeStats = await createAndUpdateLeetcodeProfile(
        userId,
        userName,
        leetcodeProfileData,
        leetcodeSubmissionCalenderData
    );

    return res.status(200).json({
        success: true,
        status: "success",
        message: "LeetCode profile linked and saved successfully!",
        data: leetcodeStats,
    });
};

export const verifyMyProfile = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const leetCodeStats = await getLeetcodeStatsDataService(userId);

    if (!leetCodeStats) {
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "LeetCode account not linked. Please link an account first.",
        });
    }

    const actualVerificationCode = leetCodeStats.verificationCode;
    if (!actualVerificationCode) {
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "No verification code found. Please generate a code first.",
        });
    }

    const rawBio = await retryAfterRateLimitRateLimit(fetchUsersBioService, 2000, leetCodeStats.userName);
    if (!rawBio) {
        console.warn(`\n⚠️ [VERIFY WARNING] Failed to fetch LeetCode bio for ${leetCodeStats.userName}. API may be down or username changed.`);

        return res.status(200).json({
            success: false,
            status: "partial",
            message: "Failed to fetch LeetCode profile. The username may have been changed.",
        });
    }

    const bioText = rawBio?.matchedUser?.profile?.aboutMe ?? "";
    const username = leetCodeStats.userName;

    if (!bioText.toLowerCase().includes(actualVerificationCode.toLowerCase())) {
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "Verification failed. We could not find the secret code in your LeetCode bio.",
        });
    }

    await verifiedLeetcodeAccount(userId, username);

    return res.status(200).json({
        success: true,
        status: "success",
        message: "You have been successfully verified!",
    });
};

export const generateVerificationCode = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const verificationCode = await genrateAndSaveVerificationId(userId);

    return res.status(201).json({
        success: true,
        status: "success",
        message: "Generated the verification code successfully",
        verificationCode,
    });
};

// ==========================================
// CHROME EXTENSION ENDPOINTS
// ==========================================

export const syncQuestion = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.userId as string;
        const { questionId, questionTitle, questionSlug, difficulty } = req.body;

        console.log(`\n📥 [LeetSensei Extension] Question Synced!`);
        console.log(`User ID: ${userId}`);
        console.log(`Question: ${questionTitle} (${difficulty})`);

        // TODO: Uncomment when schema is updated
        // await db.question.upsert({ ... })

        return res.status(200).json({
            success: true,
            status: "success",
            message: "Question synced successfully",
        });
    } catch (error) {
        console.error("Error syncing question:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const trackSubmission = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.userId as string;
        const { questionSlug, statusDisplay, runtime, memory, code } = req.body;

        console.log(`\n📥 [LeetSensei Extension] Submission Received!`);
        console.log(`User ID: ${userId}`);
        console.log(`Question: ${questionSlug}`);
        console.log(`Status: ${statusDisplay}`);
        console.log(`Memory: ${memory}`);

        // TODO: Uncomment when schema is updated
        // await db.submission.create({ ... })

        return res.status(200).json({
            success: true,
            status: "success",
            message: "Submission tracked successfully",
        });
    } catch (error) {
        console.error("Error tracking submission:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

