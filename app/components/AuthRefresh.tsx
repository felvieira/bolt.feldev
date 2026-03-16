import { useEffect } from 'react';
import { useRouteLoaderData, useNavigate } from '@remix-run/react';
import type { AuthUser } from '~/lib/auth.server';

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function AuthRefresh() {
  const data = useRouteLoaderData('root') as { user: AuthUser | null } | undefined;
  const user = data?.user ?? null;
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      return;
    }

    const refresh = async () => {
      try {
        const res = await fetch('/api/auth/refresh', { method: 'POST' });

        if (!res.ok) {
          // Token expired or invalid — redirect to login
          window.location.href = '/login';
        }
      } catch {
        // Network error — silently skip this cycle
      }
    };

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user]);

  return null;
}
