'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthForm } from '@/components/auth/AuthForm'

export default function SignupPage() {
  const router = useRouter()
  const [userType, setUserType] = useState<'customer' | 'admin'>('customer')

  return (
    <AuthForm
      mode="signup"
      userType={userType}
      onModeChange={(mode) => router.push(mode === 'signup' ? '/signup' : '/login')}
      onUserTypeChange={setUserType}
    />
  )
}
