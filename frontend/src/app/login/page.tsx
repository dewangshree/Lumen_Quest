'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthForm } from '@/components/auth/AuthForm'

export default function LoginPage() {
  const router = useRouter()
  const [userType, setUserType] = useState<'customer' | 'admin'>('customer')

  return (
    <AuthForm
      mode="login"
      userType={userType}
      onModeChange={(mode) => router.push(mode === 'signup' ? '/signup' : '/login')}
      onUserTypeChange={setUserType}
    />
  )
}
