import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Self-service password reset by email isn&apos;t available yet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-600">
          <p>Please contact your administrator to get a new temporary password. Once you&apos;re signed in you can change it from your account.</p>
          <Link href="/login" className="inline-block font-medium text-primary-600 hover:text-primary-700">← Back to sign in</Link>
        </CardContent>
      </Card>
    </div>
  )
}
