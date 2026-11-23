'use client'

import { create } from 'zustand'
import { api, session, type ApiUser } from '@/lib/api'

export interface User {
  id: number
  name: string
  email: string
  role: 'user' | 'admin'
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  hydrated: boolean
  hydrate: () => void
  login: (email: string, password: string) => Promise<User>
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<User>
  logout: () => void
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}

const toUser = (u: ApiUser): User => ({ id: u.user_id, name: u.name, email: u.email, role: u.role })

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  hydrated: false,

  // Restore the session saved in localStorage (call once on the client)
  hydrate: () => {
    if (get().hydrated) return
    const saved = session.getUser()
    set({ user: saved ? toUser(saved) : null, isAuthenticated: !!saved, hydrated: true })
    if (!saved) return
    // Confirm the saved session is still valid (token not expired/revoked, account still exists)
    const snapshot = JSON.stringify(saved)
    // Only act if the user hasn't signed in again while this check was running
    const unchanged = () => JSON.stringify(session.getUser()) === snapshot
    const signOut = () => {
      if (!unchanged()) return
      session.clear()
      set({ user: null, isAuthenticated: false })
    }
    api.me()
      .then((me) => {
        // Token now belongs to a different account (e.g. database was reset): sign out
        if (me.email.toLowerCase() !== saved.email.toLowerCase()) return signOut()
        const fresh = toUser(me)
        const cur = get().user
        if (unchanged() && (!cur || cur.role !== fresh.role || cur.name !== fresh.name)) {
          set({ user: fresh, isAuthenticated: true })
        }
      })
      .catch((e) => {
        const status = (e as { status?: number }).status
        if (status === 401 || status === 403 || status === 404) signOut()
      })
  },

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { accessToken, refreshToken, user } = await api.login(email, password)
      session.save(accessToken, refreshToken, user)
      const u = toUser(user)
      set({ user: u, isAuthenticated: true })
      return u
    } finally {
      set({ isLoading: false })
    }
  },

  register: async (data) => {
    set({ isLoading: true })
    try {
      await api.register(data)
    } finally {
      set({ isLoading: false })
    }
    return get().login(data.email, data.password)
  },

  logout: () => {
    session.clear()
    set({ user: null, isAuthenticated: false })
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (loading) => set({ isLoading: loading }),
}))
