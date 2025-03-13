// In app/routes/login.tsx, update the action function
export const action = async (args: { context: ExpressAppContext, request: Request }) => {
  // Dynamically import server modules
  const { json, redirect } = await import('@remix-run/node');
  const { createApiHandler } = await import('~/utils/api-utils.server');
  const { getSupabaseClient } = await import('~/utils/supabase.server');
  const { getSession, commitSession } = await import('~/session.server');
  
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
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
      const bodyText = await new Response(request.body).text();
      formData = Object.fromEntries(new URLSearchParams(bodyText));
    }
    
    const email = formData.email?.toString();
    const password = formData.password?.toString();
    const isSignUp = formData.isSignUp === 'true';

    if (typeof email !== 'string' || typeof password !== 'string') {
      return json({ error: 'Email and password are required.' }, { status: 400 });
    }

    try {
      // Get Supabase client when needed
      const supabase = getSupabaseClient();

      if (isSignUp) {
        // Handle sign up logic...
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
        const session = await getSession(cookieHeader, context);
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
      // Error handling...
    }
  });

  return handler(args.context, args.request, args.context.res);
};
