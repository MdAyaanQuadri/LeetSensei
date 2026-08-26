import { gql, request } from 'graphql-request'

export const fetchLeetCodeProfileData = async (username: string) => {
    const url = 'https://leetcode.com/graphql/';

    const LEETCODE_PROFILE_FETCH_MASTER_QUERY = gql`
    query getLeetCodeProfileData($username : String!){
        matchedUser(username: $username) {
        profile {
            aboutMe
            ranking
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
        userCalendar {
            streak
            totalActiveDays
            submissionCalendar 
        }
        }
       
    }`;
    try{
        const data = await request(url, LEETCODE_PROFILE_FETCH_MASTER_QUERY, { username });
        return data ;
    }
    catch(error){
        return null ;
    }

    
}