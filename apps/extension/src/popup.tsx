import { useEffect, useState } from "react"
import {
  ClerkProvider,
  Show,
  useUser,
  useClerk
} from "@clerk/chrome-extension"
import "~style.css"
import iconPng from "data-base64:../assets/icon.png"

const PUBLISHABLE_KEY = process.env.PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
const SYNC_HOST = process.env.PLASMO_PUBLIC_CLERK_SYNC_HOST || process.env.PLASMO_PUBLIC_FRONTEND_URL || "http://localhost:5173"
const FRONTEND_URL = process.env.PLASMO_PUBLIC_FRONTEND_URL || "http://localhost:5173"

function PopupContent() {
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true)
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false)

  const toggleNotifications = () => {
    const newVal = !notificationsEnabled
    setNotificationsEnabled(newVal)
    chrome.storage.local.set({ ls_notifications: newVal })
  }

  useEffect(() => {
    chrome.storage.local.get(["ls_notifications"], (res) => {
      if (res.ls_notifications !== undefined) setNotificationsEnabled(res.ls_notifications)
    })
  }, [])

  // Sync session state to background worker and local storage
  useEffect(() => {
    if (isLoaded) {
      if (user) {
        chrome.storage.local.set({
          ls_loggedIn: true,
          ls_user: {
            id: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            fullName: user.fullName,
            username: user.username,
            imageUrl: user.imageUrl
          }
        })
      } else {
        chrome.storage.local.set({ ls_loggedIn: false })
      }
    }
  }, [isLoaded, user])

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      // Pass a noop callback so Clerk never performs window.location redirects (0% flicker)
      await signOut(() => {})
    } catch (e) {
      try {
        await signOut()
      } catch (err) {}
    }

    chrome.storage.local.set({ ls_loggedIn: false })
    chrome.storage.local.remove(["ls_token", "ls_user", "ls_stats", "ls_last_fetch"])
    chrome.runtime.sendMessage({ type: "LOGOUT" })
    setIsSigningOut(false)
  }

  const openDashboard = () => {
    chrome.tabs.create({ url: FRONTEND_URL })
  }

  const handleSignIn = () => {
    chrome.runtime.sendMessage({ type: "START_AUTH" });
    window.close();
  }

  return (
    <div className="w-[340px] bg-zinc-950 text-white p-5 flex flex-col font-sans select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <img src={iconPng} alt="LeetSensei Logo" className="w-8 h-8 rounded-lg shadow-sm flex-shrink-0" />
          <div>
            <h1 className="text-sm font-bold tracking-tight text-zinc-100">LeetSensei</h1>
            <p className="text-[10px] text-zinc-400">LeetCode Tracker</p>
          </div>
        </div>

        <div>
          <Show when="signed-in">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          </Show>
          <Show when="signed-out">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700/50">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
              Offline
            </span>
          </Show>
        </div>
      </div>

      {/* Main Content Area */}
      <Show when="signed-in">
        <div className="py-4 flex flex-col gap-4">
          {/* User Details */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                Active Session
              </p>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                title="Sign out of LeetSensei"
                className="text-[10px] text-zinc-400 hover:text-red-400 disabled:opacity-50 transition cursor-pointer flex items-center gap-1 font-semibold bg-zinc-800/90 hover:bg-zinc-800 px-2.5 py-1 rounded-md border border-zinc-700/60"
              >
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>{isSigningOut ? "Signing out..." : "Sign out"}</span>
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              {user?.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName || "User Avatar"}
                  className="w-10 h-10 rounded-full object-cover border border-zinc-700 shadow-sm flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-orange-400 flex-shrink-0">
                  {(user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-100 truncate">
                  {user?.fullName || user?.username || "Logged In User"}
                </p>
                {user?.primaryEmailAddress?.emailAddress && (
                  <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                    {user.primaryEmailAddress.emailAddress}
                  </p>
                )}
              </div>
            </div>
            <p className="text-[10px] text-emerald-400/90 mt-2.5 pt-2 border-t border-zinc-800/50 flex items-center gap-1 font-medium">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Automatic submission tracking is armed</span>
            </p>
          </div>

          {/* In-Page Notification Slider */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-zinc-200">In-Page Alerts</span>
              <span className="text-[10px] text-zinc-400">Show alerts on LeetCode</span>
            </div>
            <button
              onClick={toggleNotifications}
              type="button"
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                notificationsEnabled ? "bg-emerald-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  notificationsEnabled ? "translate-x-4.5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Dashboard Button */}
          <div className="pt-1">
            <button
              onClick={openDashboard}
              className="w-full py-2 px-3 bg-white hover:bg-zinc-100 text-black text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>Open Web Dashboard</span>
              <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </div>
      </Show>

      <Show when="signed-out">
        <div className="py-4 flex flex-col gap-3">
          <div className="text-center py-1">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Sign in to automatically sync your solved questions and progress directly to your dashboard.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSignIn}
              className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold rounded-lg transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Sign In with LeetSensei</span>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>

          {/* In-Page Notification Slider */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between mt-1">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-zinc-200">In-Page Alerts</span>
              <span className="text-[10px] text-zinc-400">Show alerts on LeetCode</span>
            </div>
            <button
              onClick={toggleNotifications}
              type="button"
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                notificationsEnabled ? "bg-emerald-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  notificationsEnabled ? "translate-x-4.5" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </Show>

      {/* Footer */}
      <div className="pt-3 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-400">
        <span>LeetSensei v0.0.1</span>
        <span>Clerk syncHost Connected</span>
      </div>
    </div>
  )
}

export default function IndexPopup() {
  if (!PUBLISHABLE_KEY) {
    return (
      <div className="w-[320px] p-4 bg-zinc-950 text-red-400 text-xs text-center">
        Missing PLASMO_PUBLIC_CLERK_PUBLISHABLE_KEY
      </div>
    )
  }

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      syncHost={SYNC_HOST}
      __experimental_syncHostListener={true}
    >
      <PopupContent />
    </ClerkProvider>
  )
}
