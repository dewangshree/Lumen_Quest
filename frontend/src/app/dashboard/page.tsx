"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageContainer } from '@/components/layout/PageContainer';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { api, formatINR, type Stats } from '@/lib/api';
import { RefreshCw } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const PLAN_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

const activityIcon: Record<string, string> = { paid: '💰', pending: '⏳', failed: '⚠️' };
const activityVariant: Record<string, 'success' | 'warning' | 'error'> = { paid: 'success', pending: 'warning', failed: 'error' };

function downloadCsv(stats: Stats) {
  const rows = [
    ['Metric', 'Value'],
    ['Total revenue (paid)', stats.kpi.total_revenue],
    ['Pending revenue', stats.kpi.pending_revenue],
    ['Failed payments', stats.kpi.failed_revenue],
    ['Customers', stats.kpi.total_customers],
    ['Active subscriptions', stats.kpi.active_subscriptions],
    ['Churn rate %', stats.kpi.churn_rate],
    ['ARPU', stats.kpi.arpu],
    [],
    ['Month', 'Paid revenue', 'Bills'],
    ...stats.revenueByMonth.map((r) => [r.month, r.revenue ?? 0, r.bills]),
    [],
    ['Plan', 'Active/paused subscriptions'],
    ...stats.planDistribution.map((p) => [p.name, p.value]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `lumen-quest-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function DashboardContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      setStats(await api.stats());
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div role="alert" className="mx-auto mt-12 max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p>{error}</p>
        <button onClick={load} className="mt-3 font-medium underline">Retry</button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    );
  }

  const { kpi } = stats;
  const revenueData = stats.revenueByMonth.map((r) => ({ month: monthLabel(r.month), revenue: r.revenue ?? 0 }));
  const subsData = stats.subscriptionsByMonth.map((r) => ({ month: monthLabel(r.month), new: r.new, churned: r.churned }));

  const kpiCards = [
    { label: 'Total Revenue', value: formatINR(kpi.total_revenue), icon: '💰', bg: 'bg-green-100', note: `${formatINR(kpi.pending_revenue)} pending`, variant: 'warning' as const },
    { label: 'Customers', value: kpi.total_customers.toLocaleString('en-IN'), icon: '👥', bg: 'bg-blue-100', note: `${kpi.active_customers} active accounts`, variant: 'primary' as const },
    { label: 'Active Subscriptions', value: kpi.active_subscriptions.toLocaleString('en-IN'), icon: '📈', bg: 'bg-purple-100', note: `of ${kpi.total_subscriptions} total`, variant: 'primary' as const },
    { label: 'Churn Rate', value: `${kpi.churn_rate}%`, icon: '📉', bg: 'bg-red-100', note: `${kpi.churned_subscriptions} cancelled/expired`, variant: 'error' as const },
    { label: 'Avg Revenue / Payer', value: formatINR(kpi.arpu), icon: '💵', bg: 'bg-yellow-100', note: `${kpi.paying_customers} paying customers`, variant: 'success' as const },
    { label: 'Failed Payments', value: formatINR(kpi.failed_revenue), icon: '⚠️', bg: 'bg-orange-100', note: 'needs follow-up', variant: 'error' as const },
  ];

  return (
    <PageContainer
      title="Analytics Dashboard"
      description="Live overview of your subscription business"
      action={
        <div className="flex flex-wrap items-center gap-3">
          {updatedAt && (
            <span className="text-xs text-gray-500" aria-live="polite">
              Updated {updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-wait"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={() => downloadCsv(stats)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
            Export Report
          </button>
        </div>
      }
    >
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {kpiCards.map((k) => (
            <Card key={k.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{k.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${k.bg}`}><span className="text-2xl">{k.icon}</span></div>
                </div>
                <div className="mt-2"><Badge variant={k.variant} size="sm">{k.note}</Badge></div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader><CardTitle>Revenue by Month (paid)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatINR(Number(value)), 'Revenue']} />
                  <Area type="monotone" dataKey="revenue" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>New vs Churned Subscriptions</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={subsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="new" fill="#10B981" name="New" />
                  <Bar dataKey="churned" fill="#EF4444" name="Churned" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader><CardTitle>Plan Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={stats.planDistribution} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                    {stats.planDistribution.map((_, i) => <Cell key={i} fill={PLAN_COLORS[i % PLAN_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Subscription Status</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.statusBreakdown.map((s) => {
                  const pct = kpi.total_subscriptions ? Math.round((100 * s.value) / kpi.total_subscriptions) : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex justify-between text-sm">
                        <span className="capitalize text-gray-700">{s.name}</span>
                        <span className="tabular-nums text-gray-900">{s.value} ({pct}%)</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Customers</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topCustomers.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-sm text-gray-500">{c.plan || '—'}</div>
                    </div>
                    <div className="font-semibold tabular-nums">{formatINR(c.total_spent)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Recent Billing Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentActivity.map((a) => (
                <div key={a.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl">{activityIcon[a.type] || '📊'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.name} · {a.plan_name}</p>
                    <p className="text-sm text-gray-500">{new Date(a.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <Badge variant={activityVariant[a.type]} size="sm" className="capitalize">{a.type}</Badge>
                  <div className="font-semibold tabular-nums w-24 text-right">{formatINR(a.amount)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

export default function DashboardPage() {
  return (
    <RequireAuth role="admin">
      <DashboardContent />
    </RequireAuth>
  );
}
