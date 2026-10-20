import { createClerkClient } from '@clerk/chrome-extension/client';

const SYNC_HOST = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST || process.env.PLASMO_PUBLIC_FRONTEND_URL || 'http://localhost:5173';
const FRONTEND_URL = process.env.PLASMO_PUBLIC_FRONTEND_URL || 'http://localhost:5173';

let authWindowId: number | null = null;

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === authWindowId) {
    authWindowId = null;
  }
});

const getFreshClerk = () => createClerkClient({
  publishableKey: process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
  syncHost: SYNC_HOST,
  background: true
} as any);

const BACKEND_URL = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

const getStoredAuth = async (): Promise<{ loggedIn: boolean; token: string | null; user?: any }> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(["ls_token", "ls_user", "ls_loggedIn"], (res) => {
      resolve({
        loggedIn: res?.ls_loggedIn === true && !!res?.ls_token,
        token: res?.ls_token || null,
        user: res?.ls_user || null
      });
    });
  });
};

const syncAuthState = async (): Promise<{ loggedIn: boolean; token: string | null; user?: any }> => {
  try {
    const clerk = await getFreshClerk();
    if (clerk && typeof clerk.load === 'function') {
      await clerk.load();
    }
    const token = await clerk.session?.getToken();
    const user = clerk.user ? {
      id: clerk.user.id,
      email: clerk.user.primaryEmailAddress?.emailAddress,
      fullName: clerk.user.fullName,
      firstName: clerk.user.firstName,
      username: clerk.user.username,
      imageUrl: clerk.user.imageUrl
    } : null;

    if (token) {
      if (authWindowId) {
        chrome.windows.remove(authWindowId).catch(() => {});
        authWindowId = null;
      }

      chrome.storage.local.set({
        ls_loggedIn: true,
        ls_token: token,
        ...(user ? { ls_user: user } : {})
      });
      return { loggedIn: true, token, user };
    } else {
      // User is logged out on the web app: purge stored auth
      chrome.storage.local.set({ ls_loggedIn: false });
      chrome.storage.local.remove([
        "ls_token",
        "ls_user",
        "ls_stats",
        "ls_last_fetch"
      ]);
      return { loggedIn: false, token: null, user: null };
    }
  } catch (e) {
    console.warn('[LeetSensei Background] Clerk auth sync error:', e);
    // On unexpected network or transient Clerk error, fall back to stored auth
    const stored = await getStoredAuth();
    if (stored.loggedIn && stored.token) {
      return stored;
    }
    return { loggedIn: false, token: null, user: null };
  }
};

const getAuthToken = async (): Promise<string | null> => {
  // First check if stored token is already present
  const stored = await getStoredAuth();
  if (stored.token) {
    return stored.token;
  }

  // If no stored token, attempt to sync from Clerk
  const state = await syncAuthState();
  return state.token;
};

const CLERK_AUTH_COOKIES = new Set(['__session', '__client_uat', '__clerk_db_jwt', '__client']);

// Reactively detect login / logout across web app tabs via cookie changes
let cookieDebounce: NodeJS.Timeout | null = null;
chrome.cookies.onChanged.addListener((changeInfo) => {
  // Ignore transient overwrite events when cookies are refreshed/rotated
  if (changeInfo.cause === 'overwrite') {
    return;
  }
  const cookieName = changeInfo.cookie?.name || '';
  if (!CLERK_AUTH_COOKIES.has(cookieName)) {
    return;
  }

  const domain = changeInfo.cookie?.domain || '';
  if (domain.includes('localhost') || domain.includes('clerk') || domain.includes('accounts.dev')) {
    if (cookieDebounce) clearTimeout(cookieDebounce);
    cookieDebounce = setTimeout(() => {
      syncAuthState();
    }, 500);
  }
});

// Event-driven URL change detection: notify content scripts on navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
  if (changeInfo.url && changeInfo.url.includes("leetcode.com")) {
    chrome.tabs.sendMessage(tabId, {
      type: "ROUTE_CHANGED",
      url: changeInfo.url
    }).catch(() => {});
  }
});

const SYNC_MESSAGE_TYPES = [
  'SYNC_QUESTION',
  'PROCESS_SUBMISSION',
  'LINK_ACCOUNT',
  'GENERATE_CODE',
  'VERIFY_CODE'
] as const;

type SyncMessageType = typeof SYNC_MESSAGE_TYPES[number];

