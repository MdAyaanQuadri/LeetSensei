import type { Request, Response } from "express";


// leetcode Services
import { 
    fetchLeetCodeProfileData,
    fetchLeetcodeSubmissionCalender,
    getLeetcodeStatsDataService, 
    leetcodeUsernameChanged,
    leetcodeHeatmapPrivate, 
    updateLeetcodeProfileOnly, 
    updateLeetcodeCalendarOnly,
    retryAfterRateLimit,
} from "../leetcode/leetcode.service.js" 

// user services 
import { getUserDataService ,getUserDataByUsernameService} from './user.service.js'

//error
import { UserNotFoundError, ZodParsingError } from "../../errorHandler.js"

// validations
import { usernameParamSchema } from "./user.validation.js";

export const getMyProfile = async (req: Request, res: Response) => {
    const userId = res.locals.userId;
    
    // 1. Fetch User Data
    const user = await getUserDataService(userId);
    if (!user) {
        throw new UserNotFoundError("The requested user profile does not exist", "");
    }
    
    // 2. Fetch Cached LeetCode Stats
    const cachedLeetcodeStats = user.leetcodeStats;
    if (!cachedLeetcodeStats) {
        // Soft Error: The user exists but hasn't linked a LeetCode account yet.
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "User profile loaded, but no LeetCode account is linked.",
            data: { user }
        });
    }

    // 3. Check 15-Minute Cache (Codolio standard)
    const lastSynced = cachedLeetcodeStats.lastSyncedAt.getTime();
    const now = Date.now();
    const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000; 

    if (now - lastSynced < FIFTEEN_MINUTES_IN_MS) {
        // Cache is fresh, return immediately!
        return res.status(200).json({
            success: true,
            status: "success",
            message: "Profile fetched successfully from cache.",
            data: { user }
        });
    }

    // 4. Cache Expired -> Fetch Fresh Profile Data
    const username = cachedLeetcodeStats.userName;
    const freshProfileData = await retryAfterRateLimit(fetchLeetCodeProfileData, 2000, username);
    
    if (!freshProfileData) {
        // Log the silent failure to the terminal so you aren't flying blind!
        console.warn(`\n⚠️ [SYNC WARNING] Profile fetch failed for ${username}. They may have changed their username.`);
        
        // Soft Error: User changed their LeetCode name.
        await leetcodeUsernameChanged(userId);
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "LeetCode username changed or abandoned. Showing cached data.",
            data: { 
                user
            }
        });
    }
    
    // Update DB with fresh profile stats
    const updatedProfileStats = await updateLeetcodeProfileOnly(userId, username, freshProfileData);

    // 5. Fetch Fresh Calendar Data
    const freshCalendarData = await retryAfterRateLimit(fetchLeetcodeSubmissionCalender, 2000, username);
    
    if (!freshCalendarData) {
        // Log the silent failure to the terminal
        console.warn(`\n⚠️ [SYNC WARNING] Calendar fetch failed for ${username}. Heatmap might be private.`);
        
        // Soft Error: Heatmap is private or failed to fetch.
        await leetcodeHeatmapPrivate(userId);
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "Profile synced, but LeetCode Heatmap is set to private.",
            data: {
               user: { 
                    ...user, 
                    // Overwrite the old stats with the fresh ones!
                    leetcodeStats: { ...updatedProfileStats, isHeatmapPrivate: true } 
                }
            }
        });
    }

    // 6. Update DB with fresh calendar stats
    const fullyUpdatedStats = await updateLeetcodeCalendarOnly(userId, freshCalendarData);

    return res.status(200).json({
        success: true,
        status: "success",
        message: "Profile completely synced successfully.",
        data: {
            user: {
                ...user,
                // Overwrite the old stats with the fresh ones!
                leetcodeStats: fullyUpdatedStats 
            }
        }
    });
}





export const getPublicProfile = async (req: Request, res: Response) => {
    // 1. Zod Validation
    const { data, success, error } = usernameParamSchema.safeParse(req.params);
    if (!success) {
        throw new ZodParsingError("Invalid username parameter", "ZodError", error.message);
    }
    const { username } = data;

    // 2. Fetch User Data with Prisma Join (User + Stats + College)
    const user = await getUserDataByUsernameService(username);
    if (!user) {
        throw new UserNotFoundError("The requested user profile does not exist", "");
    }
    const userId = user.id;
    
    // Extract stats directly from the Prisma Join
    const cachedLeetcodeStats = user.leetcodeStats;
    
    if (!cachedLeetcodeStats) {
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "User profile loaded, but no LeetCode account is linked.",
            data: { user }
        });
    }

    // 3. SECURITY: Do not show stats if they haven't verified them!
    if (!cachedLeetcodeStats.isVerified) {
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "User has linked a LeetCode account but has not verified it yet.",
            data: { 
                user: { ...user, leetcodeStats: null }
            }
        });
    }

    // 4. Check 15-Minute Cache (Codolio standard)
    const lastSynced = cachedLeetcodeStats.lastSyncedAt.getTime();
    const now = Date.now();
    const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000; 

    if (now - lastSynced < FIFTEEN_MINUTES_IN_MS) {
        return res.status(200).json({
            success: true,
            status: "success",
            message: "Profile fetched successfully from cache.",
            data: { user }
        });
    }

    // 5. Cache Expired -> Fetch Fresh Profile Data
    // CRITICAL FIX: Use the actual LeetCode username, not the Clerk URL username!
    const leetcodeUserName = cachedLeetcodeStats.userName;
    const freshProfileData = await retryAfterRateLimit(fetchLeetCodeProfileData, 2000, leetcodeUserName);
    
    if (!freshProfileData) {
        console.warn(`\n⚠️ [SYNC WARNING] Profile fetch failed for ${leetcodeUserName}.`);
        await leetcodeUsernameChanged(userId);
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "LeetCode username changed or abandoned. Showing cached data.",
            data: { 
                user: { ...user, leetcodeStats: { ...cachedLeetcodeStats, hasUsernameChanged: true } }
            }
        });
    }
    
    const updatedProfileStats = await updateLeetcodeProfileOnly(userId, leetcodeUserName, freshProfileData);

    // 6. Fetch Fresh Calendar Data
    const freshCalendarData = await retryAfterRateLimit(fetchLeetcodeSubmissionCalender, 2000, leetcodeUserName);
    
    if (!freshCalendarData) {
        console.warn(`\n⚠️ [SYNC WARNING] Calendar fetch failed for ${leetcodeUserName}. Heatmap might be private.`);
        await leetcodeHeatmapPrivate(userId);
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "Profile synced, but LeetCode Heatmap is set to private.",
            data: {
                user: { ...user, leetcodeStats: { ...updatedProfileStats, isHeatmapPrivate: true } }
            }
        });
    }

    const fullyUpdatedStats = await updateLeetcodeCalendarOnly(userId, freshCalendarData);

    return res.status(200).json({
        success: true,
        status: "success",
        message: "Profile completely synced successfully.",
        data: {
            user: { ...user, leetcodeStats: fullyUpdatedStats }
        }
    });
}
