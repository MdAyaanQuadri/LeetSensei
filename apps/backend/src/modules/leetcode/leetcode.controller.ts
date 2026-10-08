import type { Request, Response } from "express";
import { z } from "zod";

// validations
import {
    leetcodeUsernameInputSchema,
    questionSyncSchema,
    submissionTrackSchema,
} from "./leetcode.validation";

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
    retryAfterRateLimit,
    fetchQuestions,
    createQuestions,
    createAndUpdateSubmissionHistory,
    createSubmissionDetails,
    getQuestionBySlug
} from "./leetcode.service.js";

// user service 
import {
    getUserDataService
} from "../user/user.service.js"


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

    const leetcodeProfileData = await retryAfterRateLimit(fetchLeetCodeProfileData, 2000, userName);
    if (!leetcodeProfileData) {
        throw new LeetCodeProfileFetchError(
            "Unable to fetch Leetcode account",
            `No profile data found for LeetCode username: ${userName}`
        );
    }

    const leetcodeSubmissionCalenderData = await retryAfterRateLimit(
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

    const rawBio = await retryAfterRateLimit(fetchUsersBioService, 2000, leetCodeStats.userName);
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
        const { data, error, success } = questionSyncSchema.safeParse(req.body);

        if (!success) {
            // Correct way to get a readable string of all Zod errors!
            const message = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ') || "Unidentified Zod Error";
            const code = "ZodError";
            const details = "Question syncing validation error";

            throw new ZodParsingError(message, code, details);
        }

        // check if question exist rough question slug
        const questionSlug = data.data.question.titleSlug;
        const questionData = await fetchQuestions(questionSlug);

        if (questionData) {
            return res.status(200).json({
                success: true,
                status: "success",
                message: "Question already synced",
            });
        }
        // if not save the question 
        await createQuestions(data);

        // ai analysis for future feature  

        return res.status(200).json({
            success: true,
            status: "success",
            message: "Question synced successfully",
        });
    } catch (error) {
        // If it's your custom ZodParsingError, let the global error handler catch it
        if (error instanceof ZodParsingError) {
            throw error;
        }
        console.error("Error syncing question:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const trackSubmission = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const { data, success, error } = submissionTrackSchema.safeParse(req.body);
    if (!success) {
        // Correct way to get a readable string of all Zod errors!
        const message = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ') || "Unidentified Zod Error";
        const code = "ZodError";
        const details = "Question syncing validation error";

        throw new ZodParsingError(message, code, details);
    }
    const userData = await getUserDataService(userId);

    const submissionHistoryData = data.data.questionSubmissionList.submissions;

    const submissionDetailsData = data.data.submissionDetails;

    if (!userData?.leetcodeStats) {
        return res.status(400).json({
            success: false,
            message: "No LeetCode account linked. Please link your LeetCode account first.",
        });
    }

    if (!userData.leetcodeStats.isVerified) {
        return res.status(400).json({
            success: false,
            message: "Your LeetCode account is not verified. Please verify your account first.",
        });
    }

    if (userData.leetcodeStats.userName !== submissionDetailsData.user?.username) {
        return res.status(400).json({
            success: false,
            message: "The LeetCode username on the submission does not match your linked account. Please switch LeetCode accounts.",
        });
    }




    //TODO :PAHSE 2
    // schema for prev schema -> done ;
    //  submit prev submission creaer ie it 

    await createAndUpdateSubmissionHistory(submissionHistoryData, userId);

    // TODO :PHASE 3
    // format data
    // create submission schema in prisma  -> done 

    const sorted = [...submissionHistoryData].sort((a, b) => b.frontendId - a.frontendId);
    const latestSubmission = sorted[0];
    const submissionId = latestSubmission?.id as string;

    let previouslySolved = false;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]?.status === 10) {
            previouslySolved = true;
            break;
        }
    }

    await createSubmissionDetails(submissionDetailsData, submissionId, previouslySolved) ;

    if(previouslySolved === false && latestSubmission?.status === 10){
        const questionData = await getQuestionBySlug(submissionDetailsData.question.titleSlug) ;
        const difficulty = questionData?.difficulty as string ;
        const timestamp = parseInt(sorted[0]?.timestamp as string) ; 
        

    }




    return res.status(200).json({
        success: true,
        status: "success",
        message: "Submission tracked successfully",
    });
}

