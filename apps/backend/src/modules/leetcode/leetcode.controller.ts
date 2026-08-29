import type { Request, Response } from "express"
import { success, z } from 'zod'

// validations
import { leetcodeUsernameInputSchema } from "./leetcode.validation"


// errors
import { ZodParsingError, LeetCodeProfileFetchError, LeetCodeCalendarFetchError } from "../../errorHandler.js";



// services
import {
    fetchLeetCodeProfileData,
    fetchLeetcodeSubmissionCalender
    , createAndUpdateLeetcodeProfile,
    genrateAndSaveVerificationId
    , getLeetcodeStatsDataService,
    fetchUsersBioService,
    verifiedLeetcodeAccount,
    retryAfterRateLimitRateLimit
} from "./leetcode.service.js";



export const linkLeetCodeAccount = async (req: Request, res: Response) => {
    const { data, success, error } = leetcodeUsernameInputSchema.safeParse(req.body);
    if (!success) {
        const message = error instanceof Error
            ? z.flattenError(error).fieldErrors.leetCodeUsername?.[0] ?? error.message
            : "Unidentified Zod Error";
        const code = "ZodError";
        const details = "leetCodeUsername parsing error";
        throw new ZodParsingError(message, code, details);
    }
    const userName = data.leetCodeUsername;

    const userId = res.locals.userId;
    const leetcodeProfileData = await retryAfterRateLimitRateLimit(fetchLeetCodeProfileData,2000,userName);

    if (!leetcodeProfileData) {
        throw new LeetCodeProfileFetchError(
            "Unable to fetch Leetcode account",
            `No profile data found for LeetCode username: ${userName}`
        );
    }

    const leetcodeSubmissionCalenderData = await retryAfterRateLimitRateLimit(fetchLeetcodeSubmissionCalender,2000,userName);

    if (!leetcodeSubmissionCalenderData) {
        throw new LeetCodeCalendarFetchError(
            "Unable to fetch Leetcode accounts submission calender",
            `No calendar data found for LeetCode username: ${userName}`
        );
    }
    const leetcodeStats = await createAndUpdateLeetcodeProfile(userId, userName, leetcodeProfileData, leetcodeSubmissionCalenderData);

    return res.status(200).json({
        success: true,
        status: "success",
        message: "LeetCode profile linked and saved successfully!",
        data: leetcodeStats
    });
}

export const verifyMyProfile = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const leetCodeStats = await getLeetcodeStatsDataService(userId);
    
    if (!leetCodeStats) {
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "LeetCode account not linked. Please link an account first."
        });
    }
    
    const actualVerificationCode = leetCodeStats.verificationCode;
    if (!actualVerificationCode) {
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "No verification code found. Please generate a code first."
        });
    }
    
    const rawBio = await retryAfterRateLimitRateLimit(fetchUsersBioService, 2000, leetCodeStats.userName);
    if (!rawBio) {
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "Failed to fetch LeetCode profile. The username may have been changed."
        });
    }
    
    const bioText = rawBio?.matchedUser?.profile?.aboutMe || "";
    const username = leetCodeStats.userName;
    
    if (!bioText.toLowerCase().includes(actualVerificationCode.toLowerCase())) {
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "Verification failed. We could not find the secret code in your LeetCode bio."
        });
    }
    
    // Match found! Run the conflict resolution service
    await verifiedLeetcodeAccount(userId, username);
    
    return res.status(200).json({
        success: true,
        status: "success",
        message: "You have been successfully verified!"
    });
}

export const generateVerificationCode = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const verificationCode = await genrateAndSaveVerificationId(userId);
    return res.status(201).json({
        success: true,
        status: "success",
        message: "Generated the verification code successfully",
        verificationCode,
    });
}


