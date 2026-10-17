import { createClerkClient } from '@clerk/chrome-extension/client';

const getFreshClerk = () => createClerkClient({
  publishableKey: process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
  syncHost: process.env.PLASMO_PUBLIC_FRONTEND_URL || 'http://localhost:5173',
  background: true
});

const BACKEND_URL = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

const getStoredToken = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(["ls_token"], (res) => {
      resolve(res?.ls_token || null);
    });
  });
};

const getAuthToken = async (): Promise<string | null> => {
  try {
    const clerk = await getFreshClerk();
    if (clerk && typeof clerk.load === 'function') {
      await clerk.load();
    }
    const token = await clerk.session?.getToken();
    if (token) {
      chrome.storage.local.set({ ls_loggedIn: true, ls_token: token });
      return token;
    }
  } catch (e) {
    console.warn('[LeetSensei Background] Fresh Clerk token check error:', e);
  }

  // Fallback to storage token if Clerk instance is waking up
  const stored = await getStoredToken();
  return stored;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_AUTH') {
    (async () => {
      const token = await getAuthToken();
      if (token) {
        sendResponse({ loggedIn: true, token });
      } else {
        sendResponse({ loggedIn: false });
      }
    })();
    return true; 
  }

  // Handle syncing messages
  (async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        sendResponse({ success: false, error: 'NO_TOKEN' });
        return;
      }

      if (message.type === 'SYNC_QUESTION') {
        const res = await fetch(`${BACKEND_URL}/api/leetcode/questions/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(message.payload)
        });
        const data = await res.json().catch(() => ({}));
        sendResponse({ success: res.ok, data });
      }
      
      if (message.type === 'PROCESS_SUBMISSION') {
        console.log('[LeetSensei Background] Received PROCESS_SUBMISSION from tracker.ts!');
        console.log('[LeetSensei Background] Backend URL is:', BACKEND_URL);
        console.log('[LeetSensei Background] Token exists:', !!token);
        
        try {
          const res = await fetch(`${BACKEND_URL}/api/leetcode/submissions/track`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(message.payload)
          });
          console.log('[LeetSensei Background] Fetch completed. Status:', res.status);
          const data = await res.json().catch(() => ({}));
          console.log('[LeetSensei Background] Backend Response:', data);
          sendResponse({ success: res.ok, data });
        } catch (fetchErr) {
          console.error('[LeetSensei Background] Fetch to backend FAILED entirely:', fetchErr);
          sendResponse({ success: false, error: 'FETCH_FAILED', message: (fetchErr as Error).message });
        }
      }

      if (message.type === 'LINK_ACCOUNT') {
        const res = await fetch(`${BACKEND_URL}/api/leetcode/link`, {
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
        const res = await fetch(`${BACKEND_URL}/api/leetcode/generate/verificationcode`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        sendResponse({ success: res.ok, data });
      }

      if (message.type === 'VERIFY_CODE') {
        const res = await fetch(`${BACKEND_URL}/api/leetcode/verify`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        sendResponse({ success: res.ok, data });
      }
    } catch (error) {
      console.error('[LeetSensei] Background Error:', error);
      sendResponse({ success: false });
    }
  })();
  
  return true;
});

