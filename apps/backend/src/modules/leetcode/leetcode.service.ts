import { gql, request } from 'graphql-request'
import crypto from "crypto";
// db 
import prisma from '../../config/db';


//error

import { RateLimitError } from '../../errorHandler.js'

// types 
import type { 
    QuestionSyncData,
    submissionDetailsData ,
    submissionHistoryItemData
    } from "./leetcode.validation.js"

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
export const buildProfileStats = (username: string , profileData: any) => {
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
    const leetCodeStatsData = await prisma.leetCodeStats.findUnique({
        where: { userId: userId }
    });
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

export const retryAfterRateLimit = async (
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

export const fetchQuestions = async (titleSlug: string) => {
    const data = await prisma.question.findUnique({
        where: {
            titleSlug
        }
    })
    return data;
}
export const createQuestions = async (questionSyncData: QuestionSyncData) => {
    const question = questionSyncData.data.question;
    const data = await prisma.question.create({
    data: {
        questionId: question.questionId,
        questionFrontendId : question.questionFrontendId ,
        title: question.title,
        titleSlug: question.titleSlug,
        content: question.content,
        difficulty: question.difficulty,
        topicTags: {
            // Still creates the tag if LeetCode invents a new one!
            connectOrCreate: question.topicTags.map(tag => ({
                where: { slug: tag.slug },
                create: { name: tag.name, slug: tag.slug }
            }))
        }
    }
});

return data;
}

export const createAndUpdateSubmissionHistory = async (submissionHistorydata : submissionHistoryItemData[],userId : string) => {
    await prisma.submissionHistory.createMany({
        data: submissionHistorydata.map(
            history =>(
                {
                    submissionId : history.id ,
                    userId : userId ,
                    questionSlug : history.titleSlug ,
                    statusDisplay : history.statusDisplay ,
                    status : history.status ,
                    lang : history.lang ,
                    langName : history.langName ,
                    runtime : history.runtime ,
                    memory : history.memory ,
                    timestamp : history.timestamp ,
                    frontendId : history.frontendId 
                }
            )
        ),
        skipDuplicates: true
    })
}

export const createSubmissionDetails = async  (submission : submissionDetailsData , submissionId : string, previouslySolved : boolean )=>{
        await prisma.submission.create({
            data : {
                submissionId : submissionId ,
                runtimePercentile : submission.runtimePercentile ,
                runtimeDistribution : submission.runtimeDistribution ,
                memoryPercentile : submission.memoryPercentile ,
                memoryDistribution : submission.memoryDistribution ,
                code : submission.code ,
                timestamp : submission.timestamp ,
                runtimeError : submission.runtimeError ,
                compileError : submission.compileError ,
                lastTestcase : submission.lastTestcase ,
                expectedOutput : submission.expectedOutput ,
                codeOutput : submission.codeOutput ,
                totalCorrect : submission.totalCorrect ,
                totalTestcases : submission.totalTestcases ,
                stdOutput : submission.stdOutput ,
                previouslySolved : previouslySolved 
            }
        })
}


export const getQuestionBySlug = async (slug : string) => {
    const questionData = await prisma.question.findUnique({
        where : {
            titleSlug : slug 
        }
    })
    return questionData ;
}

export const updateLeetcodeStats = async (userId : string,previouslySolved :boolean,status: number ,timeStamp : number , difficulty : string) => {
    
}