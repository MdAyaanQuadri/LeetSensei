import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://leetcode.com/problems/*",
    "https://leetcode.com/contest/*/problems/*"
  ]
}

// ==========================================
// GLOBALS & STATE
// ==========================================
let isLoggedIn = false;
let lastProcessedTimestamp = 0;
let trackingTimer: NodeJS.Timeout | null = null;
let lastUrl = "";
let lastSyncedSlug = "";
let isFetchingSubmission = false;

// Initialize auth state on injection
chrome.storage.local.get(["ls_loggedIn"], (res) => {
  isLoggedIn = res?.ls_loggedIn === true;
});

// Real-time auth changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.ls_loggedIn) {
    const wasLoggedIn = isLoggedIn;
    isLoggedIn = changes.ls_loggedIn.newValue === true;
    
    // If user just logged in while on a problem page, sync the current question
    if (!wasLoggedIn && isLoggedIn) {
      const slug = getProblemSlug();
      if (slug) {
        syncQuestion(slug);
      }
    }
  }
});

const isUserLoggedIn = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    let resolved = false;
    const fallbackTimer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chrome.storage.local.get(["ls_loggedIn"], (res) => {
          isLoggedIn = res?.ls_loggedIn === true;
          resolve(isLoggedIn);
        });
      }
    }, 1500);

    try {
      chrome.runtime.sendMessage({ type: "CHECK_AUTH" }, (response) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(fallbackTimer);
          if (!chrome.runtime.lastError && response) {
            isLoggedIn = response.loggedIn === true;
            resolve(isLoggedIn);
          } else {
            chrome.storage.local.get(["ls_loggedIn"], (res) => {
              isLoggedIn = res?.ls_loggedIn === true;
              resolve(isLoggedIn);
            });
          }
        }
      });
    } catch {
      if (!resolved) {
        resolved = true;
        clearTimeout(fallbackTimer);
        chrome.storage.local.get(["ls_loggedIn"], (res) => {
          isLoggedIn = res?.ls_loggedIn === true;
          resolve(isLoggedIn);
        });
      }
    }
  });
};

// ==========================================
// UTILITIES
// ==========================================
const getProblemSlug = (url: string = window.location.href): string | null => {
  const match = url.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
};

const formatSlugTitle = (slug: string): string => {
  const romanNumerals = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi']);
  return slug
    .split('-')
    .map((w) => {
      const lower = w.toLowerCase();
      if (romanNumerals.has(lower)) return lower.toUpperCase();
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
};

const fetchGraphQL = async (query: string, variables: object) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
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
    // Feature 1 Guard: Do not sync questions if not logged in
    const loggedIn = await isUserLoggedIn();
    if (!loggedIn) {
      return;
    }

    const query = `
      query questionData($titleSlug: String!) {
        userStatus {
          isPremium
        }
        question(titleSlug: $titleSlug) {
          questionId questionFrontendId title titleSlug content difficulty isPaidOnly
          topicTags { name slug }
        }
      }
    `;

    const lcData = await fetchGraphQL(query, { titleSlug });
    const question = lcData?.data?.question;
    if (!question) return;

    const isQuestionPremium = question.isPaidOnly === true;
    const isUserPremium = lcData?.data?.userStatus?.isPremium === true;

    // Only sync if question is free, or if question is premium AND user is premium
    if (isQuestionPremium && !isUserPremium) {
      console.log(`[LeetSensei] Skipping sync for premium question "${titleSlug}" because user does not have LeetCode Premium.`);
      return;
    }

    // Guard: Do not save questions without valid content (no placeholders)
    if (!question.content) {
      return;
    }

    chrome.runtime.sendMessage({
      type: "SYNC_QUESTION",
      payload: { data: { question } }
    }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (response && response.success) {
        const code = response.data?.code;
        if (code === "SYNC_SUCCESS") {
          window.postMessage({ type: "SHOW_SYNC_SUCCESS", title: question.title }, "*");
        }
      } else {
        const code = response?.data?.code;
        if (response?.error === "NO_TOKEN" || code === "UNAUTHORISED" || code === "USER_NOT_FOUND") {
          return;
        }
        if (code === "ALREADY_SYNCED") {
          return;
        }
        console.warn(`[LeetSensei] Question sync skipped or unsuccessful:`, response?.error || code || response);
      }
    });
  } catch (error) {
    console.warn("[LeetSensei] Error syncing question:", error);
  }
};

const handleRouteChange = async (currentUrl: string = window.location.href) => {
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    if (trackingTimer) clearTimeout(trackingTimer);

    const slug = getProblemSlug(currentUrl);
    if (slug && slug !== lastSyncedSlug) {
      lastSyncedSlug = slug;
      const loggedIn = await isUserLoggedIn();
      if (loggedIn) {
        trackingTimer = setTimeout(() => {
          syncQuestion(slug);
        }, 5000);
      } else {
        // Event-driven: tell content.tsx to show sign-in prompt if unauthenticated
        let title = formatSlugTitle(slug);
        try {
          const query = `
            query questionTitle($titleSlug: String!) {
              question(titleSlug: $titleSlug) {
                title
              }
            }
          `;
          const lcData = await fetchGraphQL(query, { titleSlug: slug });
          if (lcData?.data?.question?.title) {
            title = lcData.data.question.title;
          }
        } catch (e) {
          // Keep title from formatSlugTitle
        }
        if (slug === lastSyncedSlug) {
          window.postMessage({ type: "SHOW_SIGN_IN_MODAL", title, slug }, "*");
        }
      }
    }
  }
};

