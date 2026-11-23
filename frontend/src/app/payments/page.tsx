"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { api, formatINR, formatDate, PAYMENT_METHOD_LABELS, type AdminBill } from '@/lib/api';
import { Download } from 'lucide-react';
import { DateRangeFilter, ALL_TIME, inRange, type DateRange } from '@/components/ui/DateRangeFilter';

const PAGE_SIZE = 15;
const variant = { paid: 'success', pending: 'warning', failed: 'error' } as const;

function PaymentsContent() {
  const [bills, setBills] = useState<AdminBill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | AdminBill['payment_status']>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBills(await api.adminBilling());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payments');
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const [range, setRange] = useState<DateRange>(ALL_TIME);
  useEffect(() => { setPage(0); }, [status, search, range]);

  // Bills inside the selected date range (drives the totals and the table)
  const inPeriod = useMemo(() => (bills || []).filter((b) => inRange(b.billing_date, range)), [bills, range]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inPeriod.filter((b) =>
      (status === 'all' || b.payment_status === status) &&
      (!q || b.name.toLowerCase().includes(q) || b.email.toLowerCase().includes(q) || `inv-${String(b.billing_id).padStart(5, '0')}`.includes(q))
    );
  }, [inPeriod, status, search]);

  const totals = useMemo(() => {
    const sum = (s: string) => inPeriod.filter((b) => b.payment_status === s).reduce((a, b) => a + b.amount, 0);
    const count = (s: string) => inPeriod.filter((b) => b.payment_status === s).length;
    return { paid: sum('paid'), pending: sum('pending'), failed: sum('failed'), pendingN: count('pending'), failedN: count('failed') };
  }, [inPeriod]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const markPaid = async (b: AdminBill) => {
    if (!window.confirm(`Mark INV-${String(b.billing_id).padStart(5, '0')} (${formatINR(b.amount)}) from ${b.name} as paid?`)) return;
    setBusy(b.billing_id);
    try {
      setNotice((await api.markBillPaid(b.billing_id)).message);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update bill');
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = () => {
    const header = ['Invoice', 'Date', 'Customer', 'Email', 'Plan', 'Method', 'Status', 'Amount'];
    const lines = filtered.map((b) => [`INV-${String(b.billing_id).padStart(5, '0')}`, b.billing_date, b.name, b.email, b.plan_name, b.payment_method, b.payment_status, b.amount]);
    const csv = [header, ...lines].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    const period = range.from || range.to ? `${range.from || 'start'}_to_${range.to || 'today'}` : 'all-time';
    a.download = `payments-${status}-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          <p className="mt-1 text-gray-600">All bills across customers. Follow up on pending and failed payments.</p>
        </div>
        <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>
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
        <button onClick={() => setStatus('paid')} className="text-left"><Card className="h-full hover:shadow-md"><CardContent><p className="text-sm text-gray-600">Collected</p><p className="text-2xl font-bold text-green-600">{formatINR(totals.paid)}</p></CardContent></Card></button>
        <button onClick={() => setStatus('pending')} className="text-left"><Card className="h-full hover:shadow-md"><CardContent><p className="text-sm text-gray-600">Pending ({totals.pendingN})</p><p className="text-2xl font-bold text-amber-600">{formatINR(totals.pending)}</p></CardContent></Card></button>
        <button onClick={() => setStatus('failed')} className="text-left"><Card className="h-full hover:shadow-md"><CardContent><p className="text-sm text-gray-600">Failed ({totals.failedN})</p><p className="text-2xl font-bold text-red-600">{formatINR(totals.failed)}</p></CardContent></Card></button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>Bills</CardTitle>
            <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
              <DateRangeFilter value={range} onChange={setRange} label="Billing date" />
              <Input placeholder="Search customer or invoice…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" aria-label="Search payments" />
              <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm" role="tablist" aria-label="Filter by payment status">
                {(['all', 'paid', 'pending', 'failed'] as const).map((s) => (
                  <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
                    className={`rounded-md px-3 py-1.5 capitalize ${status === s ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {bills === null && !error ? (
            <div className="flex justify-center py-12"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead><tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-3">Invoice</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Plan</th><th className="px-3 py-3">Method</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3" />
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((b) => (
                      <tr key={b.billing_id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 font-mono">INV-{String(b.billing_id).padStart(5, '0')}</td>
                        <td className="px-3 py-3">{formatDate(b.billing_date)}</td>
                        <td className="px-3 py-3">
                          <Link href={`/customer?id=${b.user_id}`} className="font-medium text-gray-900 hover:text-primary-700">{b.name}</Link>
                          <div className="text-gray-500">{b.email}</div>
                        </td>
                        <td className="px-3 py-3">{b.plan_name}</td>
                        <td className="px-3 py-3">{PAYMENT_METHOD_LABELS[b.payment_method] || b.payment_method}</td>
                        <td className="px-3 py-3"><Badge variant={variant[b.payment_status]} size="sm" className="capitalize">{b.payment_status}</Badge></td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatINR(b.amount)}</td>
                        <td className="px-3 py-3 text-right">
                          {b.payment_status !== 'paid' && (
                            <Button size="sm" variant="secondary" loading={busy === b.billing_id} onClick={() => markPaid(b)}>Mark paid</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-500">No bills match your filters.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>{filtered.length} bill{filtered.length === 1 ? '' : 's'}</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span>Page {page + 1} of {pageCount}</span>
                  <Button size="sm" variant="secondary" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <RequireAuth role="admin">
      <PaymentsContent />
    </RequireAuth>
  );
}
