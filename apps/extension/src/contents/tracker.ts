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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { titleSlug }
      })
    });

    const lcData = await lcResponse.json();
    const question = lcData.data?.question;
    console.log(question) ;
    if (!question) return;

    chrome.storage.local.get(["ls_token"], async (res) => {
      const token = res.ls_token;
      if (!token) {
        console.log("[LeetSensei Tracker] Waiting for user to log in before syncing.");
        return;
      }
      console.log(question);
      const response = await fetch("http://localhost:3000/api/leetcode/syncQuestion", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          questionId: question.questionId,
          questionFrontendId: question.questionFrontendId, // Added this!
          questionTitle: question.title,
          questionSlug: question.titleSlug,
          content: question.content,                       // Added this!
          difficulty: question.difficulty,
          topicTags: question.topicTags                    // Added this!
        })
      });

      if (response.ok) {
        console.log(`[LeetSensei Tracker] Successfully crowdsourced: ${question.title}`);
      }
    });

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

// Cache the username between the Start and End of a submission
let activeUsername = null;

window.addEventListener("message", async (event) => {
  // Only accept messages from our own window
  if (event.source !== window) return;

  const type = event.data?.type;

  if (type === "LEETSENSEI_SUBMIT_START") {
    const slug = event.data.slug;
    console.log(`[LeetSensei Tracker] Submission started for: ${slug}. Fetching submissions...`);

    try {
      // BATCHING: We ask for the userStatus AND the submissionList in a SINGLE network request!
      const lcResponse = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query submissionList($offset: Int!, $limit: Int!, $questionSlug: String!) {
            userStatus {
              username
            }
            questionSubmissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
              submissions { id statusDisplay lang runtime memory timestamp }
            }
          }`,
          variables: { offset: 0, limit: 20, questionSlug: slug }
        })
      });

      const lcData = await lcResponse.json();

      // Save the username so we don't have to fetch it again when the submission finishes
      activeUsername = lcData.data?.userStatus?.username || null;
      const submissions = lcData.data?.questionSubmissionList?.submissions;

      if (submissions && submissions.length > 0) {
        chrome.storage.local.get(["ls_token"], async (res) => {
          const token = res.ls_token;
          if (!token) return;

          await fetch("http://localhost:3000/api/leetcode/syncPreviousSubmissions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              questionSlug: slug,
              submissions: submissions,
              leetcodeUsername: activeUsername
            })
          });
          console.log("[LeetSensei Tracker] Previous submissions synced successfully.");
        });
      }
    } catch (e) {
      console.error("[LeetSensei Tracker] Failed to sync data", e);
    }
  }

  if (type === "LEETSENSEI_SUBMIT_END") {
    const slug = event.data.slug;
    const submissionData = event.data.submissionData;
    console.log(`[LeetSensei Tracker] Submission Finished: ${slug}`, submissionData);

    // Action 2: Track current submission using the username we grabbed a few seconds ago!
    chrome.storage.local.get(["ls_token"], async (res) => {
      const token = res.ls_token;
      if (!token) return;

      await fetch("http://localhost:3000/api/leetcode/trackSubmission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          questionSlug: slug,
          leetcodeUsername: activeUsername,
          statusDisplay: submissionData.status_msg,
          runtime: submissionData.status_runtime,
          memory: submissionData.status_memory,
          code: submissionData.code,
          lang: submissionData.lang
        })
      });
      console.log("[LeetSensei Tracker] Current submission tracked successfully!");
    });
  }
});