// ==========================================
// STATUS CODES & TOLERANCE HELPERS
// ==========================================
// Final resolved LeetCode submission status codes
const FINAL_STATUS_CODES = new Set([10, 11, 12, 13, 14, 15, 20, 21]);

const isSubmissionPending = (submission: any, details?: any): boolean => {
  if (!submission) return true;

  // 1. Check isPending field in history
  const isPendingStr = String(submission.isPending ?? "").trim().toLowerCase();
  if (submission.isPending === true || isPendingStr === "pending" || isPendingStr === "evaluating") {
    return true;
  }

  // 2. Check history status code (0 or 16 means pending/evaluating in LeetCode)
  const historyCode = Number(submission.status);
  if (historyCode === 0 || historyCode === 16 || !FINAL_STATUS_CODES.has(historyCode)) {
    return true;
  }

  // 3. Check history statusDisplay
  const display = String(submission.statusDisplay ?? "").trim().toLowerCase();
  if (!display || display === "pending" || display === "evaluating") {
    return true;
  }

  // 4. Check details statusCode if available
  if (details) {
    const detailCode = Number(details.statusCode);
    if (detailCode === 0 || detailCode === 16 || !FINAL_STATUS_CODES.has(detailCode)) {
      return true;
    }
  }

  return false;
};

// ==========================================
// PHASE C & D: DATA EXTRACTION & BACKEND SYNC
// ==========================================
let lastProcessedSubmissionId = "";

const processSubmissionWithTolerance = async (slug: string, explicitSubmissionId?: number, triggerTime?: number) => {
  if (isFetchingSubmission) {
    console.log("[LeetSensei Tracker] Already processing a submission, skipping duplicate trigger.");
    return;
  }
  isFetchingSubmission = true;

  try {
    const loggedIn = await isUserLoggedIn();
    if (!loggedIn) {
      console.log("[LeetSensei Tracker] User not logged in during submission, showing sign-in modal.");
      const title = formatSlugTitle(slug);
      window.postMessage({
        type: "SHOW_SIGN_IN_MODAL",
        title,
        slug,
        _leetsensei: true
      }, "*");
      return;
    }

    const minTimestamp = (triggerTime || Math.floor(Date.now() / 1000)) - 10;
    const MAX_POLL_ATTEMPTS = 25; // 37.5s maximum judge tolerance
    const POLL_INTERVAL_MS = 1500;

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

    const detailsQuery = `
      query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
          runtime runtimeDisplay runtimePercentile runtimeDistribution
          memory memoryDisplay memoryPercentile memoryDistribution
          code timestamp statusCode runtimeError compileError lastTestcase
          codeOutput expectedOutput totalCorrect totalTestcases stdOutput
          aiJudgeMessage isCompiledLang notes flagType
          user { username profile { realName userAvatar } }
          lang { name verboseName }
          question { questionId titleSlug hasFrontendPreview }
        }
      }
    `;

    let submissionId: number | null = explicitSubmissionId || null;
    let finalSubmissionList: any = null;
    let latestSubmission: any = null;
    let submissionDetails: any = null;

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
      const listData = await fetchGraphQL(listQuery, { offset: 0, limit: 10, questionSlug: slug });
      finalSubmissionList = listData?.data?.questionSubmissionList;
      const submissions = finalSubmissionList?.submissions || [];

      if (!submissions.length) {
        console.log(`[LeetSensei Tracker] Attempt ${attempt}/${MAX_POLL_ATTEMPTS}: No submissions found yet. Waiting ${POLL_INTERVAL_MS}ms...`);
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      if (submissionId) {
        latestSubmission = submissions.find((s: any) => s.id === String(submissionId)) || submissions[0];
      } else {
        latestSubmission = submissions[0];
        const subTime = parseInt(latestSubmission?.timestamp || "0");
        // Check if latest submission is still the previous one
        if (subTime < minTimestamp && latestSubmission?.id === lastProcessedSubmissionId) {
          console.log(`[LeetSensei Tracker] Attempt ${attempt}/${MAX_POLL_ATTEMPTS}: Submission #${latestSubmission.id} is from a previous run. Waiting for new submission...`);
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          continue;
        }
        submissionId = parseInt(latestSubmission.id);
      }

      // Check if submission history indicates it's still pending/evaluating
      if (isSubmissionPending(latestSubmission)) {
        console.log(`[LeetSensei Tracker] Attempt ${attempt}/${MAX_POLL_ATTEMPTS}: Submission #${submissionId} still evaluating (status: ${latestSubmission.status}, isPending: "${latestSubmission.isPending}"). Waiting ${POLL_INTERVAL_MS}ms...`);
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      // Submission history shows evaluation is done! Now fetch full details
      const detailsData = await fetchGraphQL(detailsQuery, { submissionId });
      submissionDetails = detailsData?.data?.submissionDetails;

      if (!submissionDetails || isSubmissionPending(latestSubmission, submissionDetails)) {
        console.log(`[LeetSensei Tracker] Attempt ${attempt}/${MAX_POLL_ATTEMPTS}: Submission details #${submissionId} still pending (statusCode: ${submissionDetails?.statusCode ?? "null"}). Waiting ${POLL_INTERVAL_MS}ms...`);
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        continue;
      }

      // Both history and details are completely evaluated!
      console.log(`[LeetSensei Tracker] Submission #${submissionId} evaluated successfully! (Status: ${latestSubmission.status}, Code: ${submissionDetails.statusCode})`);
      break;
    }

    if (!submissionDetails || !finalSubmissionList || !latestSubmission || isSubmissionPending(latestSubmission, submissionDetails)) {
      console.warn(`[LeetSensei Tracker] Submission #${submissionId} evaluation timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s. Skipping to prevent recording incomplete data.`);
      return;
    }

    // Harmonize final status
    const finalCode = Number(submissionDetails.statusCode);
    latestSubmission.status = finalCode;

    // Security Guard 1: Stale submission check (within 3 minutes)
    const submissionTime = parseInt(submissionDetails.timestamp);
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - submissionTime > 180) {
      console.log("[LeetSensei Tracker] Skipping stale submission older than 3 minutes.");
      return;
    }

    // Security Guard 2: Deduplication
    if (submissionTime <= lastProcessedTimestamp || String(submissionId) === lastProcessedSubmissionId) {
      console.log("[LeetSensei Tracker] Submission already processed, skipping.");
      return;
    }
    lastProcessedTimestamp = submissionTime;
    lastProcessedSubmissionId = String(submissionId);

    // Fix Prisma compatibility field
    submissionDetails.isCompiledLang = null;

    const currentLcUsername = submissionDetails.user?.username;
    if (!currentLcUsername) {
      console.warn("[LeetSensei Tracker] No LeetCode username found on submission details.");
      return;
    }

    console.log(`[LeetSensei Tracker] Dispatching PROCESS_SUBMISSION for submission #${submissionId} (Status: ${finalCode}, @${currentLcUsername})`);

    chrome.runtime.sendMessage({
      type: "PROCESS_SUBMISSION",
      payload: { data: { submissionDetails, questionSubmissionList: finalSubmissionList } }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn("[LeetSensei Tracker] Runtime messaging error:", chrome.runtime.lastError);
        return;
      }

      console.log("[LeetSensei Tracker] Backend response received:", response);

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
          window.postMessage({
            type: "SHOW_SIGN_IN_MODAL",
            title: submissionDetails?.title || formatSlugTitle(slug),
            slug
          }, "*");
        } else {
          showToast("❌ Failed to track submission.");
        }
      }
    });

  } catch (error) {
    console.warn("[LeetSensei Tracker] Error processing submission:", error);
  } finally {
    isFetchingSubmission = false;
  }
};

