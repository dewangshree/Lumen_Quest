'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Old URL: send visitors to the signup page
export default function RegisterRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/signup') }, [router])
  return null
}
