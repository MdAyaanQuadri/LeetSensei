const fs = require('fs');
const path = 'apps/extension/src/tracker.ts';
let content = fs.readFileSync(path, 'utf8');

const listenerStart = content.indexOf('window.addEventListener("message", async (event) => {');

const newListener = `window.addEventListener("message", async (event) => {
  // Only accept messages from our own window
  if (event.source !== window) return;

  const type = event.data?.type;
  
  // Helper to securely get the user's LeetCode username
  const fetchLeetCodeUsername = async () => {
    try {
      const identityRes = await fetch("https://leetcode.com/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: \`query globalData { userStatus { isSignedIn username } }\`
        })
      });
      const identityData = await identityRes.json();
      return identityData.data?.userStatus?.username || null;
    } catch (e) {
      console.error("[LeetSensei] Failed to fetch identity", e);
      return null;
    }
  };

  if (type === "LEETSENSEI_SUBMIT_START") {
    const slug = event.data.slug;
    console.log(\`[LeetSensei Tracker] Submission started for: \${slug}. Fetching previous submissions...\`);
    
    try {
      // Fetch LC Identity concurrently with submissions
      const [username, lcResponse] = await Promise.all([
        fetchLeetCodeUsername(),
        fetch("https://leetcode.com/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: \`query submissionList($offset: Int!, $limit: Int!, $questionSlug: String!) {
              questionSubmissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
                submissions { id statusDisplay lang runtime memory timestamp }
              }
            }\`,
            variables: { offset: 0, limit: 20, questionSlug: slug }
          })
        })
      ]);
      
      const lcData = await lcResponse.json();
      const submissions = lcData.data?.questionSubmissionList?.submissions;
      
      if (submissions && submissions.length > 0) {
        chrome.storage.local.get(["ls_token"], async (res) => {
          const token = res.ls_token;
          if (!token) return;

          await fetch("http://localhost:3000/api/leetcode/syncPreviousSubmissions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": \`Bearer \${token}\`
            },
            body: JSON.stringify({
              questionSlug: slug,
              submissions: submissions,
              leetcodeUsername: username
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
    console.log(\`[LeetSensei Tracker] Submission Finished: \${slug}\`, submissionData);

    // Fetch identity to attach to track request for security verification
    const username = await fetchLeetCodeUsername();

    // Action 2: Track current submission
    chrome.storage.local.get(["ls_token"], async (res) => {
      const token = res.ls_token;
      if (!token) return;

      await fetch("http://localhost:3000/api/leetcode/trackSubmission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": \`Bearer \${token}\`
        },
        body: JSON.stringify({
          questionSlug: slug,
          leetcodeUsername: username,
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
`;

content = content.substring(0, listenerStart) + newListener;
fs.writeFileSync(path, content);
console.log("Successfully removed heavy profile fetching, kept username matching.");
