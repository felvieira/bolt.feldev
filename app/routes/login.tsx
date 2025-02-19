// app/routes/login.tsx
import type { ActionFunction } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { Form, useActionData } from '@remix-run/react';
import { supabase } from '~/utils/supabase.server';
import { getSession, commitSession } from '~/session.server';
import { Header } from '~/components/header/Header';
import { useState } from 'react';
import type { AuthError } from '@supabase/supabase-js';

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');
  const isSignUp = formData.get('isSignUp') === 'true';

  if (typeof email !== 'string' || typeof password !== 'string') {
    return json({ error: 'Email and password are required.' }, { status: 400 });
  }

  try {
    if (isSignUp) {
      // Handle sign up
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        throw signUpError;
      }

      return json({
        message: 'Please check your email to confirm your account.',
      });
    } else {
      // Handle sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const session = await getSession(request.headers.get('Cookie'));
      session.set('access_token', data.session.access_token);

      return redirect('/', {
        headers: {
          'Set-Cookie': await commitSession(session),
        },
      });
    }
  } catch (error) {
    const authError = error as AuthError;
    return json(
      {
        error: authError.message || 'Authentication failed',
      },
      { status: 400 },
    );
  }
};

export default function Login() {
  const actionData = useActionData<{ error?: string; message?: string }>();
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <>
      <Header />
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-bolt-elements-textPrimary">
            {isSignUp ? 'Join Bolt.diy Community' : 'Welcome Back to Bolt.diy'}
          </h1>
          <p className="text-lg text-bolt-elements-textSecondary">
            {isSignUp ? 'Create an account to get started' : 'Sign in to continue building amazing things'}
          </p>
        </div>

        {actionData?.error && <p className="mb-6 text-red-600 bg-red-50 px-4 py-2 rounded-lg">{actionData.error}</p>}
        {actionData?.message && (
          <p className="mb-6 text-green-600 bg-green-50 px-4 py-2 rounded-lg">{actionData.message}</p>
        )}

        <Form method="post" className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <input type="hidden" name="isSignUp" value={isSignUp.toString()} />
          <div className="mb-4">
            <label htmlFor="email" className="block mb-1">
              Email:
            </label>
            <input id="email" name="email" type="email" required className="w-full border px-3 py-2 rounded" />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block mb-1">
              Password:
            </label>
            <input id="password" name="password" type="password" required className="w-full border px-3 py-2 rounded" />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors mb-4"
          >
            {isSignUp ? 'Create Your Account' : 'Continue to Workspace'}
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-blue-600 hover:text-blue-800 text-sm"
          >
            {isSignUp ? 'Already building with Bolt.diy? Sign in' : 'New to Bolt.diy? Create account'}
          </button>
        </Form>
      </div>
    </>
  );
}
