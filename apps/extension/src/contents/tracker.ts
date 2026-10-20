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
let isWaitingForSubmission = false;
let submitTimeout: NodeJS.Timeout | null = null;

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
    const timeoutId = setTimeout(() => controller.abort(), 3000);
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
// PHASE C & D: DATA EXTRACTION & BACKEND SYNC
// ==========================================
const processSubmission = async (slug: string) => {
  try {
    // Feature 2 Guard: Do not track submissions if not logged in
    const loggedIn = await isUserLoggedIn();
    if (!loggedIn) {
      return;
    }

    // 1. URL ID Extraction
    const urlMatch = window.location.href.match(/\/submissions\/(\d+)/);
    if (!urlMatch || !urlMatch[1]) {
      return;
    }
    const submissionId = parseInt(urlMatch[1]);

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
        return;
    }

    // 4. Security Guard 2: The Deduplication Check
    if (submissionTime <= lastProcessedTimestamp) {
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
      if (chrome.runtime.lastError) {
        return;
      }
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
    console.warn("[LeetSensei] Error processing submission:", error);
  } finally {
    isFetchingSubmission = false; // Release lock
  }
};

// ==========================================
// ==========================================
// PHASE B: THE SUBMISSION TRIGGER (Armed by Click / Shortcut)
// ==========================================
let submissionObserver: MutationObserver | null = null;

const stopObservingDOM = () => {
  if (submissionObserver) {
    submissionObserver.disconnect();
    submissionObserver = null;
  }
};

const startObservingDOM = () => {
  if (submissionObserver) return; // already observing

  const targetNode = document.body;
  if (!targetNode) return;
  const config = { childList: true, subtree: true };

  submissionObserver = new MutationObserver(() => {
    // Stop if we are already processing a submission
    if (isFetchingSubmission) return;

    // ONLY process if the user explicitly clicked Submit or used the shortcut!
    if (!isWaitingForSubmission) {
      stopObservingDOM();
      return;
    }

    // Ensure the URL actually has the numeric submission ID before evaluating
    const urlMatch = window.location.href.match(/\/submissions\/(\d+)/);
    if (!urlMatch || !urlMatch[1]) return;

    const resultElement = document.querySelector(
      '[data-e2e-locator="submission-result"], [data-cy="submission-result"]'
    );
    
    if (resultElement) {
      const text = resultElement.textContent || "";
      
      // Ignore intermediate states
      if (text.includes("Pending") || text.includes("Judging")) return;

      const slug = getProblemSlug();
      if (slug) {
        // Disarm trigger and disconnect observer immediately
        isWaitingForSubmission = false;
        if (submitTimeout) clearTimeout(submitTimeout);
        stopObservingDOM();

        isFetchingSubmission = true; // Lock the observer
        processSubmission(slug);
      }
    }
  });

  submissionObserver.observe(targetNode, config);
};

const armSubmissionTrigger = async () => {
  // Guard: If not logged in, show in-page sign-in nudge modal immediately
  const loggedIn = await isUserLoggedIn();
  if (!loggedIn) {
    const slug = getProblemSlug();
    const title = slug ? formatSlugTitle(slug) : undefined;
    window.postMessage({ type: "SHOW_SIGN_IN_MODAL", title, slug, _leetsensei: true }, "*");
    return;
  }

  isWaitingForSubmission = true;
  // On-Demand: Start observing DOM only during the submission window
  startObservingDOM();

  if (submitTimeout) clearTimeout(submitTimeout);
  submitTimeout = setTimeout(() => {
    if (isWaitingForSubmission) {
      isWaitingForSubmission = false;
      stopObservingDOM();
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
      const text = submitBtn.textContent?.trim().toLowerCase() || "";
      const isSubmitAttr = submitBtn.getAttribute("data-e2e-locator") === "console-submit-button" ||
                           submitBtn.getAttribute("data-cy") === "submit-code-btn";
      const isSubmitText = text.startsWith("submit") || text.includes("submit");

      if (isSubmitAttr || isSubmitText) {
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

// ==========================================
// INITIALIZE EXTENSION (100% Event-Driven)
// ==========================================
// 1. Listen for background route change notifications
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ROUTE_CHANGED") {
    stopObservingDOM();
    handleRouteChange(message.url || window.location.href);
  }
});

// 2. Listen for native browser history popstate navigation
window.addEventListener("popstate", () => {
  stopObservingDOM();
  handleRouteChange(window.location.href);
});

// 3. Initial check on content script injection
handleRouteChange(window.location.href);

setupSubmitListeners();