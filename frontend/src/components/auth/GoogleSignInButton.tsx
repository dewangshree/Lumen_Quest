'use client'

import { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID } from '@/lib/api'

// Minimal typing for Google Identity Services
type GoogleId = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
    }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { google?: GoogleId }).google?.accounts?.id) return resolve()
    let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (!s) {
      s = document.createElement('script')
      s.src = SCRIPT_SRC
      s.async = true
      document.head.appendChild(s)
    }
    s.addEventListener('load', () => resolve(), { once: true })
    s.addEventListener('error', () => reject(new Error('Could not load Google sign-in')), { once: true })
  })
}

interface Props {
  text?: 'signin_with' | 'signup_with' | 'continue_with'
  onCredential: (credential: string) => void
  onError?: (message: string) => void
}

/** Renders Google's official "Sign in with Google" button. Hidden when no client ID is configured. */
export function GoogleSignInButton({ text = 'continue_with', onCredential, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onCredential)
  cb.current = onCredential
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    loadScript()
      .then(() => {
        const google = (window as unknown as { google: GoogleId }).google
        if (cancelled || !ref.current) return
        google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => cb.current(r.credential) })
        google.accounts.id.renderButton(ref.current, {
          theme: 'outline', size: 'large', shape: 'rectangular', text, logo_alignment: 'center',
          width: Math.min(400, ref.current.offsetWidth || 400),
        })
      })
      .catch((e) => { setFailed(true); onError?.(e.message) })
    return () => { cancelled = true }
  }, [text, onError])

  const divider = (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-gray-400">
      <span className="h-px flex-1 bg-gray-200" /> or <span className="h-px flex-1 bg-gray-200" />
    </div>
  )

  // Not configured yet: show a disabled placeholder so users know it's on the way
  if (!GOOGLE_CLIENT_ID || failed) {
    return (
      <div className="space-y-4">
        {divider}
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Google sign-in is coming soon"
          className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 opacity-70"
        >
          <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          <span>Continue with Google</span>
          <span className="text-xs font-normal text-gray-500">(Coming soon)</span>
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {divider}
      <div ref={ref} className="flex min-h-[44px] w-full justify-center" />
    </div>
  )
}
