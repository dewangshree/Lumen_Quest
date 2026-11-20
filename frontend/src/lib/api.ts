// Client for the Lumen Quest backend API.
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://lumen-quest-api.vercel.app').replace(/\/$/, '')

const TOKEN_KEY = 'lq_access_token'
const REFRESH_KEY = 'lq_refresh_token'
const USER_KEY = 'lq_user'

export interface ApiUser {
  user_id: number
  name: string
  email: string
  phone?: string | null
  role: 'user' | 'admin'
  status: 'active' | 'inactive'
}

export interface Plan {
  plan_id: number
  plan_name: string
  price: number
  quota_sessions: number
  validity_days: number
  auto_renewal_allowed: 'Yes' | 'No'
  description: string | null
  status: 'Active' | 'Inactive'
}

export interface Subscription {
  sub_id: number
  plan_id: number
  plan_name: string
  price: number
  type: string
  status: 'active' | 'paused' | 'expired' | 'cancelled'
  start_date: string
  end_date: string | null
}

export interface Customer {
  id: number
  name: string
  email: string
  phone: string | null
  account_status: 'active' | 'inactive'
  created_at: string
  subscription_status: Subscription['status'] | null
  subscription: string | null
  start_date: string | null
  total_spent: number
  last_payment: string | null
}

export interface Stats {
  kpi: {
    total_revenue: number
    pending_revenue: number
    failed_revenue: number
    total_customers: number
    active_customers: number
    total_subscriptions: number
    active_subscriptions: number
    churned_subscriptions: number
    paying_customers: number
    churn_rate: number
    arpu: number
  }
  revenueByMonth: { month: string; revenue: number | null; bills: number }[]
  subscriptionsByMonth: { month: string; new: number; churned: number }[]
  planDistribution: { name: string; value: number }[]
  statusBreakdown: { name: string; value: number }[]
  topCustomers: { id: number; name: string; total_spent: number; plan: string | null }[]
  recentActivity: { id: number; type: 'paid' | 'pending' | 'failed'; name: string; plan_name: string; amount: number; date: string }[]
}

export interface Bill {
  billing_id: number
  amount: number
  discount_applied: number
  billing_date: string
  payment_status: 'paid' | 'pending' | 'failed'
  payment_method: string
  transaction_id: string | null
  sub_id: number
  plan_name: string
  validity_days: number
}

export interface Recommendation {
  type: 'start' | 'resume' | 'renew' | 'save' | 'upgrade' | 'payment'
  title: string
  message: string
  plan_id?: number
}

export interface CustomerSummary {
  user: { user_id: number; name: string; email: string; phone: string | null; created_at: string }
  current: (Subscription & { quota_sessions: number; validity_days: number }) | null
  daysLeft: number | null
  totalDays: number | null
  total_spent: number
  paid_count: number
  outstanding_count: number
  outstanding_amount: number
  subscriptionCount: number
  recommendations: Recommendation[]
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

// ---- token storage (browser only) ----
const storage = {
  get(key: string) {
    try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key) } catch { return null }
  },
  set(key: string, value: string | null) {
    try {
      if (typeof window === 'undefined') return
      if (value === null) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, value)
    } catch { /* storage unavailable */ }
  },
}

export const session = {
  getUser(): ApiUser | null {
    const raw = storage.get(USER_KEY)
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  },
  save(accessToken: string, refreshToken: string, user: ApiUser) {
    storage.set(TOKEN_KEY, accessToken)
    storage.set(REFRESH_KEY, refreshToken)
    storage.set(USER_KEY, JSON.stringify(user))
  },
  clear() {
    storage.set(TOKEN_KEY, null)
    storage.set(REFRESH_KEY, null)
    storage.set(USER_KEY, null)
  },
}

async function refreshAccessToken(): Promise<string | null> {
  const token = storage.get(REFRESH_KEY)
  if (!token) return null
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) return null
  const { accessToken } = await res.json()
  storage.set(TOKEN_KEY, accessToken)
  return accessToken
}

export async function request<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options
  const send = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

  let res: Response
  try {
    res = await send(auth ? storage.get(TOKEN_KEY) : null)
    // Access tokens last 15 minutes; refresh once and retry on expiry
    if (auth && (res.status === 401 || res.status === 403)) {
      const fresh = await refreshAccessToken()
      if (fresh) res = await send(fresh)
    }
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0)
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.message || data.error || `Request failed (${res.status})`, res.status)
  return data as T
}

export const api = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: ApiUser }>('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (data: { name: string; email: string; password: string; phone?: string }) =>
    request<{ userId: number }>('/api/auth/register', { method: 'POST', body: data }),
  me: () => request<ApiUser & { created_at: string }>('/api/users/me', { auth: true }),

  plans: () => request<Plan[]>('/api/plans'),

  mySubscriptions: () => request<Subscription[]>('/api/subscriptions/me', { auth: true }),
  subscribe: (plan_id: number, payment_method = 'credit_card') =>
    request<{ subscription: Subscription }>('/api/subscriptions', { method: 'POST', body: { plan_id, payment_method }, auth: true }),
  cancelSubscription: (subId: number) =>
    request<{ message: string }>(`/api/subscriptions/${subId}/cancel`, { method: 'POST', auth: true }),

  pauseSubscription: (subId: number) =>
    request<{ message: string }>(`/api/subscriptions/${subId}/pause`, { method: 'POST', auth: true }),
  resumeSubscription: (subId: number) =>
    request<{ message: string }>(`/api/subscriptions/${subId}/resume`, { method: 'POST', auth: true }),
  summary: () => request<CustomerSummary>('/api/subscriptions/me/summary', { auth: true }),
  billing: () => request<Bill[]>('/api/subscriptions/me/billing', { auth: true }),
  payBill: (billingId: number, payment_method = 'upi') =>
    request<{ message: string }>(`/api/subscriptions/me/billing/${billingId}/pay`, { method: 'POST', body: { payment_method }, auth: true }),
  updateProfile: (data: { name?: string; phone?: string; password?: string; current_password?: string }) =>
    request<{ message: string }>('/api/users/me', { method: 'PUT', body: data, auth: true }),

  stats: () => request<Stats>('/api/admin/stats', { auth: true }),
  customers: () => request<Customer[]>('/api/admin/customers', { auth: true }),
  createCustomer: (data: { name: string; email: string; phone?: string; plan_id?: number }) =>
    request<{ userId: number; tempPassword: string }>('/api/admin/customers', { method: 'POST', body: data, auth: true }),
}

export const formatINR = (n: number | null | undefined) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

export const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  upi: 'UPI', credit_card: 'Credit card', debit_card: 'Debit card', cash: 'Cash',
}
