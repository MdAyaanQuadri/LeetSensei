import { useEffect, useState } from "react"
import "~style.css"

let authWindow: Window | null = null;
const CLERK_SIGN_IN_URL = "https://bursting-flea-33.accounts.dev/sign-in"

import iconSvg from "data-base64:../assets/icon.svg";

export default function IndexPopup() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [hover, setHover] = useState<{text: string, x: number, y: number} | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

  const toggleNotifications = () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    chrome.storage.local.set({ ls_notifications: newVal });
  };

  const fetchStats = async (token: string) => {
    try {
      const res = await fetch("http://localhost:3000/api/leetcode/stats", {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success) {
        setStats(data.data)
        chrome.storage.local.set({ ls_stats: data.data, ls_last_fetch: Date.now() })
      }
    } catch (e) {
      console.error("Failed to fetch stats", e)
    }
  }

  const checkAuth = () => {
    try {
      chrome.runtime.sendMessage({ type: "CHECK_AUTH" }, (response) => {
        if (chrome.runtime.lastError) return;
        
        if (response && response.loggedIn) {
          if (authWindow && !authWindow.closed) {
            authWindow.close();
            authWindow = null;
          }
          setLoggedIn(true)
          chrome.storage.local.set({ ls_loggedIn: true, ls_token: response.token });
          
          // Stale-while-revalidate: Always fetch fresh data in the background
          // The UI is already showing cached data from local storage, this updates it seamlessly.
          fetchStats(response.token);
        } else {
          setLoggedIn(false)
          chrome.storage.local.set({ ls_loggedIn: false });
          chrome.storage.local.remove(["ls_stats", "ls_token", "ls_last_fetch", "ls_dont_ask_link", "ls_dont_ask_verify", "ls_dont_ask_mismatch"]);
        }
      })
    } catch (e) {}
  }

  useEffect(() => {
    chrome.storage.local.get(["ls_loggedIn", "ls_stats", "ls_notifications"], (res) => {
      if (res.ls_loggedIn !== undefined) setLoggedIn(res.ls_loggedIn);
      if (res.ls_stats) setStats(res.ls_stats);
      if (res.ls_notifications !== undefined) setNotificationsEnabled(res.ls_notifications);
    });

    checkAuth();
    const interval = setInterval(checkAuth, 3000);
    return () => clearInterval(interval);
  }, [])

  const handleSignIn = () => {
    const w = 500;
    const h = 650;
    const left = (window.screen.width / 2) - (w / 2);
    const top = (window.screen.height / 2) - (h / 2);
    authWindow = window.open(CLERK_SIGN_IN_URL, "LeetSenseiAuth", `width=${w},height=${h},top=${top},left=${left}`);
  }

  if (loggedIn === null) {
    return <div className="w-[380px] h-64 bg-zinc-950 flex items-center justify-center text-zinc-400">Loading...</div>
  }

  if (!loggedIn) {
    return (
      <div className="w-[380px] bg-zinc-950 text-white p-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-[#2a323d] rounded-2xl mb-4 flex items-center justify-center overflow-hidden drop-shadow-md">
           <img src={iconSvg} alt="LeetSensei Logo" className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold mb-2">LeetSensei</h2>
        <p className="text-zinc-400 text-sm text-center mb-6 leading-relaxed">Sign in to automatically track your LeetCode progress.</p>

        <button onClick={handleSignIn} className="w-full py-2.5 bg-white text-black font-bold rounded-lg hover:opacity-90 transition shadow-lg">
          Sign In
        </button>
        
        <div className="w-full h-px bg-zinc-800 my-6"></div>
        
        <div className="w-full flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-zinc-200">Nudge Alerts</span>
            <span className="text-[10px] text-zinc-500">Show popup when logged out</span>
          </div>
          <button 
            onClick={toggleNotifications}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${notificationsEnabled ? 'bg-emerald-500' : 'bg-zinc-600'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform duration-300 ${notificationsEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
    )
  }

  if (!stats) {
    return <div className="w-[420px] h-64 bg-zinc-950 flex items-center justify-center text-zinc-400">Loading Dashboard...</div>
  }

  // Calculate Donut Chart Data
  const total = stats.totalQuestionsSolved || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const easyStroke = (stats.easyQuestionsSolved / total) * circumference;
  const medStroke = (stats.mediumQuestionsSolved / total) * circumference;
  const hardStroke = (stats.hardQuestionsSolved / total) * circumference;

  const heatMapByDate: Record<string, number> = {};
  if (stats.submissionHeatMap) {
    Object.entries(stats.submissionHeatMap).forEach(([timestamp, count]) => {
      const date = new Date(parseInt(timestamp) * 1000);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      heatMapByDate[dateStr] = count as number;
    });
  }

  const monthBlocks = [];
  const today = new Date();
  
  // Render the last 4 months (e.g., Jun, Jul, Aug, Sep) as distinct separated blocks
  for (let i = 3; i >= 0; i--) {
    const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const monthName = targetDate.toLocaleString('default', { month: 'short' });
    
    const firstDayOffset = targetDate.getDay(); // 0 = Sun, 6 = Sat
    const daysInMonth = new Date(year, month + 1, 0).getDate(); 
    const numCols = Math.ceil((firstDayOffset + daysInMonth) / 7);
    
    const monthCols = [];
    for (let c = 0; c < numCols; c++) {
      const colSquares = [];
      for (let r = 0; r < 7; r++) {
        const dayIndex = c * 7 + r;
        const dayOfMonth = dayIndex - firstDayOffset + 1;
        
        // Blank space before 1st of month or after last day
        if (dayOfMonth < 1 || dayOfMonth > daysInMonth) {
          colSquares.push(<div key={r} className="w-[11px] h-[11px] opacity-0 pointer-events-none" />);
          continue;
        }
        
        const cellDate = new Date(year, month, dayOfMonth);
        const isFuture = new Date(cellDate).setHours(0,0,0,0) > new Date(today).setHours(0,0,0,0);
        
        const yyyy = cellDate.getFullYear();
        const mm = String(cellDate.getMonth() + 1).padStart(2, '0');
        const dd = String(cellDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        const count = heatMapByDate[dateStr] || 0;
        const tooltipDate = cellDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        let bg = "bg-[#2c2c2c]"; 
        if (isFuture) bg = "opacity-0 pointer-events-none";
        else if (count === 1) bg = "bg-[#0e4429]";
        else if (count >= 2 && count <= 3) bg = "bg-[#006d32]";
        else if (count >= 4 && count <= 5) bg = "bg-[#26a641]";
        else if (count >= 6) bg = "bg-[#39d353]";
        
        colSquares.push(
          <div 
            key={r} 
            className={`w-[11px] h-[11px] rounded-[2px] ${bg} ${!isFuture ? 'transition-colors hover:ring-1 hover:ring-white cursor-pointer' : ''}`}
            onMouseEnter={(e) => {
              if (isFuture) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setHover({
                text: `${count === 0 ? 'No' : count} submissions on ${tooltipDate}`,
                x: rect.left + rect.width / 2,
                y: rect.top - 6
              });
            }}
            onMouseLeave={() => setHover(null)}
          />
        );
      }
      monthCols.push(
        <div key={c} className="flex flex-col gap-[3px]">
          {colSquares}
        </div>
      );
    }
    
    monthBlocks.push(
      <div key={i} className="flex flex-col gap-[5px]">
        <span className="text-[10px] font-semibold text-zinc-400 leading-none whitespace-nowrap pl-0.5">
          {monthName}
        </span>
        <div className="flex flex-row gap-[3px]">
           {monthCols}
        </div>
      </div>
    );
  }

  const recentBadge = stats.badges && stats.badges.length > 0 ? stats.badges[0] : null;

  return (
    <div className="w-[380px] bg-[#09090b] text-white p-4 flex flex-col gap-3 font-sans selection:bg-emerald-500/30">
      
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <img src={stats.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-zinc-800 shadow-sm" />
          <div className="flex flex-col justify-center">
            <h2 className="font-bold text-[14px] flex items-center gap-1 leading-tight text-zinc-100">
              {stats.userName}
              {stats.isVerified && <span className="text-blue-400 text-xs" title="Verified">✓</span>}
            </h2>
            <p className="text-[11px] font-medium text-zinc-500">Rank ~ {stats.globalRank?.toLocaleString()}</p>
          </div>
        </div>
        <button onClick={() => window.open("http://localhost:5173", "_blank")} className="p-2 bg-[#1a1a1a] hover:bg-zinc-800 rounded-xl transition shadow-sm border border-zinc-800/50 group" title="Open Full Dashboard">
          <svg className="w-4 h-4 text-zinc-400 group-hover:text-white transition" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
        </button>
      </div>

      {/* Main Stacked Layout (Matches LeetCode Profile) */}
      <div className="flex flex-col gap-3">
        
        {/* Section 1: Solved Chart */}
        <div className="bg-[#1a1a1a] rounded-2xl p-4 flex items-center gap-6 shadow-sm border border-zinc-800/30">
          <div className="relative w-20 h-20 flex-shrink-0 ml-2">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 drop-shadow-md">
              <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#2c2c2c" strokeWidth="8" />
              <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#00b8a3" strokeWidth="8" strokeDasharray={`${easyStroke} ${circumference}`} strokeDashoffset="0" />
              <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#ffc01e" strokeWidth="8" strokeDasharray={`${medStroke} ${circumference}`} strokeDashoffset={-easyStroke} />
              <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#ef4743" strokeWidth="8" strokeDasharray={`${hardStroke} ${circumference}`} strokeDashoffset={-(easyStroke + medStroke)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold leading-none tracking-tight">{stats.totalQuestionsSolved}</span>
              <span className="text-[9px] font-medium text-zinc-500 mt-0.5">Solved</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-grow mr-2">
            <div className="bg-[#242424] rounded-lg p-2 flex justify-between items-center px-3 shadow-inner">
              <span className="text-[11px] font-semibold text-[#00b8a3]">Easy</span>
              <span className="text-[11px] font-bold text-zinc-100">{stats.easyQuestionsSolved}</span>
            </div>
            <div className="bg-[#242424] rounded-lg p-2 flex justify-between items-center px-3 shadow-inner">
              <span className="text-[11px] font-semibold text-[#ffc01e]">Med.</span>
              <span className="text-[11px] font-bold text-zinc-100">{stats.mediumQuestionsSolved}</span>
            </div>
            <div className="bg-[#242424] rounded-lg p-2 flex justify-between items-center px-3 shadow-inner">
              <span className="text-[11px] font-semibold text-[#ef4743]">Hard</span>
              <span className="text-[11px] font-bold text-zinc-100">{stats.hardQuestionsSolved}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Badges */}
        <div className="bg-[#1a1a1a] rounded-2xl p-4 flex flex-col shadow-sm border border-zinc-800/30">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-semibold text-zinc-400">Badges</span>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-zinc-200">{stats.badges?.length || 0}</span>
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </div>
          </div>
          {recentBadge ? (
            <div className="flex items-center gap-4 bg-[#242424] rounded-xl p-3 shadow-inner">
              <img src={recentBadge.icon} alt="Badge" className="w-12 h-12 drop-shadow-xl hover:scale-110 transition-transform duration-300" />
              <div className="flex flex-col text-left justify-center">
                <p className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider">Most Recent</p>
                <p className="text-xs font-bold text-zinc-200 truncate mt-0.5" title={recentBadge.name}>{recentBadge.name}</p>
              </div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-zinc-600 text-xs font-medium py-3">No badges yet</div>
          )}
        </div>

        {/* Section 3: Heatmap */}
        <div className="bg-[#1a1a1a] rounded-2xl p-4 shadow-sm border border-zinc-800/30 flex flex-col">
          <div className="w-full flex justify-end items-center mb-4">
            <span className="text-[10px] text-zinc-500 font-medium tracking-wide">Total active days: {stats.activeDays}</span>
          </div>
          <div className="flex flex-row justify-between w-full">
            {monthBlocks}
          </div>
        </div>
        

        {/* Notifications Toggle */}
        <div className="w-full bg-[#1a1a1a] rounded-xl p-4 flex items-center justify-between shadow-sm border border-zinc-800/50 mt-2">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${notificationsEnabled !== false ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-zinc-100">Nudge Alerts</span>
              <span className="text-[9px] text-zinc-500">Show popups on questions</span>
            </div>
          </div>
          <button 
            onClick={toggleNotifications}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${notificationsEnabled !== false ? 'bg-emerald-500' : 'bg-zinc-600'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${notificationsEnabled !== false ? 'translate-x-5' : 'translate-x-1'}`} />
          </button>
        </div>

      </div>
      
      {/* Custom Instant Tooltip */}
      {hover && (
        <div 
          className="fixed z-50 bg-zinc-800 text-zinc-100 text-[10px] py-1.5 px-2.5 rounded-md shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full font-medium whitespace-nowrap border border-zinc-700/50"
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.text}
        </div>
      )}
    </div>
  )
}
