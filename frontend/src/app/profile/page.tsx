"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useAuthStore } from '@/store/auth-store';
import { api, formatDate, session } from '@/lib/api';

function Banner({ kind, text, onClose }: { kind: 'ok' | 'err'; text: string; onClose: () => void }) {
  return (
    <div
      role={kind === 'ok' ? 'status' : 'alert'}
      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${kind === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700'}`}
    >
      <span>{text}</span>
      <button type="button" onClick={onClose} className="underline">Dismiss</button>
    </div>
  );
}

function ProfileContent() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [profile, setProfile] = useState({ name: '', phone: '', email: '', created_at: '' });
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    api.me()
      .then((me) => setProfile({ name: me.name, phone: me.phone || '', email: me.email, created_at: me.created_at }))
      .catch((e) => setProfileMsg({ kind: 'err', text: e.message }))
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    if (!profile.name.trim()) return setProfileMsg({ kind: 'err', text: 'Name cannot be empty.' });
    setSavingProfile(true);
    try {
      await api.updateProfile({ name: profile.name.trim(), phone: profile.phone.trim() });
      if (user) {
        const updated = { ...user, name: profile.name.trim() };
        setUser(updated);
        const saved = session.getUser();
        if (saved) localStorage.setItem('lq_user', JSON.stringify({ ...saved, name: updated.name, phone: profile.phone.trim() }));
      }
      setProfileMsg({ kind: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setProfileMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Could not update profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next.length < 8) return setPwMsg({ kind: 'err', text: 'New password must be at least 8 characters.' });
    if (pw.next !== pw.confirm) return setPwMsg({ kind: 'err', text: 'New passwords do not match.' });
    setSavingPw(true);
    try {
      await api.updateProfile({ password: pw.next, current_password: pw.current });
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ kind: 'ok', text: 'Password changed. Use your new password next time you sign in.' });
    } catch (err) {
      setPwMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Could not change password' });
    } finally {
      setSavingPw(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary-600" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Profile &amp; Security</h1>
        <p className="mt-1 text-gray-600">Member since {formatDate(profile.created_at)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
          <CardDescription>This is how you appear on invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <Input label="Full name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            <Input label="Email" value={profile.email} disabled helperText="Email can't be changed." />
            <Input label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="10-digit number" />
            {profileMsg && <Banner kind={profileMsg.kind} text={profileMsg.text} onClose={() => setProfileMsg(null)} />}
            <Button type="submit" loading={savingProfile}>Save changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <Input label="Current password" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <Input label="New password" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} helperText="At least 8 characters." />
            <Input label="Confirm new password" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            {pwMsg && <Banner kind={pwMsg.kind} text={pwMsg.text} onClose={() => setPwMsg(null)} />}
            <Button type="submit" loading={savingPw}>Update password</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Sign out</p>
            <p className="text-sm text-gray-600">End your session on this device.</p>
          </div>
          <Button variant="secondary" onClick={() => { logout(); router.push('/login'); }}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
