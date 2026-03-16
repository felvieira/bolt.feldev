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

  const memberSince = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown';

  return (
    <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background-depth-1 p-4">
      <div className="w-full max-w-lg">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-bolt-elements-textSecondary hover:text-accent mb-4 transition-colors">
          <div className="i-ph:arrow-left text-base" />
          Back to app
        </Link>

        {/* User Info Card */}
        <div className="p-6 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-white text-2xl font-medium">
              {(user.displayName || user.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-bolt-elements-textPrimary">{user.displayName || user.email}</h1>
              <p className="text-sm text-bolt-elements-textSecondary">{user.email}</p>
              <p className="text-xs text-bolt-elements-textTertiary mt-1">Member since {memberSince}</p>
            </div>
          </div>
        </div>

        {/* Update Display Name */}
        <div className="p-6 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor mb-4">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Update Display Name</h2>

          {actionData?.intent === 'updateProfile' && actionData.error && (
            <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {actionData.error}
            </div>
          )}
          {actionData?.intent === 'updateProfile' && actionData.success && (
            <div className="mb-4 p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
              {actionData.success}
            </div>
          )}

          <Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="intent" value="updateProfile" />
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                Display Name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                defaultValue={user.displayName || ''}
                className="w-full px-3 py-2 rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-md bg-accent text-white font-medium hover:brightness-110 transition-all"
            >
              Update Name
            </button>
          </Form>
        </div>

        {/* Change Password */}
        <div className="p-6 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Change Password</h2>

          {actionData?.intent === 'changePassword' && actionData.error && (
            <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {actionData.error}
            </div>
          )}
          {actionData?.intent === 'changePassword' && actionData.success && (
            <div className="mb-4 p-3 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
              {actionData.success}
            </div>
          )}

          <Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="intent" value="changePassword" />
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                Current Password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                className="w-full px-3 py-2 rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                New Password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2 rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                className="w-full px-3 py-2 rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="Repeat new password"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 rounded-md bg-accent text-white font-medium hover:brightness-110 transition-all"
            >
              Change Password
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
