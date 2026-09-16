import cssText from "data-text:~style.css"
import { useEffect, useState, useRef } from "react"
import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://leetcode.com/*"]
}

export const getStyle = () => {
  const style = document.createElement("style")
  style.textContent = cssText + `
    @keyframes slideUpFade {
      0% { opacity: 0; transform: translateY(20px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideDownFade {
      0% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(20px); }
    }
    .animate-popup-enter {
      animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .animate-popup-exit {
      animation: slideDownFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `
  return style
}

let authWindow: Window | null = null;
const CLERK_SIGN_IN_URL = "https://bursting-flea-33.accounts.dev/sign-in";

console.log("[LeetSensei] Content script injected into page!");

export default function ContentOverlay() {
  console.log("[LeetSensei] Content script mounted!");
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [questionTitle, setQuestionTitle] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverRef = useRef<boolean>(false);
  const timeRemainingRef = useRef<number>(10000); // 10 seconds
  const lastTickRef = useRef<number>(0);

  // Check Auth State
  const checkAuth = () => {
    try {
      chrome.runtime.sendMessage({ type: "CHECK_AUTH" }, (response) => {
        if (!chrome.runtime.lastError && response) {
          setIsLoggedIn(response.loggedIn);
          if (response.loggedIn && authWindow && !authWindow.closed) {
             authWindow.close();
             authWindow = null;
             closePopup();
          }
        }
      });
    } catch(e) {}
  };

  useEffect(() => {
    checkAuth();
    const interval = setInterval(checkAuth, 3000);
    return () => clearInterval(interval);
  }, []);

  // Timer logic for auto-dismiss
  const startTimer = (duration: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timeRemainingRef.current = duration;
    lastTickRef.current = Date.now();

    timerRef.current = setInterval(() => {
      if (!hoverRef.current) {
        const now = Date.now();
        const delta = now - lastTickRef.current;
        timeRemainingRef.current -= delta;
        lastTickRef.current = now;

        if (timeRemainingRef.current <= 0) {
          closePopup();
        }
      } else {
        // Just update lastTick so we don't subtract hover time
        lastTickRef.current = Date.now();
      }
    }, 100);
  };

  const closePopup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setShowConfirm(false);
    }, 300);
  };

  // Poll for URL changes to detect new questions
  useEffect(() => {
    let lastUrl = "";
    
    const checkUrl = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        
        const match = currentUrl.match(/leetcode\.com\/problems\/([^/]+)/);
        if (match) console.log("[LeetSensei] Problem page detected:", match[1]);
        if (match) {
          // It's a problem page!
          setTimeout(() => {
            chrome.storage.local.get(["ls_notifications", "ls_loggedIn"], (res) => {
              // If notifications are explicitly false, DO NOT SHOW
              console.log("[LeetSensei] Storage state:", res);
              if (res.ls_notifications === false) {
                 console.log("[LeetSensei] Notifications are disabled in storage.");
                 return;
              }
              // If user is already logged in, we don't need to ask them to sign in
              if (res.ls_loggedIn === true) {
                 console.log("[LeetSensei] Hiding because ls_loggedIn is TRUE in storage.");
                 return;
              } else {
                 console.log("[LeetSensei] User is logged out (ls_loggedIn is false or undefined). Proceeding to show.");
              }

              // Extract Title
              let title = document.title.replace(" - LeetCode", "").replace("LeetCode", "").trim();
              if (!title || title.includes("Loading")) title = match[1].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              
              setQuestionTitle(title);
              console.log("[LeetSensei] Showing notification!");
              setVisible(true);
              setShowConfirm(false);
              startTimer(10000); // 10 seconds to auto-dismiss
            });
          }, 2000); // Wait 2s for page title to settle
        }
      }
    };

    const urlInterval = setInterval(checkUrl, 1000);
    return () => {
      clearInterval(urlInterval);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const disableNotifications = () => {
    chrome.storage.local.set({ ls_notifications: false });
    closePopup();
  };

  const handleSignIn = () => {
    const w = 500;
    const h = 650;
    const left = (window.screen.width / 2) - (w / 2);
    const top = (window.screen.height / 2) - (h / 2);
    authWindow = window.open(CLERK_SIGN_IN_URL, "LeetSenseiAuth", `width=${w},height=${h},top=${top},left=${left}`);
  };

  if (!visible) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 2147483647
  };

  const animClass = closing ? "animate-popup-exit" : "animate-popup-enter";

  return (
    <div 
      style={overlayStyle} 
      className={`w-[360px] bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-200 flex flex-col overflow-hidden font-sans text-gray-800 ${animClass}`}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; lastTickRef.current = Date.now(); }}
    >
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
           <div className="w-6 h-6 bg-[#2a323d] rounded flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" className="w-4 h-4">
                 <path d="M 16 58 C 16 10, 112 10, 112 58 Q 64 75 16 58 Z" fill="#ffffff" />
                 <path d="M 28 80 Q 48 98 64 82 Q 80 98 100 80 Q 80 102 64 92 Q 48 102 28 80 Z" fill="#b0b7bd" />
              </svg>
           </div>
           <span className="font-bold text-base tracking-tight text-gray-900">LeetSensei</span>
        </div>
        <button onClick={closePopup} className="text-gray-400 hover:text-gray-600 transition p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="px-5 pb-5">
        {!showConfirm ? (
          <>
            <p className="text-[15px] leading-relaxed text-gray-700 mt-2 mb-5">
              Would you like to automatically track your solution for <span className="font-semibold">"{questionTitle}"</span>?
            </p>
            <button 
              onClick={handleSignIn}
              className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white font-bold rounded-lg transition shadow-sm"
            >
              Sign In to Track
            </button>
            <div className="w-full text-center mt-3">
              <button 
                onClick={() => setShowConfirm(true)} 
                className="text-xs text-gray-500 hover:text-gray-800 underline decoration-gray-300 hover:decoration-gray-800 underline-offset-2 transition"
              >
                Don't show this again
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-gray-700 mt-2 mb-6">
              Are you sure? You won't see this pop-up again, but you can always re-enable it in the extension settings.
            </p>
            <div className="flex gap-3 w-full">
              <button 
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition"
              >
                No, keep it
              </button>
              <button 
                onClick={disableNotifications}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition shadow-sm"
              >
                Yes, disable
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
