import cssText from "data-text:~style.css"
import { useEffect, useState, useRef } from "react"
import type { PlasmoCSConfig } from "plasmo"
import iconPng from "data-base64:../assets/icon.png"

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
const FRONTEND_URL = process.env.PLASMO_PUBLIC_FRONTEND_URL || "http://localhost:5173";

export default function ContentOverlay() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [questionTitle, setQuestionTitle] = useState("");

  // Link & Verification States
  const [showLinkFlow, setShowLinkFlow] = useState(false);
  const [linkUsername, setLinkUsername] = useState("");
  const [showVerifyFlow, setShowVerifyFlow] = useState(false);
  const [verifyStep, setVerifyStep] = useState(1);
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  // Mismatch Flow State
  const [showMismatchFlow, setShowMismatchFlow] = useState(false);
  const [mismatchLinked, setMismatchLinked] = useState("");
  const [mismatchCurrent, setMismatchCurrent] = useState("");

  // Sync Success State
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [syncSuccessTitle, setSyncSuccessTitle] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverRef = useRef<boolean>(false);
  const timeRemainingRef = useRef<number>(10000); // 10 seconds
  const lastTickRef = useRef<number>(0);

  const isNotificationsEnabled = (): Promise<boolean> => {
    return new Promise((resolve) => {
      chrome.storage.local.get(["ls_notifications"], (res) => {
        resolve(res?.ls_notifications !== false);
      });
    });
  };

  // Listen for Triggers from tracker.ts
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== window) return;
      const allowed = await isNotificationsEnabled();
      if (!allowed) return;

      if (event.data?.type === "SHOW_VERIFY_MODAL") {
        setShowVerifyFlow(true);
        setShowLinkFlow(false);
        setShowMismatchFlow(false);
        setShowSyncSuccess(false);
        setShowConfirm(false);
        setErrorMsg("");
        setVerifyStep(1);
        setVisible(true);
        if (timerRef.current) clearTimeout(timerRef.current);
      } else if (event.data?.type === "SHOW_LINK_MODAL") {
        setLinkUsername(event.data.username || "Unknown");
        setShowLinkFlow(true);
        setShowVerifyFlow(false);
        setShowMismatchFlow(false);
        setShowSyncSuccess(false);
        setShowConfirm(false);
        setVisible(true);
        if (timerRef.current) clearTimeout(timerRef.current);
      } else if (event.data?.type === "SHOW_MISMATCH_MODAL") {
        setMismatchLinked(event.data.linkedUsername || "your linked account");
        setMismatchCurrent(event.data.currentUsername || "");
        setShowMismatchFlow(true);
        setShowLinkFlow(false);
        setShowVerifyFlow(false);
        setShowSyncSuccess(false);
        setShowConfirm(false);
        setErrorMsg("");
        setVisible(true);
        if (timerRef.current) clearTimeout(timerRef.current);
      } else if (event.data?.type === "SHOW_SIGN_IN_MODAL") {
        let title = event.data?.title;
        if (!title) {
          const slug = event.data?.slug || window.location.pathname.match(/\/problems\/([^/]+)/)?.[1];
          if (slug) {
            const romanNumerals = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi']);
            title = slug
              .split('-')
              .map((w: string) => {
                const lower = w.toLowerCase();
                if (romanNumerals.has(lower)) return lower.toUpperCase();
                return w.charAt(0).toUpperCase() + w.slice(1);
              })
              .join(' ');
          }
        }
        if (title) setQuestionTitle(title);
        setShowLinkFlow(false);
        setShowVerifyFlow(false);
        setShowMismatchFlow(false);
        setShowSyncSuccess(false);
        setShowConfirm(false);
        setVisible(true);
        startTimer(10000);
      } else if (event.data?.type === "SHOW_SYNC_SUCCESS") {
        setSyncSuccessTitle(event.data.title);
        setShowSyncSuccess(true);
        setShowLinkFlow(false);
        setShowVerifyFlow(false);
        setShowMismatchFlow(false);
        setShowConfirm(false);
        setVisible(true);
        startTimer(3000); // Disappear quickly like a notification
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // LIVE Auth Check (No Shortcuts!)
  const checkAuth = async () => {
    try {
      chrome.runtime.sendMessage({ type: "CHECK_AUTH" }, async (response) => {
        if (!chrome.runtime.lastError && response?.loggedIn) {
          if (authWindow && !authWindow.closed) {
             authWindow.close();
             authWindow = null;
             closePopup();
          }
        } else if (!chrome.runtime.lastError && response?.loggedIn === false) {
          const allowed = await isNotificationsEnabled();
          if (!allowed) return;

          // Trigger 1: When we reach a problem and are unauthenticated, show the sign-in modal
          const slug = window.location.pathname.match(/\/problems\/([^/]+)/)?.[1];
          if (slug) {
            const romanNumerals = new Set(['i', 'ii', 'iii', 'iv', 'v', 'vi']);
            const title = slug
              .split('-')
              .map((w: string) => {
                const lower = w.toLowerCase();
                if (romanNumerals.has(lower)) return lower.toUpperCase();
                return w.charAt(0).toUpperCase() + w.slice(1);
              })
              .join(' ');
            setQuestionTitle(title);
            setShowLinkFlow(false);
            setShowVerifyFlow(false);
            setShowMismatchFlow(false);
            setShowSyncSuccess(false);
            setShowConfirm(false);
            setVisible(true);
            startTimer(10000);
          }
        }
      });
    } catch(e) {}
  };

  useEffect(() => {
    checkAuth(); // Check once on initial mount

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.ls_notifications) {
        if (changes.ls_notifications.newValue === false) {
          closePopup();
        }
      }
      // Reactive auth: close sign-in window & dismiss modal automatically when user logs in
      if (changes.ls_loggedIn?.newValue === true) {
        if (authWindow && !authWindow.closed) {
          authWindow.close();
          authWindow = null;
        }
        closePopup();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Timer logic for auto-dismiss using single setTimeout (Zero continuous polling)
  const startTimer = (duration: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timeRemainingRef.current = duration;
    lastTickRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      closePopup();
    }, duration);
  };

  const closePopup = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      setShowConfirm(false);
      setShowVerifyFlow(false);
      setShowLinkFlow(false);
      setShowMismatchFlow(false);
      setShowSyncSuccess(false);
      setVerifyStep(1);
      setErrorMsg("");
      setIsCopied(false);
    }, 300);
  };

  const disableNotifications = () => {
    chrome.storage.local.set({ ls_notifications: false });
    closePopup();
  };

  const handleSwitchAccount = () => {
    setIsLoading(true);
    setErrorMsg("");
    chrome.runtime.sendMessage({ type: "LINK_ACCOUNT", payload: { username: mismatchCurrent } }, (res) => {
      if (chrome.runtime.lastError) {
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      const code = res?.data?.code;
      if (res && res.success && code === "LINK_SUCCESS") {
        setShowMismatchFlow(false);
        setShowVerifyFlow(true);
        setVerifyStep(1);
      } else {
        setErrorMsg(res?.data?.message || "Failed to switch account.");
      }
    });
  };

  const handleSignIn = () => {
    const returnTo = window.location.href;
    chrome.runtime.sendMessage({ type: "START_AUTH", returnTo });
  };

  // LINK ACCOUNT LOGIC
  const handleLinkAccount = () => {
    setIsLoading(true);
    setErrorMsg("");
    chrome.runtime.sendMessage({ type: "LINK_ACCOUNT", payload: { username: linkUsername } }, (res) => {
      if (chrome.runtime.lastError) {
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      const code = res?.data?.code;
      if (res && res.success && code === "LINK_SUCCESS") {
        setShowLinkFlow(false);
        setShowVerifyFlow(true);
        setVerifyStep(1);
      } else {
        setErrorMsg(res?.data?.message || "Failed to link account.");
      }
    });
  };

  // VERIFICATION LOGIC
  const handleStartVerification = () => {
    setIsLoading(true);
    setErrorMsg("");
    chrome.runtime.sendMessage({ type: "GENERATE_CODE" }, (res) => {
      if (chrome.runtime.lastError) {
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      const code = res?.data?.code;
      if (res && res.success && (code === "CODE_GENERATED" || res.data?.verificationCode)) {
        setVerificationCode(res.data.verificationCode);
        setVerifyStep(2);
      } else {
        setErrorMsg(res?.data?.message || "Failed to generate code. Try again.");
      }
    });
  };

  const handleCopyCode = () => {
    if (!verificationCode) return;
    navigator.clipboard.writeText(verificationCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCheckVerification = () => {
    setIsLoading(true);
    setErrorMsg("");
    chrome.runtime.sendMessage({ type: "VERIFY_CODE" }, (res) => {
      if (chrome.runtime.lastError) {
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
      const code = res?.data?.code;
      if (res && res.success && code === "VERIFY_SUCCESS") {
        setVerifyStep(4);
        setTimeout(() => closePopup(), 3000);
      } else {
        if (code === "CODE_NOT_FOUND") {
          setErrorMsg("Verification code not found. Make sure you clicked 'Save' on your LeetCode profile!");
        } else if (code === "NO_CODE_GENERATED") {
          setErrorMsg("No verification code found. Please generate a code first.");
        } else if (code === "NOT_LINKED") {
          setErrorMsg("LeetCode account not linked. Please link your account first.");
        } else if (code === "BIO_FETCH_FAILED") {
          setErrorMsg("Failed to reach your LeetCode profile. Please check your username.");
        } else {
          setErrorMsg(res?.data?.message || "Verification failed. Make sure the code is saved in your LeetCode README!");
        }
      }
    });
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
      onMouseEnter={() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        hoverRef.current = true;
        const elapsed = Date.now() - lastTickRef.current;
        timeRemainingRef.current = Math.max(0, timeRemainingRef.current - elapsed);
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        lastTickRef.current = Date.now();
        if (timeRemainingRef.current > 0) {
          timerRef.current = setTimeout(() => {
            closePopup();
          }, timeRemainingRef.current);
        }
      }}
    >
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
           <img src={iconPng} alt="LeetSensei Logo" className="w-6 h-6 rounded-md shadow-sm object-cover flex-shrink-0" />
           <span className="font-bold text-base tracking-tight text-gray-900">LeetSensei</span>
        </div>
        <button onClick={closePopup} className="text-gray-400 hover:text-gray-600 transition p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="px-5 pb-5">
        
        {/* UNIFIED CONFIRMATION SCREEN */}
        {showConfirm ? (
          <div className="mt-1">
             <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2.5">
               <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
             </div>
             <h3 className="font-bold text-[17px] mb-1.5 text-center text-gray-900">Disable In-Page Alerts?</h3>
             <p className="text-[13px] text-gray-600 text-center mb-5 leading-relaxed">
               You won't see any pop-ups on LeetCode (including verification, linking, or tracking prompts). You can always re-enable them in the LeetSensei extension popup.
             </p>
             <div className="flex gap-2.5 w-full">
               <button 
                 onClick={() => setShowConfirm(false)}
                 className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition text-sm"
               >
                 Keep Alerts
               </button>
               <button 
                 onClick={disableNotifications}
                 className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition shadow-sm text-sm"
               >
                 Turn Off Alerts
               </button>
             </div>
          </div>

        /* SYNC SUCCESS NOTIFICATION */
        ) : showSyncSuccess ? (
          <div className="mt-2 text-center py-2">
             <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
               <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
             </div>
             <h3 className="font-bold text-[17px] mb-1 text-gray-900">Question Synced!</h3>
             <p className="text-[14px] text-gray-600 line-clamp-2">"{syncSuccessTitle}" is now being tracked on LeetSensei.</p>
          </div>

        /* LINK ACCOUNT FLOW */
        ) : showLinkFlow ? (
          <div className="mt-1">
             <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2.5">
               <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
             </div>
             <h3 className="font-bold text-[17px] mb-1.5 text-center text-gray-900">Submission Not Tracked</h3>
             <p className="text-[13px] text-gray-600 text-center mb-3 leading-relaxed">
               Your solution wasn't saved because your LeetCode account <span className="font-semibold text-gray-900">@{linkUsername}</span> is not linked to LeetSensei.
             </p>
             <p className="text-[13px] text-gray-700 font-medium text-center mb-4">
               Would you like to link this account?
             </p>
             {errorMsg && <p className="text-red-500 text-xs text-center mb-3 bg-red-50 p-2 rounded border border-red-100">{errorMsg}</p>}
             <div className="flex flex-col gap-2">
               <button 
                 onClick={handleLinkAccount} 
                 disabled={isLoading} 
                 className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea580c] disabled:bg-gray-400 text-white font-bold rounded-lg transition shadow-sm text-sm"
               >
                 {isLoading ? "Linking..." : "Link Now"}
               </button>
               <button 
                 onClick={closePopup} 
                 disabled={isLoading} 
                 className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition text-sm"
               >
                 I'll do it later
               </button>
             </div>
             <div className="w-full text-center mt-3">
               <button 
                 onClick={() => setShowConfirm(true)} 
                 className="text-xs text-gray-400 hover:text-gray-600 underline decoration-transparent hover:decoration-gray-300 transition"
               >
                 Don't show this again
               </button>
             </div>
          </div>

        /* VERIFICATION FLOW */
        ) : showVerifyFlow ? (
          verifyStep === 1 ? (
            <div className="mt-1">
               <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2.5">
                 <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                 </svg>
               </div>
               <h3 className="font-bold text-[17px] mb-1.5 text-center text-gray-900">Profile Not Verified</h3>
               <p className="text-[13px] text-gray-600 text-center mb-3 leading-relaxed">
                 Your solution wasn't saved because your linked LeetCode profile is not verified yet.
               </p>
               <p className="text-[13px] text-gray-700 font-medium text-center mb-4">
                 Complete a quick one-time verification to start tracking your submissions?
               </p>
               {errorMsg && <p className="text-red-500 text-xs text-center mb-3 bg-red-50 p-2 rounded border border-red-100">{errorMsg}</p>}
               <div className="flex flex-col gap-2">
                 <button 
                   onClick={handleStartVerification} 
                   disabled={isLoading} 
                   className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea580c] disabled:bg-gray-400 text-white font-bold rounded-lg transition shadow-sm text-sm"
                 >
                   {isLoading ? "Generating Code..." : "Verify Now"}
                 </button>
                 <button 
                   onClick={closePopup} 
                   disabled={isLoading} 
                   className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition text-sm"
                 >
                   I'll do it later
                 </button>
               </div>
               <div className="w-full text-center mt-3">
                  <button 
                    onClick={() => setShowConfirm(true)} 
                   className="text-xs text-gray-400 hover:text-gray-600 underline decoration-transparent hover:decoration-gray-300 transition"
                 >
                   Don't show this again
                 </button>
               </div>
            </div>
          ) : verifyStep === 2 ? (
            <div className="mt-2">
               <h3 className="font-bold text-[17px] mb-2 text-center text-gray-900">Paste verification code</h3>
               <p className="text-[14px] text-gray-600 text-center mb-4 leading-relaxed">Copy this code and paste it anywhere in your <a href="https://leetcode.com/settings/profile/" target="_blank" className="text-blue-600 hover:underline font-semibold">LeetCode README</a>.</p>
               <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-2 mb-5 items-center justify-between">
                 <span className="flex-1 font-mono font-bold text-lg text-center tracking-widest text-gray-800">{verificationCode}</span>
                 <button 
                   onClick={handleCopyCode} 
                   className={`border px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition shadow-sm ${
                     isCopied 
                       ? "bg-green-50 border-green-400 text-green-700 font-extrabold" 
                       : "bg-white border-gray-300 hover:bg-gray-50 text-gray-600"
                   }`}
                 >
                   {isCopied ? "Copied!" : "Copy"}
                 </button>
               </div>
               <button onClick={() => setVerifyStep(3)} className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white font-bold rounded-lg transition shadow-sm">
                 I've pasted the code
               </button>
            </div>
          ) : verifyStep === 3 ? (
            <div className="mt-2">
               <h3 className="font-bold text-[17px] mb-2 text-center text-gray-900">Save changes and verify</h3>
               <p className="text-[14px] text-gray-600 text-center mb-5 leading-relaxed">Make sure you clicked 'Save' on your LeetCode profile after adding the code.</p>
               {errorMsg && <p className="text-red-500 text-xs text-center mb-4 bg-red-50 p-2 rounded border border-red-100">{errorMsg}</p>}
               <button onClick={handleCheckVerification} disabled={isLoading} className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea580c] disabled:bg-gray-400 text-white font-bold rounded-lg transition shadow-sm">
                 {isLoading ? "Verifying Profile..." : "Verify LeetCode Profile"}
               </button>
               <button onClick={() => setVerifyStep(2)} className="w-full text-center mt-3 text-xs text-gray-500 hover:text-gray-800 underline decoration-transparent hover:decoration-gray-300 transition">
                 Wait, I need the code again
               </button>
            </div>
          ) : (
            <div className="mt-2 text-center py-4">
               <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                 <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
               </div>
               <h3 className="font-bold text-[17px] mb-1 text-gray-900">Successfully Verified!</h3>
               <p className="text-[14px] text-gray-600">You can now submit your code!</p>
            </div>
          )

        /* ACCOUNT MISMATCH FLOW */
        ) : showMismatchFlow ? (
          <div className="mt-1">
             <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-2.5">
               <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
               </svg>
             </div>
             <h3 className="font-bold text-[17px] mb-1.5 text-center text-gray-900">Account Mismatch</h3>
             <p className="text-[13px] text-gray-600 text-center mb-2 leading-relaxed">
               LeetSensei is linked to <span className="font-semibold text-gray-900">@{mismatchLinked}</span>, but you submitted as <span className="font-semibold text-gray-900">@{mismatchCurrent}</span> on LeetCode.
             </p>
             <p className="text-[13px] text-gray-700 font-medium text-center mb-4">
               Would you like to switch your linked account to <span className="font-bold text-[#f97316]">@{mismatchCurrent}</span>?
             </p>
             {errorMsg && <p className="text-red-500 text-xs text-center mb-3 bg-red-50 p-2 rounded border border-red-100">{errorMsg}</p>}
             <div className="flex flex-col gap-2">
               <button 
                 onClick={handleSwitchAccount} 
                 disabled={isLoading} 
                 className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea580c] disabled:bg-gray-400 text-white font-bold rounded-lg transition shadow-sm text-sm"
               >
                 {isLoading ? "Switching Account..." : `Switch to @${mismatchCurrent}`}
               </button>
               <button 
                 onClick={closePopup} 
                 disabled={isLoading} 
                 className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition text-sm"
               >
                 Keep @{mismatchLinked}
               </button>
             </div>
             <div className="w-full text-center mt-3">
               <button 
                 onClick={() => setShowConfirm(true)} 
                 className="text-xs text-gray-400 hover:text-gray-600 underline decoration-transparent hover:decoration-gray-300 transition"
               >
                 Don't show this again
               </button>
             </div>
          </div>

        /* ORIGINAL SIGN IN FLOW */
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-gray-700 mt-2 mb-5">
              Would you like to automatically track your solution{questionTitle ? <> for <span className="font-semibold">"{questionTitle}"</span></> : ""}?
            </p>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleSignIn}
                className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white font-bold rounded-lg transition shadow-sm text-sm"
              >
                Sign In to Track
              </button>
              <button 
                onClick={closePopup}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition text-sm"
              >
                I'll do it later
              </button>
            </div>
            <div className="w-full text-center mt-3">
              <button 
                onClick={() => setShowConfirm(true)} 
                className="text-xs text-gray-500 hover:text-gray-800 underline decoration-transparent hover:decoration-gray-300 transition"
              >
                Don't show this again
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
