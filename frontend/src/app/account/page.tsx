"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { api, formatINR, formatDate, type CustomerSummary, type Recommendation } from '@/lib/api';
import { AlertTriangle, ArrowRight, CalendarClock, CreditCard, Lightbulb, PauseCircle, PlayCircle, Receipt, Wallet, XCircle } from 'lucide-react';

const statusVariant = { active: 'success', paused: 'warning', cancelled: 'error', expired: 'neutral' } as const;

const recStyle: Record<Recommendation['type'], string> = {
  payment: 'border-red-200 bg-red-50',
  renew: 'border-amber-200 bg-amber-50',
  resume: 'border-amber-200 bg-amber-50',
  save: 'border-green-200 bg-green-50',
  upgrade: 'border-blue-200 bg-blue-50',
  start: 'border-blue-200 bg-blue-50',
};

function AccountContent() {
  const router = useRouter();
  const [data, setData] = useState<CustomerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await api.summary());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your account');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<{ message: string }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setError(null);
    try {
      const res = await fn();
      setNotice(res.message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  if (!data && !error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    );
  }

  const current = data?.current;
  const progress = current && data?.totalDays && data.daysLeft !== null
    ? Math.min(100, Math.round(100 * (1 - data.daysLeft / data.totalDays)))
    : 0;

  const recAction = (r: Recommendation) => {
    if (r.type === 'payment') return { label: 'Go to billing', onClick: () => router.push('/billing') };
    if (r.type === 'resume' && current) return { label: 'Resume now', onClick: () => act('resume', () => api.resumeSubscription(current.sub_id)) };
    if (r.plan_id) return { label: r.type === 'renew' ? 'Renew plan' : 'View plan', onClick: () => router.push(`/subscribe?plan=${r.plan_id}`) };
    return null;
  };

  return (
    <div className="space-y-8 py-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome back{data ? `, ${data.user.name.split(' ')[0]}` : ''}</h1>
        <p className="mt-1 text-gray-600">Your subscription, payments and suggestions in one place.</p>
      </div>

      {notice && (
        <div role="status" className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-medium underline">Dismiss</button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      )}

      {data && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Current plan', value: current?.plan_name || 'None', icon: CreditCard, tone: 'bg-blue-100 text-blue-600' },
              { label: 'Days remaining', value: current && data.daysLeft !== null ? String(data.daysLeft) : '—', icon: CalendarClock, tone: 'bg-purple-100 text-purple-600' },
              { label: 'Total spent', value: formatINR(data.total_spent), icon: Wallet, tone: 'bg-green-100 text-green-600' },
              { label: 'Payments made', value: String(data.paid_count), icon: Receipt, tone: 'bg-amber-100 text-amber-600' },
            ].map(({ label, value, icon: Icon, tone }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className={`rounded-lg p-3 ${tone}`}><Icon className="h-6 w-6" /></div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-600">{label}</p>
                    <p className="truncate text-xl font-bold text-gray-900">{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Current subscription */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>My Subscription</CardTitle>
              </CardHeader>
              <CardContent>
                {current ? (
                  <div className="space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-semibold text-gray-900">{current.plan_name}</span>
                          <Badge variant={statusVariant[current.status]} className="capitalize">{current.status}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {formatINR(current.price)} · {current.quota_sessions} sessions · {current.validity_days} days
                        </p>
                      </div>
                      <Link href="/subscribe" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
                        Change plan <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>

                    {data.daysLeft !== null && (
                      <div>
                        <div className="mb-1 flex justify-between text-sm text-gray-600">
                          <span>Started {formatDate(current.start_date)}</span>
                          <span>{current.status === 'paused' ? 'Paused · ' : ''}Ends {formatDate(current.end_date)}</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-gray-100">
                          <div className={`h-2.5 rounded-full ${current.status === 'paused' ? 'bg-amber-400' : 'bg-primary-500'}`} style={{ width: `${progress}%` }} />
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{data.daysLeft} of {data.totalDays} days left</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      {current.status === 'active' ? (
                        <Button
                          variant="secondary"
                          icon={<PauseCircle className="h-4 w-4" />}
                          loading={busy === 'pause'}
                          onClick={() => act('pause', () => api.pauseSubscription(current.sub_id), 'Pause your subscription? Remaining days are kept until you resume.')}
                        >
                          Pause
                        </Button>
                      ) : (
                        <Button
                          icon={<PlayCircle className="h-4 w-4" />}
                          loading={busy === 'resume'}
                          onClick={() => act('resume', () => api.resumeSubscription(current.sub_id))}
                        >
                          Resume
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        className="text-red-600 hover:bg-red-50"
                        icon={<XCircle className="h-4 w-4" />}
                        loading={busy === 'cancel'}
                        onClick={() => act('cancel', () => api.cancelSubscription(current.sub_id), `Cancel your ${current.plan_name} subscription? This cannot be undone.`)}
                      >
                        Cancel subscription
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-gray-600">You don&apos;t have an active subscription.</p>
                    <Button className="mt-4" onClick={() => router.push('/subscribe')}>Browse plans</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5 text-amber-500" /> Suggestions for you</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recommendations.length === 0 ? (
                  <p className="text-sm text-gray-600">You&apos;re on the best-value plan for your needs. Nothing to change right now.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.recommendations.map((r, i) => {
                      const action = recAction(r);
                      return (
                        <li key={i} className={`rounded-lg border p-3 ${recStyle[r.type]}`}>
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                            {r.type === 'payment' && <AlertTriangle className="h-4 w-4 text-red-600" />}
                            {r.title}
                          </p>
                          <p className="mt-1 text-sm text-gray-700">{r.message}</p>
                          {action && (
                            <button onClick={action.onClick} className="mt-2 text-sm font-medium text-primary-700 hover:underline">
                              {action.label} →
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { href: '/subscribe', title: 'Browse plans', text: 'Compare plans and switch any time.', icon: CreditCard },
              { href: '/billing', title: 'Billing & invoices', text: data.outstanding_count ? `${data.outstanding_count} bill(s) need attention.` : 'Download invoices for every payment.', icon: Receipt },
              { href: '/profile', title: 'Profile & security', text: 'Update your name, phone or password.', icon: Wallet },
            ].map(({ href, title, text, icon: Icon }) => (
              <Link key={href} href={href} className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary-300 hover:shadow-md">
                <Icon className="h-6 w-6 text-primary-600" />
                <p className="mt-3 font-semibold text-gray-900 group-hover:text-primary-700">{title}</p>
                <p className="mt-1 text-sm text-gray-600">{text}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AccountPage() {
  return (
    <RequireAuth role="user">
      <AccountContent />
    </RequireAuth>
  );
}
