import { redirect } from '@remix-run/cloudflare';
import { getSession } from '~/session.server';

export async function requireAuth(request: Request) {
  const session = await getSession(request.headers.get('Cookie'));
  const accessToken = session.get('access_token');

  if (!accessToken) {
    throw redirect('/login');
  }

  return accessToken;
}
