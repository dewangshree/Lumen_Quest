'use client'

import { LogOut, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { useUIStore } from '@/store/ui-store'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { cn } from '@/lib/utils'

export function Header() {
  const { user, logout } = useAuthStore()
  const router = useRouter()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }
  const { toggleSidebar } = useUIStore()

  return (
    <header className="h-16 bg-white/80 backdrop-blur border-b border-gray-200/80 sticky top-0 z-30">
      <div className="h-full flex items-center justify-between px-6">
        <div className="flex items-center space-x-4 flex-1">
          <button
            onClick={toggleSidebar}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden lg:block">
            <Breadcrumb />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {user && (
            <div className="flex items-center space-x-3 pl-3 border-l border-gray-200">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role === 'admin' ? 'Admin' : 'Customer'}</p>
              </div>
              
              <button
                onClick={() => router.push('/profile')}
                title="Profile"
                aria-label="Open profile"
                className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center hover:bg-primary-200"
              >
                <span className="text-sm font-medium text-primary-700">
                  {user.name?.charAt(0).toUpperCase()}
                </span>
              </button>
              <button
                onClick={handleLogout}
                title="Sign out"
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
