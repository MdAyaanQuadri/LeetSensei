import { gql, request } from 'graphql-request'
import crypto from "crypto";
// db 
import prisma from '../../config/db';


//error

import { RateLimitError } from '../../errorHandler.js'


export const fetchLeetCodeProfileData = async (username: string) => {
    const url = 'https://leetcode.com/graphql/';

    const LEETCODE_PROFILE_FETCH_MASTER_QUERY = gql`
    query getLeetCodeProfileData($username : String!){
        matchedUser(username: $username) {
        profile {
            ranking
            userAvatar
        }
        badges {
            name
            icon
        }
        submitStats: submitStatsGlobal {
            acSubmissionNum {
            difficulty
            count
            }
        }
        tagProblemCounts {
            fundamental { tagName problemsSolved }
            intermediate { tagName problemsSolved }
            advanced { tagName problemsSolved }
        }
        
        # Calendar and Heatmap Data! ---
        
        }
    }`;
    try {
        const data = await request(url, LEETCODE_PROFILE_FETCH_MASTER_QUERY, { username });
        return data;
    }
    catch (error: any) {
        if (error.response?.status === 429) {
            throw new RateLimitError("LeetCode rate limit hit", `username: ${username}`);
        }
        return null;
    }
}

export const fetchLeetcodeSubmissionCalender = async (username: string) => {
    const url = 'https://leetcode.com/graphql/';

    const LEETCODE_SUBMISSION_CALENDER_MASTER_QUERY = gql`
        query getLeetCodeSubmissionCalender($username : String!){
            matchedUser(username: $username) {
            userCalendar {
                streak
                totalActiveDays
                submissionCalendar 
                    }
                }
            }`;
    try {
        const data = await request(url, LEETCODE_SUBMISSION_CALENDER_MASTER_QUERY, { username });
        return data;
    }
    catch (error: any) {
        if (error.response?.status === 429) {
            throw new RateLimitError("LeetCode rate limit hit", `username: ${username}`);
        }
        return null;
    }
}



// Formats Profile Stats
export const buildProfileStats = (username: string, profileData: any) => {
    const matchedUser = profileData.matchedUser;
    const submissions = matchedUser.submitStats.acSubmissionNum;
    const getCount = (diff: string) => submissions.find((s: any) => s.difficulty === diff)?.count || 0;

    return {
        userName: username,
        avatarUrl: matchedUser.profile?.userAvatar || "https://assets.leetcode.com/users/60CEHKApAV/avatar_1787777711.png",
        totalQuestionsSolved: getCount("All"),
        easyQuestionsSolved: getCount("Easy"),
        mediumQuestionsSolved: getCount("Medium"),
        hardQuestionsSolved: getCount("Hard"),
        globalRank: matchedUser.profile?.ranking ?? 5000001,
        badges: matchedUser.badges || [],
        fundamentalTag: matchedUser.tagProblemCounts?.fundamental || [],
        intermediateTag: matchedUser.tagProblemCounts?.intermediate || [],
        advancedTag: matchedUser.tagProblemCounts?.advanced || [],
    };
};

//  Formats Calendar Data
export const buildCalendarStats = (calenderData: any) => {
    const rawCalendarString = calenderData?.matchedUser?.userCalendar?.submissionCalendar || "{}";
    const submissionHeatMap = typeof rawCalendarString === 'string'
        ? JSON.parse(rawCalendarString)
        : rawCalendarString;

    return {
        activeDays: calenderData?.matchedUser?.userCalendar?.totalActiveDays || 0,
        currentStreak: calenderData?.matchedUser?.userCalendar?.streak || 0,
        submissionHeatMap: submissionHeatMap,
    };
};



// Full Update 
export const createAndUpdateLeetcodeProfile = async (userId: string, username: string, leetcodeProfileData: unknown, leetcodeProfileSubmissionData: unknown) => {
    const statsData = buildProfileStats(username, leetcodeProfileData);
    const calendarStats = buildCalendarStats(leetcodeProfileSubmissionData);

    const combinedData = { ...statsData, ...calendarStats };

    return await prisma.leetCodeStats.upsert({
        where: { userId: userId },
        update: {
            hasUsernameChanged: false,
            ...combinedData
        },
        create: {
            userId: userId,
            ...combinedData
        }
    });
};

