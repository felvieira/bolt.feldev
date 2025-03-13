export const action = async (args: { context: ExpressAppContext, request: Request }) => {
  // Dynamically import server modules
  const { json, redirect } = await import('@remix-run/node');
  const { createApiHandler } = await import('~/utils/api-utils.server');
  const { getSupabaseClient } = await import('~/utils/supabase.server');
  const { getSession, commitSession } = await import('~/session.server');
  
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    try {
      // Handle both Remix and Express-style requests
      let formData;
      
      if (request instanceof Request) {
        // Remix-style request
        formData = await request.formData();
      } else if (request.body && typeof request.body === 'object') {
        // Express-style request with already parsed body
        formData = request.body;
      } else {
        // Express-style request with unparsed body
        try {
          const bodyText = await new Response(request.body).text();
          formData = Object.fromEntries(new URLSearchParams(bodyText));
        } catch (e) {
          console.error("Error parsing form data:", e);
          return json({ error: 'Invalid form submission' }, { status: 400 });
        }
      }
      
      const email = formData.email?.toString();
      const password = formData.password?.toString();
      const isSignUp = formData.isSignUp === 'true';

      if (typeof email !== 'string' || typeof password !== 'string') {
        return json({ error: 'Email and password are required.' }, { status: 400 });
      }

      // Get Supabase client when needed
      const supabase = getSupabaseClient(context);

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
        session.set('user_id', data.user.id);

        // Set cookie and redirect
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
