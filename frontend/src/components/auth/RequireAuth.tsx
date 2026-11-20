'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'

interface RequireAuthProps {
  role?: 'admin' | 'user'
  children: React.ReactNode
}

// Client-side guard: redirects to /login when signed out, and shows a notice on role mismatch.
export function RequireAuth({ role, children }: RequireAuthProps) {
  const router = useRouter()
  const { user, hydrated, hydrate } = useAuthStore()

  useEffect(() => { hydrate() }, [hydrate])
  useEffect(() => {
    if (hydrated && !user) router.replace('/login')
  }, [hydrated, user, router])

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    )
  }

  if (role && user.role !== role) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900">Access restricted</h2>
        <p className="mt-2 text-gray-600">
          {role === 'admin' ? 'This page is only available to admins.' : 'This page is for customers.'}
        </p>
        <button
          onClick={() => router.push(user.role === 'admin' ? '/dashboard' : '/account')}
          className="mt-6 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Go to your home page
        </button>
      </div>
    )
  }

  return <>{children}</>
}
