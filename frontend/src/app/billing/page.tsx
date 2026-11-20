"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useAuthStore } from '@/store/auth-store';
import { api, formatINR, formatDate, PAYMENT_METHOD_LABELS, type Bill } from '@/lib/api';
import { downloadInvoice } from '@/lib/invoice';
import { Download } from 'lucide-react';

const statusVariant = { paid: 'success', pending: 'warning', failed: 'error' } as const;

function BillingContent() {
  const user = useAuthStore((s) => s.user);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | Bill['payment_status']>('all');
  const [paying, setPaying] = useState<Bill | null>(null);
  const [method, setMethod] = useState('upi');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBills(await api.billing());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing history');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    const list = bills || [];
    const sum = (s: Bill['payment_status']) => list.filter((b) => b.payment_status === s).reduce((a, b) => a + b.amount, 0);
    return { paid: sum('paid'), outstanding: sum('pending') + sum('failed'), count: list.length };
  }, [bills]);

  const shown = (bills || []).filter((b) => filter === 'all' || b.payment_status === filter);

  const pay = async () => {
    if (!paying) return;
    setSubmitting(true);
    try {
      await api.payBill(paying.billing_id, method);
      setNotice(`Payment of ${formatINR(paying.amount)} received. Thank you!`);
      setPaying(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const invoice = async (b: Bill) => {
    if (!user) return;
    setDownloading(b.billing_id);
    try {
      await downloadInvoice(b, user);
    } catch {
      setError('Could not generate the invoice. Please try again.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-8 py-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Billing &amp; Invoices</h1>
        <p className="mt-1 text-gray-600">Every payment for your subscriptions, with downloadable invoices.</p>
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card><CardContent><p className="text-sm text-gray-600">Total paid</p><p className="text-2xl font-bold text-green-600">{formatINR(totals.paid)}</p></CardContent></Card>
        <Card><CardContent><p className="text-sm text-gray-600">Outstanding</p><p className={`text-2xl font-bold ${totals.outstanding ? 'text-red-600' : 'text-gray-900'}`}>{formatINR(totals.outstanding)}</p></CardContent></Card>
        <Card><CardContent><p className="text-sm text-gray-600">Bills</p><p className="text-2xl font-bold text-gray-900">{totals.count}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Payment history</CardTitle>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm" role="tablist" aria-label="Filter bills">
              {(['all', 'paid', 'pending', 'failed'] as const).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 capitalize ${filter === f ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {bills === null && !error ? (
            <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" /></div>
          ) : shown.length === 0 ? (
            <p className="py-10 text-center text-gray-500">{filter === 'all' ? 'No payments yet. Subscribe to a plan to get started.' : `No ${filter} bills.`}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead>
                  <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-3">Invoice</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Plan</th>
                    <th className="px-3 py-3">Method</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {shown.map((b) => (
                    <tr key={b.billing_id} className="hover:bg-gray-50">
                      <td className="px-3 py-3 font-mono text-gray-700">INV-{String(b.billing_id).padStart(5, '0')}</td>
                      <td className="px-3 py-3">{formatDate(b.billing_date)}</td>
                      <td className="px-3 py-3">{b.plan_name}</td>
                      <td className="px-3 py-3">{PAYMENT_METHOD_LABELS[b.payment_method] || b.payment_method}</td>
                      <td className="px-3 py-3"><Badge variant={statusVariant[b.payment_status]} size="sm" className="capitalize">{b.payment_status}</Badge></td>
                      <td className="px-3 py-3 text-right tabular-nums">{formatINR(b.amount)}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          {b.payment_status !== 'paid' && (
                            <Button size="sm" onClick={() => { setPaying(b); setMethod('upi'); }}>Pay now</Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<Download className="h-4 w-4" />}
                            loading={downloading === b.billing_id}
                            onClick={() => invoice(b)}
                            aria-label={`Download invoice INV-${String(b.billing_id).padStart(5, '0')}`}
                          >
                            PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {paying && (
        <Modal isOpen={!!paying} onClose={() => !submitting && setPaying(null)} title="Pay outstanding bill" description={`INV-${String(paying.billing_id).padStart(5, '0')} · ${paying.plan_name}`} size="sm">
          <ModalBody>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                <span className="text-gray-600">Amount due</span>
                <span className="text-2xl font-bold">{formatINR(paying.amount)}</span>
              </div>
              <div>
                <label htmlFor="bill-method" className="mb-1 block text-sm font-medium text-gray-700">Payment method</label>
                <select id="bill-method" value={method} onChange={(e) => setMethod(e.target.value)} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                  <option value="upi">UPI</option>
                  <option value="credit_card">Credit card</option>
                  <option value="debit_card">Debit card</option>
                </select>
                <p className="mt-2 text-xs text-gray-500">Demo checkout: no real payment is taken.</p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setPaying(null)} disabled={submitting}>Cancel</Button>
            <Button onClick={pay} loading={submitting}>Pay {formatINR(paying.amount)}</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <RequireAuth role="user">
      <BillingContent />
    </RequireAuth>
  );
}
