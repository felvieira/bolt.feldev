import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react';
import { getSessionToken, verifySession } from '~/lib/auth.server';
import { useState } from 'react';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3200';

export async function loader({ request }: LoaderFunctionArgs) {
  const token = getSessionToken(request);

  if (!token) {
    return redirect('/login');
  }

  const user = await verifySession(token);

  if (!user) {
    return redirect('/login');
  }

  // Fetch full profile with createdAt
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      return json({ user: data.user });
    }
  } catch {
    // fall through
  }

  return json({ user: { ...user, createdAt: null } });
}

export async function action({ request }: ActionFunctionArgs) {
  const token = getSessionToken(request);

  if (!token) {
    return redirect('/login');
  }

  const formData = await request.formData();
  const intent = String(formData.get('intent'));

  if (intent === 'updateProfile') {
    const displayName = String(formData.get('displayName') || '');

    if (!displayName.trim()) {
      return json({ error: 'Display name is required', success: null, intent }, { status: 400 });
    }

    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        return json({ error: err.error?.message || 'Update failed', success: null, intent }, { status: 400 });
      }

      return json({ error: null, success: 'Display name updated', intent });
    } catch {
      return json({ error: 'Failed to connect to auth service', success: null, intent }, { status: 500 });
    }
  }

  if (intent === 'changePassword') {
    const currentPassword = String(formData.get('currentPassword') || '');
    const newPassword = String(formData.get('newPassword') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');

    if (!currentPassword || !newPassword) {
      return json({ error: 'All password fields are required', success: null, intent }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return json({ error: 'New password must be at least 8 characters', success: null, intent }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return json({ error: 'New passwords do not match', success: null, intent }, { status: 400 });
    }

    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!res.ok) {
        const err = await res.json();
        return json({ error: err.error?.message || 'Password change failed', success: null, intent }, { status: 400 });
      }

      return json({ error: null, success: 'Password changed successfully', intent });
    } catch {
      return json({ error: 'Failed to connect to auth service', success: null, intent }, { status: 500 });
    }
  }

  return json({ error: 'Unknown action', success: null, intent }, { status: 400 });
}

export default function ProfilePage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Unknown';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full" style={{ maxWidth: 520 }}>
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm mb-8 transition-colors group"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <div className="i-ph:arrow-left text-base transition-transform group-hover:-translate-x-0.5" />
          Back to app
        </Link>

        <div
          className="volt-card"
          style={{
            padding: 0,
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* User header */}
          <div
            className="flex items-center gap-5 p-8"
            style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-2)' }}
          >
            <div
              className="relative group w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-semibold shrink-0 ring-2 ring-white/10"
              style={{ background: 'var(--accent)' }}
            >
              {(user.displayName || user.email).charAt(0).toUpperCase()}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.5)' }}
              >
                <div className="i-ph:camera text-white text-lg" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {user.displayName || user.email}
              </div>
              <div className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                {user.email}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                Member since {memberSince}
              </div>
            </div>
          </div>

          {/* Account section */}
          <div className="p-8">
            <div className="flex items-center gap-2 mb-5">
              <div className="i-ph:user-circle text-base" style={{ color: 'var(--text-tertiary)' }} />
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Account
              </p>
            </div>

            <Form method="post" className="flex flex-col gap-5">
              <input type="hidden" name="intent" value="updateProfile" />

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={user.email}
                  readOnly
                  className="volt-input w-full"
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                />
              </div>

              <div>
                <label
                  htmlFor="displayName"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Display Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  defaultValue={user.displayName || ''}
                  className="volt-input w-full"
                />
              </div>

              {actionData?.intent === 'updateProfile' && actionData.error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {actionData.error}
                </div>
              )}
              {actionData?.intent === 'updateProfile' && actionData.success && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                  {actionData.success}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="btn-primary px-6 py-2 text-sm font-medium rounded-lg transition-all"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Save Changes
                </button>
              </div>
            </Form>
          </div>

          {/* Divider */}
          <div className="mx-8" style={{ height: 1, background: 'var(--border-subtle)' }} />

          {/* Password section */}
          <div className="p-8">
            <div className="flex items-center gap-2 mb-5">
              <div className="i-ph:lock-simple text-base" style={{ color: 'var(--text-tertiary)' }} />
              <p
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Password
              </p>
            </div>

            <Form method="post" className="flex flex-col gap-5">
              <input type="hidden" name="intent" value="changePassword" />

              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  required
                  className="volt-input w-full"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  minLength={8}
                  className="volt-input w-full"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  className="volt-input w-full"
                  placeholder="Repeat new password"
                />
              </div>

              {actionData?.intent === 'changePassword' && actionData.error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {actionData.error}
                </div>
              )}
              {actionData?.intent === 'changePassword' && actionData.success && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                  {actionData.success}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="btn-primary px-6 py-2 text-sm font-medium rounded-lg transition-all"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  Update Password
                </button>
              </div>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
