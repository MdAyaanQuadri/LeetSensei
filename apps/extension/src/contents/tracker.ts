import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/problems/*"]
}

// ==========================================
// GLOBALS & STATE
// ==========================================
let lastProcessedTimestamp = 0;
let trackingTimer: NodeJS.Timeout | null = null;
let lastUrl = "";
let isFetchingSubmission = false;
let isWaitingForSubmission = false;
let submitTimeout: NodeJS.Timeout | null = null;

// ==========================================
// UTILITIES
// ==========================================
const getProblemSlug = (): string | null => {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
};

const fetchGraphQL = async (query: string, variables: object) => {
  const response = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables })
  });
  return response.json();
};

const showToast = (message: string) => {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.bottom = "24px";
  toast.style.left = "24px";
  toast.style.backgroundColor = "#2a323d";
  toast.style.color = "#ffffff";
  toast.style.padding = "10px 20px";
  toast.style.borderRadius = "8px";
  toast.style.fontFamily = "sans-serif";
  toast.style.fontSize = "14px";
  toast.style.fontWeight = "bold";
  toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  toast.style.zIndex = "999999";
  toast.style.transition = "opacity 0.3s ease";
  toast.style.opacity = "0";

  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "1"; }, 10);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// ==========================================
// PHASE A: QUESTION SYNC (On Page Load)
// ==========================================
const syncQuestion = async (titleSlug: string) => {
  try {
    const query = `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId questionFrontendId title titleSlug content difficulty
          topicTags { name slug }
        }
      }
    `;

    const lcData = await fetchGraphQL(query, { titleSlug });
    const question = lcData?.data?.question;
    if (!question) return;

    chrome.runtime.sendMessage({
      type: "SYNC_QUESTION",
      payload: { data: { question } }
    }, (response) => {
      if (response && response.success) {
        const code = response.data?.code;
        if (code === "ALREADY_SYNCED") {
          console.log(`[LeetSensei] Question already in DB: ${question.title}`);
        } else if (code === "SYNC_SUCCESS") {
          console.log(`[LeetSensei] Successfully crowdsourced: ${question.title}`);
          window.postMessage({ type: "SHOW_SYNC_SUCCESS", title: question.title }, "*");
        } else {
          console.log(`[LeetSensei] Question sync response:`, response.data);
        }
      } else {
        const code = response?.data?.code;
        console.error(`[LeetSensei] Failed to sync question. Code: ${code}`, response);
      }
    });
  } catch (error) {
    console.error("[LeetSensei] Error syncing question:", error);
  }
};

const checkUrl = () => {
  const currentUrl = window.location.href;
  
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    if (trackingTimer) clearTimeout(trackingTimer);

    const slug = getProblemSlug();
    if (slug) {
      console.log(`[LeetSensei] Detected question: ${slug}. Debouncing for 5s...`);
      trackingTimer = setTimeout(() => {
        syncQuestion(slug);
      }, 5000);
    }
  }
};

// ==========================================
// PHASE C & D: DATA EXTRACTION & BACKEND SYNC
// ==========================================
const processSubmission = async (slug: string) => {
  try {
    // 1. URL ID Extraction
    const urlMatch = window.location.href.match(/\/submissions\/(\d+)/);
    if (!urlMatch || !urlMatch[1]) {
      console.warn("[LeetSensei] Could not find submission ID in URL.");
      return;
    }
    const submissionId = parseInt(urlMatch[1]);
    console.log(`[LeetSensei] Extracted Submission ID: ${submissionId}`);

    // 2. Parallel GraphQL Fetches
    const detailsQuery = `
      query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
          runtimePercentile runtimeDistribution memoryPercentile memoryDistribution
          code timestamp statusCode runtimeError compileError lastTestcase
          codeOutput expectedOutput totalCorrect totalTestcases stdOutput
          user { username profile { realName userAvatar } }
          lang { name verboseName }
          question { questionId titleSlug hasFrontendPreview }
        }
      }
    `;
    
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

    const [detailsData, listData] = await Promise.all([
        fetchGraphQL(detailsQuery, { submissionId }),
        fetchGraphQL(listQuery, { offset: 0, limit: 20, questionSlug: slug })
    ]);

    const submissionDetails = detailsData?.data?.submissionDetails;
    const questionSubmissionList = listData?.data?.questionSubmissionList;

    if (!submissionDetails || !questionSubmissionList) return;

    // 3. Security Guard 1: The History Browsing Check
    const submissionTime = parseInt(submissionDetails.timestamp);
    const currentTime = Math.floor(Date.now() / 1000);

    if (currentTime - submissionTime > 120) {
        console.log("[LeetSensei] User is viewing a historical submission. Ignoring.");
        return;
    }

    // 4. Security Guard 2: The Deduplication Check
    if (submissionTime <= lastProcessedTimestamp) {
        console.log("[LeetSensei] Submission already processed. Skipping.");
        return;
    }
    lastProcessedTimestamp = submissionTime;

    // Fix missing Prisma field
    submissionDetails.isCompiledLang = null; 

    // 5. Direct Single Submission Track Call
    const currentLcUsername = submissionDetails.user?.username;
    if (!currentLcUsername) return;

    chrome.runtime.sendMessage({
      type: "PROCESS_SUBMISSION",
      payload: { data: { submissionDetails, questionSubmissionList } }
    }, (response) => {
      console.log("[LeetSensei] PROCESS_SUBMISSION response:", response);
      if (response && response.success) {
        showToast("🚀 Submission Tracked!");
      } else {
        const code = response?.data?.code;

        if (code === "USER_NOT_LINKED") {
          window.postMessage({ type: "SHOW_LINK_MODAL", username: currentLcUsername }, "*");
        } else if (code === "USER_NOT_VERIFIED") {
          window.postMessage({ type: "SHOW_VERIFY_MODAL" }, "*");
        } else if (code === "USERNAME_MISMATCH") {
          const linkedUsername = response?.data?.linkedUsername;
          window.postMessage({
            type: "SHOW_MISMATCH_MODAL",
            currentUsername: currentLcUsername,
            linkedUsername: linkedUsername
          }, "*");
        } else if (code === "UNAUTHORISED" || code === "USER_NOT_FOUND" || response?.error === "NO_TOKEN") {
          window.postMessage({ type: "SHOW_SIGN_IN_MODAL" }, "*");
        } else {
          showToast("❌ Failed to track submission.");
        }
      }
    });

  } catch (error) {
    console.error("[LeetSensei] Error processing submission:", error);
  } finally {
    isFetchingSubmission = false; // Release lock
  }
};

// ==========================================
// PHASE B: THE SUBMISSION TRIGGER (Armed by Click / Shortcut)
// ==========================================
const armSubmissionTrigger = () => {
  console.log("[LeetSensei] Submit action detected! Arming submission listener for 30s...");
  isWaitingForSubmission = true;

  if (submitTimeout) clearTimeout(submitTimeout);
  submitTimeout = setTimeout(() => {
    if (isWaitingForSubmission) {
      console.log("[LeetSensei] Submission window timed out without result.");
      isWaitingForSubmission = false;
    }
  }, 30000);
};

const setupSubmitListeners = () => {
  // 1. Click Listener (Delegated on document to survive DOM re-renders)
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const submitBtn = target.closest(
      '[data-e2e-locator="console-submit-button"], [data-cy="submit-code-btn"], button'
    );

    if (submitBtn) {
      const text = submitBtn.textContent?.trim().toLowerCase();
      const isSubmitAttr = submitBtn.getAttribute("data-e2e-locator") === "console-submit-button" ||
                           submitBtn.getAttribute("data-cy") === "submit-code-btn";

      if (isSubmitAttr || text === "submit") {
        armSubmissionTrigger();
      }
    }
  }, true);

  // 2. Keyboard Shortcut Listener (Cmd+Enter on macOS, Ctrl+Enter on Windows/Linux)
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (window.location.href.includes("/problems/")) {
        armSubmissionTrigger();
      }
    }
  }, true);
};

const startObservingDOM = () => {
  const targetNode = document.body;
  const config = { childList: true, subtree: true };

  const observer = new MutationObserver(() => {
    // Stop if we are already processing a submission
    if (isFetchingSubmission) return;

    // ONLY process if the user explicitly clicked Submit or used the shortcut!
    if (!isWaitingForSubmission) return;

    // Make sure the URL actually has an ID to extract before wasting time
    if (!window.location.href.includes("/submissions/")) return;

    const resultElement = document.querySelector('[data-e2e-locator="submission-result"]');
    
    if (resultElement) {
      const text = resultElement.textContent || "";
      
      // Ignore intermediate states
      if (text.includes("Pending") || text.includes("Judging")) return;

      const slug = getProblemSlug();
      if (slug) {
        // Disarm trigger immediately so it only processes once per submit
        isWaitingForSubmission = false;
        if (submitTimeout) clearTimeout(submitTimeout);

        isFetchingSubmission = true; // Lock the observer
        processSubmission(slug);
      }
    }
  });

  observer.observe(targetNode, config);
};

// ==========================================
// INITIALIZE EXTENSION
// ==========================================
setInterval(checkUrl, 1000);
setupSubmitListeners();
startObservingDOM();