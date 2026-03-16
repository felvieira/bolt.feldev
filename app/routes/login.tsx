import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { Form, Link, useActionData } from '@remix-run/react';
import { loginUser, getSessionToken, verifySession } from '~/lib/auth.server';

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
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');

  if (!email || !password) {
    return json({ error: 'Email and password are required' }, { status: 400 });
  }

  try {
    const { token } = await loginUser(email, password);

    return redirect('/', {
      headers: {
        'Set-Cookie': `bolt_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      },
    });
  } catch (error: any) {
    return json({ error: error.message || 'Login failed' }, { status: 400 });
  }
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bolt-elements-background-depth-1">
      <div className="w-full max-w-md p-8 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
        <div className="flex justify-center mb-6">
          <img src="/logo-dark-styled.png" alt="Bolt" className="w-[120px] hidden dark:block" />
          <img src="/logo-light-styled.png" alt="Bolt" className="w-[120px] dark:hidden" />
        </div>
        <h1 className="text-2xl font-bold text-bolt-elements-textPrimary text-center mb-6">Sign In</h1>

        {actionData?.error && (
          <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {actionData.error}
          </div>
        )}

        <Form method="post" className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3 py-2 rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-bolt-elements-textSecondary mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3 py-2 rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 rounded-md bg-accent text-white font-medium hover:brightness-110 transition-all"
          >
            Login
          </button>
        </Form>

        <p className="mt-4 text-center text-sm text-bolt-elements-textSecondary">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-accent hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
