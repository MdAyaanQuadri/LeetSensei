import { useEffect, useState } from 'react'
import { Show, SignIn, UserButton, useUser } from '@clerk/react'

function App() {
  const { isSignedIn, isLoaded, user } = useUser()
  const [targetUrl, setTargetUrl] = useState<string | null>(null)
  const [isPopupMode, setIsPopupMode] = useState<boolean>(false)

  // Cache return_to and mode on initial mount so OAuth redirects don't lose them
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const returnTo = params.get('return_to')
    const mode = params.get('mode')

    if (returnTo) {
      sessionStorage.setItem('ls_return_to', returnTo)
      setTargetUrl(returnTo)
    } else {
      const cached = sessionStorage.getItem('ls_return_to')
      if (cached) setTargetUrl(cached)
    }

    if (mode === 'popup' || window.name === 'LeetSenseiAuth') {
      sessionStorage.setItem('ls_auth_mode', 'popup')
      setIsPopupMode(true)
    } else {
      const cachedMode = sessionStorage.getItem('ls_auth_mode')
      if (cachedMode === 'popup') setIsPopupMode(true)
    }
  }, [])

  // Auto-close or redirect when user completes sign in
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return

    const params = new URLSearchParams(window.location.search)
    const returnTo = params.get('return_to') || sessionStorage.getItem('ls_return_to')
    const mode = params.get('mode') || sessionStorage.getItem('ls_auth_mode')

    if (returnTo) {
      setTargetUrl(returnTo)
    }

    if (mode === 'popup' || window.name === 'LeetSenseiAuth' || returnTo) {
      // 1. Try closing the auth popup window immediately
      try {
        window.close()
      } catch (e) {}

      // 2. If window couldn't close and a return_to destination exists, redirect back to LeetCode
      if (returnTo) {
        const timer = setTimeout(() => {
          sessionStorage.removeItem('ls_return_to')
          sessionStorage.removeItem('ls_auth_mode')
          window.location.href = returnTo
        }, 300)
        return () => clearTimeout(timer)
      }
    }
  }, [isSignedIn, isLoaded])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#09090b',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <header style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <Show when="signed-in">
          <span style={{ fontSize: '13px', color: '#a1a1aa' }}>
            {user?.primaryEmailAddress?.emailAddress}
          </span>
          <UserButton />
        </Show>
      </header>

      <main>
        <Show when="signed-out">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>LeetSensei</h1>
            <p style={{ fontSize: '14px', color: '#a1a1aa' }}>Sign in to sync your LeetCode progress and stats</p>
          </div>
          <SignIn routing="hash" />
        </Show>

        <Show when="signed-in">
          <div style={{ textAlign: 'center', padding: '32px', background: '#18181b', borderRadius: '12px', border: '1px solid #27272a', maxWidth: '420px', margin: '0 16px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Signed in successfully!</h2>
            <p style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '20px', lineHeight: '1.5' }}>
              {targetUrl
                ? 'Redirecting you back to LeetCode...'
                : 'Your LeetSensei Chrome extension is now connected and tracking your submissions.'}
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {targetUrl ? (
                <button
                  onClick={() => {
                    sessionStorage.removeItem('ls_return_to')
                    sessionStorage.removeItem('ls_auth_mode')
                    window.location.href = targetUrl
                  }}
                  style={{
                    padding: '8px 18px',
                    background: '#f97316',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Back to LeetCode
                </button>
              ) : isPopupMode ? (
                <button
                  onClick={() => window.close()}
                  style={{
                    padding: '8px 18px',
                    background: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Close Window
                </button>
              ) : null}
            </div>
            <p style={{ fontSize: '11px', color: '#71717a', marginTop: '16px' }}>
              {targetUrl ? 'Taking you back to your problem.' : 'You can now safely close this window.'}
            </p>
          </div>
        </Show>
      </main>
    </div>
  )
}

export default App