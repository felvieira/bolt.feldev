// app/routes/login.tsx
import { Request, Response } from 'express';
import { Form, useActionData } from '@remix-run/react';
import { Header } from '~/components/header/Header';
import { useState } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

export const action = async (args: { context: ExpressAppContext, request: Request }) => {
  // Dynamically import server modules
  const { json, redirect } = await import('@remix-run/node');
  const { createApiHandler } = await import('~/utils/api-utils.server');
  const { getSupabaseClient } = await import('~/utils/supabase.server');
  const { getSession, commitSession } = await import('~/session.server');
  
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    // Express typically uses middleware like express.urlencoded() to parse form data
    // If that middleware is active, the data will be in request.body
    // Otherwise, we need to handle form parsing ourselves
    const formData = request.body || {};
    
    const email = formData.email;
    const password = formData.password;
    const isSignUp = formData.isSignUp === 'true';

    if (typeof email !== 'string' || typeof password !== 'string') {
      return json({ error: 'Email and password are required.' }, { status: 400 });
    }

    try {
      // Get Supabase client when needed
      const supabase = getSupabaseClient();

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

        // Get session from request cookies
        const cookieHeader = request.headers.cookie || '';
        const session = await getSession(cookieHeader);
        session.set('access_token', data.session.access_token);

        // Set cookie and redirect - using Remix pattern
        const cookie = await commitSession(session);
        return redirect('/', {
          headers: {
            'Set-Cookie': cookie
          }
        });
      }
    } catch (error) {
      const authError = error as AuthError;
      return json({
        error: authError.message || 'Authentication failed',
      }, { status: 400 });
    }
  });

  return handler(args.context, args.request, args.context.res);
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
