import { createClerkClient } from '@clerk/chrome-extension/client';

const getFreshClerk = () => createClerkClient({
  publishableKey: process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
  syncHost: process.env.PLASMO_PUBLIC_FRONTEND_URL || 'http://localhost:5173',
  background: true
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_AUTH') {
    (async () => {
      try {
        // ALWAYS create a fresh client to completely bypass Clerk's broken background caching.
        // This guarantees it perfectly detects both Log Ins AND Log Outs instantly.
        const clerk = await getFreshClerk();
        const token = await clerk.session?.getToken();
        
        if (token) {
          sendResponse({ loggedIn: true, token });
        } else {
          sendResponse({ loggedIn: false });
        }
      } catch (e) {
        sendResponse({ loggedIn: false });
      }
    })();
    return true; 
  }

  // Handle syncing messages
  (async () => {
    try {
      const clerk = await getFreshClerk();
      const token = await clerk.session?.getToken();
      if (!token) return;

      if (message.type === 'SYNC_QUESTION') {
        await fetch('http://localhost:3000/api/leetcode/questions/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(message.payload)
        });
      }
      
      if (message.type === 'PROCESS_SUBMISSION') {
        await fetch('http://localhost:3000/api/leetcode/submissions/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(message.payload)
        });
      }
    } catch (error) {
      console.error('[LeetSensei] Background Error:', error);
    }
  })();
  
  return true;
});
