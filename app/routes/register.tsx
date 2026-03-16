import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { Form, Link, useActionData } from '@remix-run/react';
import { registerUser, getSessionToken, verifySession } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const token = getSessionToken(request);

  if (token) {
    const user = await verifySession(token);

    if (user) {
      return redirect('/');
    }
  }

  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const displayName = String(formData.get('displayName') || '');
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (!email || !password) {
    return json({ error: 'Email and password are required' }, { status: 400 });
  }

  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return json({ error: 'Passwords do not match' }, { status: 400 });
  }

  try {
    const { token } = await registerUser(email, password, displayName || undefined);

    return redirect('/', {
      headers: {
        'Set-Cookie': `bolt_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      },
    });
  } catch (error: any) {
    return json({ error: error.message || 'Registration failed' }, { status: 400 });
  }
}

export default function RegisterPage() {
  const actionData = useActionData<typeof action>();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'var(--background)' }}
    >
      {/* Logo above card */}
      <div className="flex flex-col items-center mb-6 gap-2">
        <img src="/volt-logo.svg" alt="Volt" style={{ width: 32, height: 32, filter: 'brightness(0) invert(1)' }} />
        <span className="text-xs font-semibold tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
          VOLT
        </span>
      </div>

      <div className="volt-card w-full" style={{ maxWidth: 380, padding: 32 }}>
        <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
          Create account
        </h1>

        {actionData?.error && (
          <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="flex flex-col gap-4">
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
              className="volt-input w-full"
              placeholder="Your name"
            />
          </div>

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
              name="email"
              type="email"
              required
              className="volt-input w-full"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium"
              style={{ color: 'var(--text-secondary)', marginBottom: 6 }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="volt-input w-full"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium"
              style={{ color: 'var(--text-secondary)', marginBottom: 6 }}
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="volt-input w-full"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" className="btn-primary w-full mt-2">
            Create account
          </button>
        </Form>

        <p className="mt-4 text-center text-sm">
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
