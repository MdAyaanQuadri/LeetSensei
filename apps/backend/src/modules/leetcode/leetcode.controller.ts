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
    getQuestionBySlug,
    updateLeetcodeStats
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
        code: "LINK_SUCCESS",
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
            code: "NOT_LINKED",
            message: "LeetCode account not linked. Please link an account first.",
        });
    }

    const actualVerificationCode = leetCodeStats.verificationCode;
    if (!actualVerificationCode) {
        return res.status(200).json({
            success: false,
            code: "NO_CODE_GENERATED",
            message: "No verification code found. Please generate a code first.",
        });
    }

    const rawBio = await retryAfterRateLimit(fetchUsersBioService, 2000, leetCodeStats.userName);
    if (!rawBio) {
        console.warn(`\n⚠️ [VERIFY WARNING] Failed to fetch LeetCode bio for ${leetCodeStats.userName}. API may be down or username changed.`);

        return res.status(200).json({
            success: false,
            code: "BIO_FETCH_FAILED",
            message: "Failed to fetch LeetCode profile. The username may have been changed.",
        });
    }

    const bioText = rawBio?.matchedUser?.profile?.aboutMe ?? "";
    const username = leetCodeStats.userName;

    if (!bioText.toLowerCase().includes(actualVerificationCode.toLowerCase())) {
        return res.status(200).json({
            success: false,
            code: "CODE_NOT_FOUND",
            message: "Verification failed. We could not find the secret code in your LeetCode bio.",
        });
    }

    await verifiedLeetcodeAccount(userId, username);

    // If stats are older than 15 minutes, trigger a background refresh
    const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;
    const isStale = (Date.now() - leetCodeStats.lastSyncedAt.getTime()) > FIFTEEN_MINUTES_IN_MS;

    if (isStale) {
        (async () => {
            try {
                const [freshProfile, freshCalendar] = await Promise.all([
                    retryAfterRateLimit(fetchLeetCodeProfileData, 2000, username),
                    retryAfterRateLimit(fetchLeetcodeSubmissionCalender, 2000, username)
                ]);

                if (freshProfile && freshCalendar) {
                    await createAndUpdateLeetcodeProfile(userId, username, freshProfile, freshCalendar);
                    console.log(`[LeetSensei] Background refreshed stale stats for verified user @${username}`);
                }
            } catch (err) {
                console.error("Failed background stats refresh on verify:", err);
            }
        })();
    }

    return res.status(200).json({
        success: true,
        code: "VERIFY_SUCCESS",
        message: "You have been successfully verified!",
    });
};

export const generateVerificationCode = async (req: Request, res: Response) => {
    const userId = res.locals.userId as string;
    const verificationCode = await genrateAndSaveVerificationId(userId);

    return res.status(201).json({
        success: true,
        code: "CODE_GENERATED",
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
                code: "ALREADY_SYNCED",
                message: "Question already synced",
            });
        }
        // if not save the question 
        await createQuestions(data);

        // ai analysis for future feature  

        return res.status(200).json({
            success: true,
            code: "SYNC_SUCCESS",
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
            code: "INTERNAL_ERROR",
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
    const submissionHistoryData = data.data.questionSubmissionList.submissions;
    const submissionDetailsData = data.data.submissionDetails;

    const sorted = [...submissionHistoryData].sort((a, b) => b.frontendId - a.frontendId);
    const latestSubmission = sorted[0];
    const finalStatusCode = Number(submissionDetailsData.statusCode);

    // Defense: If LeetCode judge is still evaluating (status 0 or 16, or isPending === 'Pending')
    const isPending = (latestSubmission?.isPending && String(latestSubmission.isPending).toLowerCase() === "pending")
        || finalStatusCode === 0
        || finalStatusCode === 16
        || (latestSubmission && (latestSubmission.status === 0 || latestSubmission.status === 16));

    if (isPending) {
        return res.status(400).json({
            success: false,
            code: "SUBMISSION_EVALUATING",
            message: "Submission is still being evaluated by LeetCode. Please wait for evaluation to complete.",
        });
    }

    await createAndUpdateSubmissionHistory(submissionHistoryData, userId);

    const submissionId = latestSubmission?.id as string;

    let previouslySolved = false;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]?.status === 10) {
            previouslySolved = true;
            break;
        }
    }

    await createSubmissionDetails(submissionDetailsData, submissionId, previouslySolved);

    // Get shared data needed for all 3 scenarios
    const questionData = await getQuestionBySlug(submissionDetailsData.question.titleSlug);
    const difficulty = questionData?.difficulty || "Medium";
    const timestamp = parseInt(latestSubmission?.timestamp as string || submissionDetailsData.timestamp.toString());
    const status = latestSubmission?.status || finalStatusCode;

    await updateLeetcodeStats(userId, previouslySolved, status, timestamp, difficulty);

    return res.status(200).json({
        success: true,
        code: "TRACK_SUCCESS",
        message: "Submission tracked successfully",
    });
};
