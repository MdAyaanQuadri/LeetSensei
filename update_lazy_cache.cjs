const fs = require('fs');
const path = 'apps/backend/src/modules/leetcode/leetcode.service.ts';
let content = fs.readFileSync(path, 'utf8');

const oldFunc = `export const getLeetcodeStatsDataService = async (userId: string) => {
    const leetCodeStatsData = await prisma.leetCodeStats.findUnique({
        where: { userId: userId }
    });
    return leetCodeStatsData;
}`;

const newFunc = `export const getLeetcodeStatsDataService = async (userId: string) => {
    let leetCodeStatsData = await prisma.leetCodeStats.findUnique({
        where: { userId: userId }
    });

    if (!leetCodeStatsData || !leetCodeStatsData.userName) {
        return leetCodeStatsData;
    }

    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const now = new Date();
    
    // Check if data is stale (lazy caching)
    if (!leetCodeStatsData.lastSyncedAt || (now.getTime() - leetCodeStatsData.lastSyncedAt.getTime() > TWO_HOURS_MS)) {
        try {
            console.log(\`[LeetSensei] Lazy cache expired for \${leetCodeStatsData.userName}. Fetching fresh data...\`);
            
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
                console.log(\`[LeetSensei] Successfully updated lazy cache for \${leetCodeStatsData.userName}\`);
            }
        } catch (e) {
            console.error("[LeetSensei] Failed to lazy-update LeetCode stats", e);
            // If it fails, just return the stale data as a fallback!
        }
    }

    return leetCodeStatsData;
}`;

content = content.replace(oldFunc, newFunc);
fs.writeFileSync(path, content);
console.log("Successfully injected the 2-hour lazy caching logic into the backend!");
