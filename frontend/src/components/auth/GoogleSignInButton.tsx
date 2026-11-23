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

  if (!GOOGLE_CLIENT_ID || failed) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-gray-400">
        <span className="h-px flex-1 bg-gray-200" /> or <span className="h-px flex-1 bg-gray-200" />
      </div>
      <div ref={ref} className="flex min-h-[44px] w-full justify-center" />
    </div>
  )
}
