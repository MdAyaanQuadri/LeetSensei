import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/problems/*"]
}

let trackingTimer: NodeJS.Timeout | null = null;
let lastUrl = "";

const syncQuestion = async (titleSlug: string) => {
  try {
    const query = `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          questionFrontendId
          title
          titleSlug
          content
          difficulty
          topicTags {
              name
              slug
          }
        }
      }
    `;

    const lcResponse = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { titleSlug } })
    });

    const lcData = await lcResponse.json();
    const question = lcData.data?.question;
    
    if (!question) return;

    // Send payload to background.ts to handle auth and network request
    chrome.runtime.sendMessage({
      type: "SYNC_QUESTION",
      payload: {
        data: {
          question: {
            questionId: question.questionId,
            questionFrontendId: question.questionFrontendId,
            title: question.title,
            titleSlug: question.titleSlug,
            content: question.content,
            difficulty: question.difficulty,
            topicTags: question.topicTags
          }
        }
      }
    });

    console.log(`[LeetSensei Tracker] Sent question ${question.title} to background for syncing.`);

  } catch (error) {
    console.error("[LeetSensei Tracker] Error syncing question:", error);
  }
}

const checkUrl = () => {
  const currentUrl = window.location.href;

  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;

    if (trackingTimer) {
      clearTimeout(trackingTimer);
    }

    const match = currentUrl.match(/leetcode\.com\/problems\/([^/]+)/);
    if (match && match[1]) {
      const titleSlug = match[1];

      console.log(`[LeetSensei Tracker] Detected question: ${titleSlug}. Debouncing for 5s...`);

      trackingTimer = setTimeout(() => {
        console.log(`[LeetSensei Tracker] Dwell time reached. Syncing question: ${titleSlug}...`);
        syncQuestion(titleSlug);
      }, 5000);
    }
  }
}

// Start polling URL every 1 second
setInterval(checkUrl, 1000);

// ==========================================
// INTERCEPTOR MESSAGE LISTENER (From inject.ts)
// ==========================================

window.addEventListener("message", async (event) => {
  if (event.source !== window) return;

  const type = event.data?.type;

  if (type === "LEETSENSEI_SUBMIT_START") {
    console.log(`[LeetSensei Tracker] Submission started for: ${event.data.slug}`);
  }

  if (type === "LEETSENSEI_SUBMIT_END") {
    const slug = event.data.slug;
    const submissionId = event.data.submissionData?.submission_id;
    console.log(`[LeetSensei Tracker] Submission Finished: ${slug}. Fetching details for ID: ${submissionId}`);

    if (!submissionId) return;

    try {
      // 1. Fetch the FULL Submission Details
      const detailsQuery = `
        query submissionDetails($submissionId: Int!) {
          submissionDetails(submissionId: $submissionId) {
            runtimePercentile
            runtimeDistribution
            memoryPercentile
            memoryDistribution
            code
            timestamp
            statusCode
            user { username profile { realName userAvatar } }
            lang { name verboseName }
            question { questionId titleSlug hasFrontendPreview }
            runtimeError
            compileError
            lastTestcase
            codeOutput
            expectedOutput
            totalCorrect
            totalTestcases
            stdOutput
          }
        }
      `;

      // 2. Fetch the FULL Submission History List for this question
      const listQuery = `
        query submissionList($offset: Int!, $limit: Int!, $questionSlug: String!) {
          questionSubmissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
            lastKey
            hasNext
            submissions {
              id title titleSlug status statusDisplay lang langName
              runtime timestamp url isPending memory hasNotes notes
              flagType frontendId topicTags { name slug }
            }
          }
        }
      `;

      // Execute both queries in parallel
      const [detailsRes, listRes] = await Promise.all([
        fetch("https://leetcode.com/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: detailsQuery, variables: { submissionId: parseInt(submissionId) } })
        }),
        fetch("https://leetcode.com/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: listQuery, variables: { offset: 0, limit: 20, questionSlug: slug } })
        })
      ]);

      const detailsData = await detailsRes.json();
      const listData = await listRes.json();

      const submissionDetails = detailsData.data?.submissionDetails;
      const questionSubmissionList = listData.data?.questionSubmissionList;

      if (submissionDetails && questionSubmissionList) {
        // 3. Delegate to background.ts to attach Auth token and hit backend!
        chrome.runtime.sendMessage({
          type: "PROCESS_SUBMISSION",
          payload: {
            data: {
              submissionDetails,
              questionSubmissionList
            }
          }
        });
        console.log("[LeetSensei Tracker] Sent FULL submission payload to background.ts!");
      }

    } catch (e) {
      console.error("[LeetSensei Tracker] Failed to fetch full submission data", e);
    }
  }
});

