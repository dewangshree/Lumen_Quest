"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { api, formatINR, formatDate, PAYMENT_METHOD_LABELS, type CustomerDetail, type Plan, type Subscription } from '@/lib/api';
import { ArrowLeft, Mail, Phone } from 'lucide-react';

const subVariant = { active: 'success', paused: 'warning', cancelled: 'error', expired: 'neutral' } as const;
const billVariant = { paid: 'success', pending: 'warning', failed: 'error' } as const;

function CustomerDetailContent() {
  const [id, setId] = useState<number | null>(null);
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [planId, setPlanId] = useState('');

  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get('id'));
    if (n) setId(n); else setError('No customer selected.');
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [d, p] = await Promise.all([api.customerDetail(id), api.plans()]);
      setData(d);
      setPlans(p.filter((x) => x.status === 'Active'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customer');
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (key: string, fn: () => Promise<{ message: string }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    setError(null);
    try {
      setNotice((await fn()).message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const current: Subscription | undefined = data?.subscriptions.find((s) => s.status === 'active' || s.status === 'paused');
  const paid = data?.bills.filter((b) => b.payment_status === 'paid').reduce((a, b) => a + b.amount, 0) || 0;
  const due = data?.bills.filter((b) => b.payment_status !== 'paid').reduce((a, b) => a + b.amount, 0) || 0;

  return (
    <div className="space-y-6 py-4">
      <Link href="/customers" className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </Link>

      {notice && (
        <div role="status" className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-medium underline">Dismiss</button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          {id && <button onClick={load} className="font-medium underline">Retry</button>}
        </div>
      )}

      {!data && !error && (
        <div className="flex min-h-[40vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" /></div>
      )}

      {data && (
        <>
          {/* Header */}
          <Card>
            <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-xl font-semibold text-primary-700">
                  {data.user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-900">{data.user.name}</h1>
                    <Badge variant={data.user.status === 'active' ? 'success' : 'neutral'} className="capitalize">{data.user.status}</Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                    <a href={`mailto:${data.user.email}`} className="inline-flex items-center gap-1 hover:text-primary-700"><Mail className="h-4 w-4" />{data.user.email}</a>
                    {data.user.phone && <a href={`tel:${data.user.phone}`} className="inline-flex items-center gap-1 hover:text-primary-700"><Phone className="h-4 w-4" />{data.user.phone}</a>}
                    <span>Customer since {formatDate(data.user.created_at)}</span>
                  </div>
                </div>
              </div>
              <Button
                variant="secondary"
                loading={busy === 'status'}
                onClick={() => act('status', () => api.setCustomerStatus(data.user.user_id, data.user.status === 'active' ? 'inactive' : 'active'))}
              >
                Mark as {data.user.status === 'active' ? 'inactive' : 'active'}
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Card><CardContent><p className="text-sm text-gray-600">Lifetime paid</p><p className="text-2xl font-bold text-green-600">{formatINR(paid)}</p></CardContent></Card>
            <Card><CardContent><p className="text-sm text-gray-600">Outstanding</p><p className={`text-2xl font-bold ${due ? 'text-red-600' : 'text-gray-900'}`}>{formatINR(due)}</p></CardContent></Card>
            <Card><CardContent><p className="text-sm text-gray-600">Subscriptions</p><p className="text-2xl font-bold text-gray-900">{data.subscriptions.length}</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Current subscription & actions */}
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle>Current subscription</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {current ? (
                  <>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">{current.plan_name}</span>
                        <Badge variant={subVariant[current.status]} size="sm" className="capitalize">{current.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{formatINR(current.price)} · {formatDate(current.start_date)} → {formatDate(current.end_date)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {current.status === 'active' ? (
                        <Button size="sm" variant="secondary" loading={busy === 'pause'} onClick={() => act('pause', () => api.adminSubscriptionAction(current.sub_id, 'pause'))}>Pause</Button>
                      ) : (
                        <Button size="sm" loading={busy === 'resume'} onClick={() => act('resume', () => api.adminSubscriptionAction(current.sub_id, 'resume'))}>Resume</Button>
                      )}
                      <Button size="sm" variant="danger" loading={busy === 'cancel'} onClick={() => act('cancel', () => api.adminSubscriptionAction(current.sub_id, 'cancel'), `Cancel ${data.user.name}'s ${current.plan_name} subscription?`)}>Cancel</Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-600">No active subscription.</p>
                )}

                <div className="border-t border-gray-100 pt-4">
                  <label htmlFor="assign-plan" className="mb-1 block text-sm font-medium text-gray-700">{current ? 'Change plan' : 'Assign a plan'}</label>
                  <div className="flex gap-2">
                    <select id="assign-plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                      <option value="">Select plan…</option>
                      {plans.filter((p) => p.plan_id !== current?.plan_id).map((p) => (
                        <option key={p.plan_id} value={p.plan_id}>{p.plan_name} – {formatINR(p.price)}</option>
                      ))}
                    </select>
                    <Button
                      disabled={!planId}
                      loading={busy === 'assign'}
                      onClick={() => act('assign', async () => { const r = await api.assignPlan(data.user.user_id, Number(planId)); setPlanId(''); return r; })}
                    >
                      Apply
                    </Button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Creates a paid (cash) bill for the new plan.</p>
                </div>
              </CardContent>
            </Card>

            {/* Subscription history */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Subscription history</CardTitle></CardHeader>
              <CardContent>
                {data.subscriptions.length === 0 ? <p className="text-sm text-gray-600">No subscriptions yet.</p> : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead><tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-3 py-2">Plan</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Start</th><th className="px-3 py-2">End</th><th className="px-3 py-2">Status</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.subscriptions.map((s) => (
                          <tr key={s.sub_id}>
                            <td className="px-3 py-2 font-medium">{s.plan_name}</td>
                            <td className="px-3 py-2 capitalize">{s.type}</td>
                            <td className="px-3 py-2">{formatDate(s.start_date)}</td>
                            <td className="px-3 py-2">{formatDate(s.end_date)}</td>
                            <td className="px-3 py-2"><Badge variant={subVariant[s.status]} size="sm" className="capitalize">{s.status}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bills */}
          <Card>
            <CardHeader><CardTitle>Bills</CardTitle></CardHeader>
            <CardContent>
              {data.bills.length === 0 ? <p className="text-sm text-gray-600">No bills yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead><tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2" />
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.bills.map((b) => (
                        <tr key={b.billing_id}>
                          <td className="px-3 py-2 font-mono">INV-{String(b.billing_id).padStart(5, '0')}</td>
                          <td className="px-3 py-2">{formatDate(b.billing_date)}</td>
                          <td className="px-3 py-2">{b.plan_name}</td>
                          <td className="px-3 py-2">{PAYMENT_METHOD_LABELS[b.payment_method] || b.payment_method}</td>
                          <td className="px-3 py-2"><Badge variant={billVariant[b.payment_status]} size="sm" className="capitalize">{b.payment_status}</Badge></td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatINR(b.amount)}</td>
                          <td className="px-3 py-2 text-right">
                            {b.payment_status !== 'paid' && (
                              <Button size="sm" variant="secondary" loading={busy === `bill-${b.billing_id}`} onClick={() => act(`bill-${b.billing_id}`, () => api.markBillPaid(b.billing_id), `Mark INV-${String(b.billing_id).padStart(5, '0')} as paid (cash)?`)}>
                                Mark paid
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <RequireAuth role="admin">
      <CustomerDetailContent />
    </RequireAuth>
  );
}
