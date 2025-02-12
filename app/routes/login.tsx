// app/routes/login.tsx
import type { ActionFunction } from '@remix-run/cloudflare';
import { json, redirect } from '@remix-run/cloudflare';
import { Form, useActionData } from '@remix-run/react';
import { supabase } from '~/utils/supabase.server';
import { getSession, commitSession } from '~/session.server';
import { Header } from '~/components/header/Header';

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get('email');
  const password = formData.get('password');

  if (typeof email !== 'string' || typeof password !== 'string') {
    return json({ error: 'Email and password are required.' }, { status: 400 });
  }

  // Utiliza supabase-js para efetuar login
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return json({ error: error?.message || 'Login failed' }, { status: 400 });
  }

  // Armazena o token de acesso na sessão (por exemplo, em um cookie)
  const session = await getSession(request.headers.get('Cookie'));
  session.set('access_token', data.session.access_token);

  return redirect('/', {
    headers: {
      'Set-Cookie': await commitSession(session),
    },
  });
};

export default function Login() {
  const actionData = useActionData<{ error?: string }>();

  return (
    <>
      <Header />
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <h1 className="text-2xl font-bold mb-4">Login</h1>
        {actionData?.error && (
          <p className="mb-4 text-red-600">{actionData.error}</p>
        )}
        <Form method="post" className="bg-white p-6 rounded shadow-md w-full max-w-sm">
          <div className="mb-4">
            <label htmlFor="email" className="block mb-1">Email:</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="block mb-1">Password:</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Sign In
          </button>
        </Form>
      </div>
    </>
  );
}
