"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { api, formatINR, type Customer, type Plan } from '@/lib/api';

const PAGE_SIZE = 10;

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  active: 'success',
  paused: 'warning',
  cancelled: 'error',
  expired: 'neutral',
};

const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function CustomersContent() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Customer | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', plan_id: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, p] = await Promise.all([api.customers(), api.plans()]);
      setCustomers(c);
      setPlans(p.filter((x) => x.status === 'Active'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) =>
      (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) &&
      (statusFilter === 'all' || (c.subscription_status || 'none') === statusFilter)
    );
  }, [customers, search, statusFilter]);

  useEffect(() => { setPage(0); }, [search, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const stats = useMemo(() => ({
    total: customers.length,
    active: customers.filter((c) => c.subscription_status === 'active').length,
    paused: customers.filter((c) => c.subscription_status === 'paused').length,
    revenue: customers.reduce((sum, c) => sum + (c.total_spent || 0), 0),
  }), [customers]);

  const submitCustomer = async () => {
    setFormError(null);
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setFormError('Enter a name and a valid email address.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.createCustomer({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        plan_id: form.plan_id ? Number(form.plan_id) : undefined,
      });
      setCreated({ email: form.email.trim(), tempPassword: res.tempPassword });
      setForm({ name: '', email: '', phone: '', plan_id: '' });
      setAddOpen(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create customer');
    } finally {
      setSaving(false);
    }
  };

  const statCards = [
    { label: 'Total Customers', value: stats.total, icon: '👥', bg: 'bg-blue-100', color: 'text-gray-900' },
    { label: 'Active Subscriptions', value: stats.active, icon: '✅', bg: 'bg-green-100', color: 'text-green-600' },
    { label: 'Paused', value: stats.paused, icon: '⏸️', bg: 'bg-yellow-100', color: 'text-yellow-600' },
    { label: 'Total Revenue', value: formatINR(stats.revenue), icon: '💰', bg: 'bg-purple-100', color: 'text-purple-600' },
  ];

  return (
    <div className="py-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Management</h1>
        <p className="text-gray-600">Customer profiles, subscriptions and billing</p>
      </div>

      {created && (
        <div role="status" className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Customer created. Share these sign-in details: <strong>{created.email}</strong> / <code className="font-mono">{created.tempPassword}</code>
          <button onClick={() => setCreated(null)} className="ml-3 underline">Dismiss</button>
        </div>
      )}
      {error && (
        <div role="alert" className="mb-6 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={load} className="font-medium underline">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${s.bg}`}><span className="text-2xl">{s.icon}</span></div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{loading ? '…' : s.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Customers</CardTitle>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sm:w-64"
                aria-label="Search customers"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by subscription status"
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
                <option value="expired">Expired</option>
                <option value="none">No subscription</option>
              </select>
              <Button onClick={() => { setAddOpen(true); setFormError(null); }}>Add Customer</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Plan</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Total Spent</th>
                      <th className="px-3 py-3">Last Payment</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageRows.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <div className="font-medium text-gray-900">{c.name}</div>
                          <div className="text-gray-500">{c.email}</div>
                        </td>
                        <td className="px-3 py-3">{c.subscription || '—'}</td>
                        <td className="px-3 py-3">
                          {c.subscription_status
                            ? <Badge variant={statusVariant[c.subscription_status]} size="sm" className="capitalize">{c.subscription_status}</Badge>
                            : <span className="text-gray-400">None</span>}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{formatINR(c.total_spent)}</td>
                        <td className="px-3 py-3">{formatDate(c.last_payment)}</td>
                        <td className="px-3 py-3 text-right">
                          <Button size="sm" variant="secondary" onClick={() => setSelected(c)}>View</Button>
                        </td>
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-500">No customers match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                <span>{filtered.length} customer{filtered.length === 1 ? '' : 's'}</span>
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

      {/* Add customer */}
      <Modal isOpen={addOpen} onClose={() => !saving && setAddOpen(false)} title="Add New Customer" description="Creates an account with a temporary password" size="md">
        <ModalBody>
          <div className="space-y-4">
            <Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Customer name" />
            <Input label="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" />
            <Input label="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit number" />
            <div>
              <label htmlFor="initial-plan" className="block text-sm font-medium text-gray-700 mb-1">Initial plan</label>
              <select
                id="initial-plan"
                value={form.plan_id}
                onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">No plan yet</option>
                {plans.map((p) => <option key={p.plan_id} value={p.plan_id}>{p.plan_name} – {formatINR(p.price)}</option>)}
              </select>
            </div>
            {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submitCustomer} loading={saving}>Add Customer</Button>
        </ModalFooter>
      </Modal>

      {/* Customer details */}
      {selected && (
        <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected.name} description={selected.email} size="md">
          <ModalBody>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Current plan</dt><dd className="text-base">{selected.subscription || '—'}</dd></div>
              <div><dt className="text-gray-500">Subscription status</dt><dd className="text-base capitalize">{selected.subscription_status || 'None'}</dd></div>
              <div><dt className="text-gray-500">Subscribed since</dt><dd className="text-base">{formatDate(selected.start_date)}</dd></div>
              <div><dt className="text-gray-500">Last payment</dt><dd className="text-base">{formatDate(selected.last_payment)}</dd></div>
              <div><dt className="text-gray-500">Total spent</dt><dd className="text-base font-semibold text-green-600">{formatINR(selected.total_spent)}</dd></div>
              <div><dt className="text-gray-500">Account</dt><dd className="text-base capitalize">{selected.account_status}</dd></div>
              <div><dt className="text-gray-500">Phone</dt><dd className="text-base">{selected.phone || '—'}</dd></div>
              <div><dt className="text-gray-500">Joined</dt><dd className="text-base">{formatDate(selected.created_at)}</dd></div>
            </dl>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <RequireAuth role="admin">
      <CustomersContent />
    </RequireAuth>
  );
}