const isSyncMessageType = (type: string): type is SyncMessageType => {
  return (SYNC_MESSAGE_TYPES as readonly string[]).includes(type);
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START_AUTH') {
    (async () => {
      let returnTo: string | null = null;

      // If message explicitly provided returnTo, use it
      if (message.returnTo) {
        returnTo = message.returnTo;
      } else {
        // Otherwise, inspect currently active tab to see if user is on LeetCode
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeUrl = tabs[0]?.url || '';
          if (activeUrl.includes('leetcode.com')) {
            returnTo = activeUrl;
          }
        } catch (e) {}
      }

      const url = returnTo
        ? `${FRONTEND_URL}/?mode=popup&return_to=${encodeURIComponent(returnTo)}`
        : `${FRONTEND_URL}/?mode=popup`;

      const w = 500;
      const h = 650;

      try {
        const currWin = await chrome.windows.getCurrent();
        const left = Math.round((currWin.left || 0) + ((currWin.width || 1200) - w) / 2);
        const top = Math.round((currWin.top || 0) + ((currWin.height || 800) - h) / 2);

        if (authWindowId) {
          await chrome.windows.remove(authWindowId).catch(() => {});
          authWindowId = null;
        }

        const win = await chrome.windows.create({
          url,
          type: 'popup',
          width: w,
          height: h,
          left: Math.max(0, left),
          top: Math.max(0, top),
          focused: true
        });

        authWindowId = win.id || null;
        sendResponse({ success: true, windowId: win.id });
      } catch (e) {
        chrome.tabs.create({ url });
        sendResponse({ success: true, fallbackTab: true });
      }
    })();
    return true;
  }

  if (message.type === 'OPEN_SIGN_IN') {
    const returnTo = message.returnTo;
    const url = returnTo ? `${FRONTEND_URL}/?return_to=${encodeURIComponent(returnTo)}` : FRONTEND_URL;
    chrome.tabs.create({ url });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CHECK_AUTH') {
    (async () => {
      const state = await syncAuthState();
      sendResponse(state);
    })();
    return true; 
  }

  if (message.type === 'LOGOUT') {
    (async () => {
      try {
        const clerk = await getFreshClerk();
        await clerk.signOut?.();
      } catch (e) {}

      // Clear Clerk session cookies across domains to ensure clean logout
      const domains = ['localhost', 'accounts.dev', 'clerk.accounts.dev', 'clerk.com'];
      for (const d of domains) {
        try {
          const cookies = await chrome.cookies.getAll({ domain: d });
          for (const c of cookies) {
            const protocol = c.secure ? 'https:' : 'http:';
            const cookieUrl = `${protocol}//${c.domain.startsWith('.') ? c.domain.slice(1) : c.domain}${c.path}`;
            await chrome.cookies.remove({ url: cookieUrl, name: c.name }).catch(() => {});
          }
        } catch (e) {}
      }

      chrome.storage.local.set({ ls_loggedIn: false });
      chrome.storage.local.remove([
        "ls_token",
        "ls_user",
        "ls_stats",
        "ls_last_fetch"
      ]);
      sendResponse({ success: true });
    })();
    return true;
  }

  // Handle syncing messages
  if (isSyncMessageType(message.type)) {
    (async () => {
      try {
        let token = await getAuthToken();
        if (!token) {
          sendResponse({ success: false, error: 'NO_TOKEN' });
          return;
        }

        // Helper to perform fetch with 401 token refresh retry
        const fetchWithRetry = async (url: string, options: RequestInit): Promise<Response> => {
          let res = await fetch(url, options);
          if (res.status === 401) {
            try {
              const clerk = await getFreshClerk();
              if (clerk && typeof clerk.load === 'function') {
                await clerk.load();
              }
              const freshToken = await clerk.session?.getToken();
              if (freshToken) {
                token = freshToken;
                chrome.storage.local.set({ ls_loggedIn: true, ls_token: token });
                const updatedHeaders = {
                  ...(options.headers || {}),
                  'Authorization': `Bearer ${token}`
                };
                res = await fetch(url, { ...options, headers: updatedHeaders });
              } else {
                chrome.storage.local.set({ ls_loggedIn: false });
                chrome.storage.local.remove([
                  "ls_token",
                  "ls_user",
                  "ls_stats",
                  "ls_last_fetch"
                ]);
              }
            } catch (e) {
              console.warn('[LeetSensei Background] Token refresh failed:', e);
            }
          }
          return res;
        };

        if (message.type === 'SYNC_QUESTION') {
          try {
            const res = await fetchWithRetry(`${BACKEND_URL}/api/leetcode/questions/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(message.payload)
            });
            const data = await res.json().catch(() => ({}));
            sendResponse({ success: res.ok, data });
          } catch (fetchErr) {
            sendResponse({ success: false, error: 'FETCH_FAILED', message: (fetchErr as Error).message });
          }
        }
        
        if (message.type === 'PROCESS_SUBMISSION') {
          try {
            const res = await fetchWithRetry(`${BACKEND_URL}/api/leetcode/submissions/track`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(message.payload)
            });
            const data = await res.json().catch(() => ({}));
            sendResponse({ success: res.ok, data });
          } catch (fetchErr) {
            console.error('[LeetSensei Background] Fetch to backend FAILED entirely:', fetchErr);
            sendResponse({ success: false, error: 'FETCH_FAILED', message: (fetchErr as Error).message });
          }
        }

        if (message.type === 'LINK_ACCOUNT') {
          const res = await fetchWithRetry(`${BACKEND_URL}/api/leetcode/link`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ leetCodeUsername: message.payload.username })
          });
          const data = await res.json().catch(() => ({}));
          sendResponse({ success: res.ok, data });
        }

        if (message.type === 'GENERATE_CODE') {
          const res = await fetchWithRetry(`${BACKEND_URL}/api/leetcode/generate/verificationcode`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json().catch(() => ({}));
          sendResponse({ success: res.ok, data });
        }

        if (message.type === 'VERIFY_CODE') {
          const res = await fetchWithRetry(`${BACKEND_URL}/api/leetcode/verify`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json().catch(() => ({}));
          sendResponse({ success: res.ok, data });
        }
      } catch (error) {
        console.warn('[LeetSensei] Background Error:', error);
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  // Unknown message - do not keep port open
  return false;
});