// ==========================================
// PHASE B: THE SUBMISSION TRIGGER
// ==========================================
let submissionTimer: NodeJS.Timeout | null = null;

const onUserSubmitTriggered = async () => {
  const loggedIn = await isUserLoggedIn();
  const slug = getProblemSlug();
  if (!slug) return;

  if (!loggedIn) {
    const title = formatSlugTitle(slug);
    window.postMessage({ type: "SHOW_SIGN_IN_MODAL", title, slug, _leetsensei: true }, "*");
    return;
  }

  const triggerTime = Math.floor(Date.now() / 1000);
  console.log(`[LeetSensei Tracker] Submit action detected at ${triggerTime} for "${slug}". Waiting 1.5s for judge to register...`);

  if (submissionTimer) clearTimeout(submissionTimer);
  submissionTimer = setTimeout(() => {
    processSubmissionWithTolerance(slug, undefined, triggerTime);
  }, 1500);
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
      const text = submitBtn.textContent?.trim().toLowerCase() || "";
      const isSubmitAttr = submitBtn.getAttribute("data-e2e-locator") === "console-submit-button" ||
                           submitBtn.getAttribute("data-cy") === "submit-code-btn";
      const isSubmitText = text.startsWith("submit") || text.includes("submit");

      if (isSubmitAttr || isSubmitText) {
        onUserSubmitTriggered();
      }
    }
  }, true);

  // 2. Keyboard Shortcut Listener (Cmd+Enter on macOS, Ctrl+Enter on Windows/Linux)
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (window.location.href.includes("/problems/")) {
        onUserSubmitTriggered();
      }
    }
  }, true);
};

// ==========================================
// INITIALIZE EXTENSION (100% Event-Driven)
// ==========================================
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ROUTE_CHANGED") {
    handleRouteChange(message.url || window.location.href);
  }
});

window.addEventListener("popstate", () => {
  handleRouteChange(window.location.href);
});

handleRouteChange(window.location.href);
setupSubmitListeners();