export const getLeetcodeStatsDataService = async (userId: string) => {
    let leetCodeStatsData = await prisma.leetCodeStats.findUnique({
        where: { userId: userId }
    });

    if (!leetCodeStatsData || !leetCodeStatsData.userName) {
        return leetCodeStatsData;
    }

    const TWO_HOURS_MS = 2 * 1000; // REDUCED TO 2 SECONDS FOR TESTING!
    const now = new Date();
    
    // Check if data is stale (lazy caching)
    if (!leetCodeStatsData.lastSyncedAt || (now.getTime() - leetCodeStatsData.lastSyncedAt.getTime() > TWO_HOURS_MS)) {
        try {
            console.log(`[LeetSensei] Lazy cache expired for ${leetCodeStatsData.userName}. Fetching fresh data...`);
            
            // 1. Fetch fresh data from LeetCode
            const [profileData, calendarData] = await Promise.all([
                fetchLeetCodeProfileData(leetCodeStatsData.userName),
                fetchLeetcodeSubmissionCalender(leetCodeStatsData.userName)
            ]);

            if (profileData && calendarData) {
                // 2. Build the stats using your existing helpers
                const newProfileStats = buildProfileStats(leetCodeStatsData.userName, profileData);
                const newCalendarStats = buildCalendarStats(calendarData);
                
                // 3. Combine and update DB
                const combinedData = {
                    ...newProfileStats,
                    ...newCalendarStats,
                    lastSyncedAt: now
                };

                leetCodeStatsData = await prisma.leetCodeStats.update({
                    where: { userId: userId },
                    data: combinedData
                });
                console.log(`[LeetSensei] Successfully updated lazy cache for ${leetCodeStatsData.userName}`);
            }
        } catch (e) {
            console.error("[LeetSensei] Failed to lazy-update LeetCode stats", e);
            // If it fails, just return the stale data as a fallback!
        }
    }

    return leetCodeStatsData;
}
// export const getLeetcodeStatsDataByusernameService = async (username: string) => {
//     const leetCodeStatsData = await prisma.leetCodeStats.findUnique({
//         where: { userName: username }
//     });
//     console.log(leetCodeStatsData);
//     return leetCodeStatsData;
// }

export const leetcodeUsernameChanged = async (userId: string) => {
    await prisma.leetCodeStats.update({
        where: { userId },
        data: {
            hasUsernameChanged: true,
            isVerified: false
        }
    });
}

export const leetcodeHeatmapPrivate = async (userId: string) => {
    await prisma.leetCodeStats.update({
        where: { userId },
        data: { isHeatmapPrivate: true }
    });
}

export const updateLeetcodeProfileOnly = async (userId: string, username: string, leetcodeProfileData: unknown) => {
    const statsData = buildProfileStats(username, leetcodeProfileData);
    return await prisma.leetCodeStats.update({
        where: { userId },
        data: statsData
    });
};

export const updateLeetcodeCalendarOnly = async (userId: string, leetcodeProfileSubmissionData: unknown) => {
    const calendarStats = buildCalendarStats(leetcodeProfileSubmissionData);
    return await prisma.leetCodeStats.update({
        where: { userId },
        data: calendarStats
    });
};

export const fetchUsersBioService = async (username: string) => {
    const url = 'https://leetcode.com/graphql/';
    const LEETCODE_BIO_FETCHING_QUERY = gql`
        query getLeetcodeUserBio($username : String!){
            matchedUser(username: $username){
                profile {
                    aboutMe
                }
            }
        }
    `

    try {
        const data = await request(url, LEETCODE_BIO_FETCHING_QUERY, { username });
        return data;
    }
    catch (error: any) {
        if (error.response?.status === 429) {
            throw new RateLimitError("LeetCode rate limit hit", `username: ${username}`);
        }
        return null;
    }
}

export const genrateAndSaveVerificationId = async (userId: string) => {
    const shortCode = crypto.randomBytes(3).toString("hex");
    const verificationCode = `LS-${shortCode}`;
    await prisma.leetCodeStats.update({
        where: { userId },
        data: { verificationCode }
    });
    return verificationCode;
}

export const verifiedLeetcodeAccount = async (userId: string, username: string) => {
    // 1. Make the current user the true owner
    await prisma.leetCodeStats.update({
        where: { userId },
        data: {
            isVerified: true,
            verificationCode: null // Wipe code after successful verification
        }
    });

    // 2. Strip verification from anyone else claiming this username
    await prisma.leetCodeStats.updateMany({
        where: {
            userName: username,
            userId: { not: userId }
        },
        data: {
            isVerified: false
        }
    });
}

export const retryAfterRateLimitRateLimit = async (
    fetchData: (username: string) => Promise<any>,
    ms: number,
    username: string
) => {
    try {
        const data = await fetchData(username);
        return data;
    } catch (err) {
        if (err instanceof RateLimitError) {
            await new Promise(resolve => setTimeout(resolve, ms));
            const data = await fetchData(username);
            return data;
        }
        return null;
    }
}
