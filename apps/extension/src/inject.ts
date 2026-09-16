import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/*"],
  world: "MAIN",
  run_at: "document_start"
}

// Store the most recently submitted slug so we know what question the /check/ endpoint belongs to
let lastSubmittedSlug = "";

// Deduplication cache
const processedSubmissions = new Set();

const originalXhrOpen = window.XMLHttpRequest.prototype.open;
const originalXhrSend = window.XMLHttpRequest.prototype.send;

window.XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
  (this as any)._url = url.toString();
  return originalXhrOpen.apply(this, [method, url, ...args] as any);
};

window.XMLHttpRequest.prototype.send = function(...args: any[]) {
  this.addEventListener("load", function() {
    try {
      const url = (this as any)._url;
      if (!url) return;

      // 1. Detect Submit Button Click
      if (url.includes("/submit/")) {
        // Extract title slug from url: https://leetcode.com/problems/two-sum/submit/
        const match = url.match(/leetcode\.com\/problems\/([^/]+)\/submit/);
        if (match && match[1]) {
          lastSubmittedSlug = match[1];
          // Tell our Isolated World script to fetch previous submissions (API 1)
          window.postMessage({
            type: "LEETSENSEI_SUBMIT_START",
            slug: lastSubmittedSlug
          }, "*");
        }
      }

      // 2. Detect Submission Check (Polling)
      if (url.includes("/check/")) {
        const responseText = this.responseText;
        if (!responseText) return;

        const data = JSON.parse(responseText);

        // We only care about SUCCESS states (meaning execution finished)
        // AND we explicitly ignore status_code === 16 as requested.
        if (data.state === "SUCCESS" && data.status_code !== 16) {
          
          // Deduplication check
          if (processedSubmissions.has(data.submission_id)) return;
          processedSubmissions.add(data.submission_id);

          // Tell our Isolated World script to track the submission (API 2)
          window.postMessage({
            type: "LEETSENSEI_SUBMIT_END",
            slug: lastSubmittedSlug,
            submissionData: data
          }, "*");
        }
      }
    } catch (e) {
      // Ignore parse errors safely
    }
  });

  return originalXhrSend.apply(this, args);
};

// Also patch fetch just in case LeetCode transitions submission checking to fetch
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);
  
  try {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    
    // We only need to clone and read the body if it's a submission route
    if (url && (url.includes("/submit/") || url.includes("/check/"))) {
      const clone = response.clone();
      
      if (url.includes("/submit/")) {
        const match = url.match(/leetcode\.com\/problems\/([^/]+)\/submit/);
        if (match && match[1]) {
          lastSubmittedSlug = match[1];
          window.postMessage({
            type: "LEETSENSEI_SUBMIT_START",
            slug: lastSubmittedSlug
          }, "*");
        }
      }
      
      if (url.includes("/check/")) {
        clone.json().then(data => {
          if (data.state === "SUCCESS" && data.status_code !== 16) {
            if (processedSubmissions.has(data.submission_id)) return;
            processedSubmissions.add(data.submission_id);

            window.postMessage({
              type: "LEETSENSEI_SUBMIT_END",
              slug: lastSubmittedSlug,
              submissionData: data
            }, "*");
          }
        }).catch(() => {});
      }
    }
  } catch (e) {}

  return response;
};

console.log("[LeetSensei] Interceptor injected successfully.");
