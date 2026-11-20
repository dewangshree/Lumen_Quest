"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useAuthStore } from '@/store/auth-store';
import { api, formatINR, type Plan, type Subscription } from '@/lib/api';

const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'debit_card', label: 'Debit card' },
];

const statusVariant: Record<Subscription['status'], 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  cancelled: 'error',
  expired: 'neutral',
};

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const validityLabel = (days: number) => (days >= 365 ? 'year' : days >= 90 ? `${Math.round(days / 30)} months` : 'month');

function SubscribeContent() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, s] = await Promise.all([api.plans(), isAdmin ? Promise.resolve([]) : api.mySubscriptions()]);
      setPlans(p.filter((x) => x.status === 'Active'));
      setSubs(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const current = subs.find((s) => s.status === 'active' || s.status === 'paused') || null;
  const popularId = plans.length >= 3 ? plans[Math.floor(plans.length / 2)].plan_id : null;

  const confirmSubscribe = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    setCheckoutError(null);
    try {
      await api.subscribe(selectedPlan.plan_id, paymentMethod);
      setNotice(`You're now subscribed to ${selectedPlan.plan_name}.`);
      setSelectedPlan(null);
      await load();
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelCurrent = async () => {
    if (!current || !window.confirm(`Cancel your ${current.plan_name} subscription?`)) return;
    try {
      await api.cancelSubscription(current.sub_id);
      setNotice('Your subscription has been cancelled.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel subscription');
    }
  };

  return (
    <div className="py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
          {isAdmin ? 'Subscription Plans' : 'Choose Your Plan'}
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          {isAdmin ? 'Plans currently offered to customers' : 'Pick the plan that fits your needs. You can switch or cancel any time.'}
        </p>
      </div>

      {notice && (
        <div role="status" className="mb-6 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-green-700 hover:text-green-900">Dismiss</button>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      )}

      {/* Current subscription */}
      {!isAdmin && !loading && (
        <Card className="mb-10">
          <CardHeader>
            <CardTitle>My Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            {current ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">{current.plan_name}</span>
                    <Badge variant={statusVariant[current.status]} className="capitalize">{current.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {formatINR(current.price)} · Started {formatDate(current.start_date)} · Renews {formatDate(current.end_date)}
                  </p>
                </div>
                <Button variant="secondary" onClick={cancelCurrent}>Cancel subscription</Button>
              </div>
            ) : (
              <p className="text-gray-600">You don&apos;t have an active subscription. Choose a plan below to get started.</p>
            )}

            {subs.length > 1 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-primary-600">Subscription history ({subs.length})</summary>
                <ul className="mt-2 divide-y divide-gray-100 text-sm">
                  {subs.map((s) => (
                    <li key={s.sub_id} className="flex items-center justify-between py-2">
                      <span>{s.plan_name} · {formatDate(s.start_date)}</span>
                      <Badge variant={statusVariant[s.status]} size="sm" className="capitalize">{s.status}</Badge>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = current?.plan_id === plan.plan_id;
            const popular = plan.plan_id === popularId;
            return (
              <Card key={plan.plan_id} className={`relative flex flex-col ${popular ? 'ring-2 ring-primary-500' : ''}`}>
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="primary" className="px-3 py-1">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl font-bold">{plan.plan_name}</CardTitle>
                  <div className="mt-3">
                    <span className="text-4xl font-extrabold text-gray-900">{formatINR(plan.price)}</span>
                    <span className="text-base font-medium text-gray-500"> / {validityLabel(plan.validity_days)}</span>
                  </div>
                  {plan.description && <p className="mt-2 text-gray-500">{plan.description}</p>}
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li>✅ {plan.quota_sessions} sessions included</li>
                    <li>✅ Valid for {plan.validity_days} days</li>
                    <li>{plan.auto_renewal_allowed === 'Yes' ? '✅ Auto-renewal available' : '❌ No auto-renewal'}</li>
                  </ul>
                </CardContent>
                {!isAdmin && (
                  <CardFooter>
                    <Button
                      onClick={() => { setSelectedPlan(plan); setCheckoutError(null); }}
                      variant={popular ? 'primary' : 'secondary'}
                      className="w-full"
                      size="lg"
                      disabled={isCurrent}
                    >
                      {isCurrent ? 'Current plan' : current ? 'Switch to this plan' : 'Subscribe'}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Checkout */}
      {selectedPlan && (
        <Modal
          isOpen={!!selectedPlan}
          onClose={() => !submitting && setSelectedPlan(null)}
          title={`Subscribe to ${selectedPlan.plan_name}`}
          description={current ? `This replaces your current ${current.plan_name} subscription.` : ''}
          size="md"
        >
          <ModalBody>
            <div className="space-y-5">
              <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
                <div>
                  <div className="font-semibold">{selectedPlan.plan_name}</div>
                  <div className="text-sm text-gray-600">{selectedPlan.validity_days} days · {selectedPlan.quota_sessions} sessions</div>
                </div>
                <div className="text-2xl font-bold">{formatINR(selectedPlan.price)}</div>
              </div>
              <div>
                <label htmlFor="payment-method" className="block text-sm font-medium text-gray-700 mb-1">Payment method</label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <p className="mt-2 text-xs text-gray-500">Demo checkout: no real payment is taken.</p>
              </div>
              {checkoutError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{checkoutError}</div>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setSelectedPlan(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={confirmSubscribe} loading={submitting}>Pay {formatINR(selectedPlan.price)}</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

export default function SubscribePage() {
  return (
    <RequireAuth>
      <SubscribeContent />
    </RequireAuth>
  );
}
