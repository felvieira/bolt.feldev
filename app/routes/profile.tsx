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
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'var(--background)' }}
    >
      <div className="w-full" style={{ maxWidth: 480 }}>
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm mb-6 transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <div className="i-ph:arrow-left text-base" />
          Back to app
        </Link>

        <div className="volt-card" style={{ padding: 32 }}>
          {/* User header */}
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-medium shrink-0"
              style={{ background: 'var(--accent)' }}
            >
              {(user.displayName || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                {user.displayName || user.email}
              </div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {user.email}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Member since {memberSince}
              </div>
            </div>
          </div>

          {/* Account section */}
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            Account
          </p>

          <Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="intent" value="updateProfile" />

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)', marginBottom: 6 }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={user.email}
                readOnly
                className="volt-input w-full"
                style={{ opacity: 0.6, cursor: 'default' }}
              />
            </div>

            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)', marginBottom: 6 }}
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
              <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {actionData.error}
              </div>
            )}
            {actionData?.intent === 'updateProfile' && actionData.success && (
              <div className="p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                {actionData.success}
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" className="btn-primary">
                Save
              </button>
            </div>
          </Form>

          <hr style={{ borderColor: 'var(--border-subtle)', margin: '24px 0' }} />

          {/* Password section */}
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            Password
          </p>

          <Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="intent" value="changePassword" />

            <div>
              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)', marginBottom: 6 }}
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
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)', marginBottom: 6 }}
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
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)', marginBottom: 6 }}
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
              <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {actionData.error}
              </div>
            )}
            {actionData?.intent === 'changePassword' && actionData.success && (
              <div className="p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                {actionData.success}
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" className="btn-primary">
                Save
              </button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}
