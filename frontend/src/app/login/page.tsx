'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthForm } from '@/components/auth/AuthForm'

// /login?as=customer or /login?as=admin opens a single-role sign-in screen;
// plain /login shows the Customer/Admin switch.
export default function LoginPage() {
  const router = useRouter()
  const [userType, setUserType] = useState<'customer' | 'admin'>('customer')
  const [locked, setLocked] = useState<boolean | null>(null)

  useEffect(() => {
    const as = new URLSearchParams(window.location.search).get('as')
    if (as === 'admin' || as === 'customer') {
      setUserType(as)
      setLocked(true)
    } else {
      setLocked(false)
    }
  }, [])

  if (locked === null) return null

  return (
    <AuthForm
      mode="login"
      userType={userType}
      lockUserType={locked}
      onModeChange={(mode) => router.push(mode === 'signup' ? '/signup' : '/login?as=customer')}
      onUserTypeChange={setUserType}
    />
  )
}
