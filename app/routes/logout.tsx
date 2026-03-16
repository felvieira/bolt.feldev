import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { redirect } from '@remix-run/cloudflare';

const CLEAR_COOKIE = 'bolt_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';

export async function loader({ request }: LoaderFunctionArgs) {
  return redirect('/login', {
    headers: { 'Set-Cookie': CLEAR_COOKIE },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  return redirect('/login', {
    headers: { 'Set-Cookie': CLEAR_COOKIE },
  });
}
