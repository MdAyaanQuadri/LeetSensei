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
    retryAfterRateLimitRateLimit
} from "../leetcode/leetcode.service.js" 

// user services 
import { getUserDataService } from './user.service.js'

//error
import { UserNotFoundError } from "../../errorHandler.js"

export const getMyProfile = async (req: Request, res: Response) => {
    const userId = res.locals.userId;
    
    // 1. Fetch User Data
    const user = await getUserDataService(userId);
    if (!user) {
        throw new UserNotFoundError("The requested user profile does not exist", "");
    }
    
    // 2. Fetch Cached LeetCode Stats
    const cachedLeetcodeStats = await getLeetcodeStatsDataService(userId);
    if (!cachedLeetcodeStats) {
        // Soft Error: The user exists but hasn't linked a LeetCode account yet.
        return res.status(200).json({
            success: false,
            status: "partial",
            message: "User profile loaded, but no LeetCode account is linked.",
            data: { user, leetcode: null }
        });
    }

    // 3. Check 1-Hour Cache
    const lastSynced = cachedLeetcodeStats.lastSyncedAt.getTime();
    const now = Date.now();
    const ONE_HOUR_IN_MS = 60 * 60 * 1000; 

    if (now - lastSynced < ONE_HOUR_IN_MS) {
        // Cache is fresh, return immediately!
        return res.status(200).json({
            success: true,
            status: "success",
            message: "Profile fetched successfully from cache.",
            data: { user, leetcode: cachedLeetcodeStats }
        });
    }

    // 4. Cache Expired -> Fetch Fresh Profile Data
    const username = cachedLeetcodeStats.userName;
    const freshProfileData = await retryAfterRateLimitRateLimit(fetchLeetCodeProfileData, 2000, username);
    
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
                user, 
                leetcode: { ...cachedLeetcodeStats, hasUsernameChanged: true } 
            }
        });
    }
    
    // Update DB with fresh profile stats
    const updatedProfileStats = await updateLeetcodeProfileOnly(userId, username, freshProfileData);

    // 5. Fetch Fresh Calendar Data
    const freshCalendarData = await retryAfterRateLimitRateLimit(fetchLeetcodeSubmissionCalender, 2000, username);
    
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
                user,
                leetcode: { ...updatedProfileStats, isHeatmapPrivate: true }
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
            user,
            leetcode: fullyUpdatedStats
        }
    });
}





export const getPublicProfile = (req: Request, res: Response) => {
    const { username } = req.params;
    if (!username) {
        return res.status(400).json(
            {
                success: false,
                code: "BAD_REQUEST",
                message: "THERE IS NO USERNAME PRESENT"
            }
        );
    }
}

