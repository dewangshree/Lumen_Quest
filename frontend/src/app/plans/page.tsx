"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { api, formatINR, type AdminPlan, type PlanInput } from '@/lib/api';
import { Pencil, Plus, Trash2 } from 'lucide-react';

const EMPTY = { plan_name: '', price: '', quota_sessions: '', validity_days: '30', auto_renewal_allowed: 'Yes', description: '', status: 'Active' };
type FormState = typeof EMPTY;

function PlansContent() {
  const [plans, setPlans] = useState<AdminPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPlan | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPlans(await api.adminPlans());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plans');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (p: AdminPlan | 'new') => {
    setEditing(p);
    setFormError(null);
    setForm(p === 'new' ? EMPTY : {
      plan_name: p.plan_name, price: String(p.price), quota_sessions: String(p.quota_sessions),
      validity_days: String(p.validity_days), auto_renewal_allowed: p.auto_renewal_allowed,
      description: p.description || '', status: p.status,
    });
  };

  const save = async () => {
    setFormError(null);
    const price = Number(form.price), quota = Number(form.quota_sessions), validity = Number(form.validity_days);
    if (!form.plan_name.trim()) return setFormError('Plan name is required.');
    if (form.price === '' || !(price >= 0)) return setFormError('Enter a valid price.');
    if (form.quota_sessions === '' || !Number.isInteger(quota) || quota < 0) return setFormError('Sessions must be a whole number.');
    if (!Number.isInteger(validity) || validity < 1) return setFormError('Validity must be at least 1 day.');
    const body: PlanInput = {
      plan_name: form.plan_name.trim(), price, quota_sessions: quota, validity_days: validity,
      auto_renewal_allowed: form.auto_renewal_allowed as PlanInput['auto_renewal_allowed'],
      description: form.description.trim() || null, status: form.status as PlanInput['status'],
    };
    setSaving(true);
    try {
      if (editing === 'new') await api.createPlan(body);
      else if (editing) await api.updatePlan(editing.plan_id, body);
      setNotice(editing === 'new' ? `Plan "${body.plan_name}" created.` : `Plan "${body.plan_name}" updated.`);
      setEditing(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not save plan');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: AdminPlan) => {
    setBusy(p.plan_id);
    try {
      const status = p.status === 'Active' ? 'Inactive' : 'Active';
      await api.updatePlan(p.plan_id, { status });
      setNotice(`${p.plan_name} is now ${status === 'Active' ? 'visible to' : 'hidden from'} customers.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update plan');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (p: AdminPlan) => {
    if (!window.confirm(`Delete ${p.plan_name}? This cannot be undone.`)) return;
    setBusy(p.plan_id);
    try {
      await api.deletePlan(p.plan_id);
      setNotice(`${p.plan_name} deleted.`);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not delete plan';
      setError(/referenced/i.test(msg) ? `${p.plan_name} has subscription history, so it can't be deleted. Deactivate it instead.` : msg);
    } finally {
      setBusy(null);
    }
  };

  const field = (k: keyof FormState) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Plan Management</h1>
          <p className="mt-1 text-gray-600">Create, edit and retire the plans customers can subscribe to.</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => openEdit('new')}>New plan</Button>
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
          <button onClick={() => setError(null)} className="font-medium underline">Dismiss</button>
        </div>
      )}

      {plans === null ? (
        <div className="flex justify-center py-16"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <Card key={p.plan_id} role="group" aria-label={p.plan_name} className={p.status === 'Inactive' ? 'opacity-70' : ''}>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{p.plan_name}</h2>
                    <p className="text-2xl font-bold text-gray-900">{formatINR(p.price)} <span className="text-sm font-normal text-gray-500">/ {p.validity_days} days</span></p>
                  </div>
                  <Badge variant={p.status === 'Active' ? 'success' : 'neutral'}>{p.status}</Badge>
                </div>
                {p.description && <p className="text-sm text-gray-600">{p.description}</p>}
                <dl className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-center text-sm">
                  <div><dt className="text-gray-500">Sessions</dt><dd className="font-semibold">{p.quota_sessions}</dd></div>
                  <div><dt className="text-gray-500">Subscribers</dt><dd className="font-semibold">{p.active_subscribers}</dd></div>
                  <div><dt className="text-gray-500">Auto-renew</dt><dd className="font-semibold">{p.auto_renewal_allowed}</dd></div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(p)}>Edit</Button>
                  <Button size="sm" variant="secondary" loading={busy === p.plan_id} onClick={() => toggle(p)}>
                    {p.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" icon={<Trash2 className="h-4 w-4" />} onClick={() => remove(p)} aria-label={`Delete ${p.plan_name}`}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal isOpen={!!editing} onClose={() => !saving && setEditing(null)} title={editing === 'new' ? 'New plan' : `Edit ${editing.plan_name}`} size="md">
          <ModalBody>
            <div className="space-y-4">
              <Input label="Plan name" {...field('plan_name')} />
              <div className="grid grid-cols-3 gap-3">
                <Input label="Price (₹)" type="number" min="0" step="0.01" {...field('price')} />
                <Input label="Sessions" type="number" min="0" step="1" {...field('quota_sessions')} />
                <Input label="Validity (days)" type="number" min="1" step="1" {...field('validity_days')} />
              </div>
              <Input label="Description" {...field('description')} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="plan-renew" className="mb-1 block text-sm font-medium text-gray-700">Auto-renewal</label>
                  <select id="plan-renew" value={form.auto_renewal_allowed} onChange={(e) => setForm({ ...form, auto_renewal_allowed: e.target.value })} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                    <option>Yes</option><option>No</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="plan-status" className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                  <select id="plan-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
                    <option>Active</option><option>Inactive</option>
                  </select>
                </div>
              </div>
              {formError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} loading={saving}>{editing === 'new' ? 'Create plan' : 'Save changes'}</Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}

export default function PlansPage() {
  return (
    <RequireAuth role="admin">
      <PlansContent />
    </RequireAuth>
  );
}
