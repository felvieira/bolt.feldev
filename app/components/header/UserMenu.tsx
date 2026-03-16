import { useState, useRef, useEffect } from 'react';
import { Form, Link, useRouteLoaderData } from '@remix-run/react';
import type { AuthUser } from '~/lib/auth.server';

export function UserMenu() {
  const data = useRouteLoaderData('root') as { user: AuthUser | null } | undefined;
  const user = data?.user ?? null;
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!user) {
    return (
      <Link
        to="/login"
        className="ml-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-white hover:brightness-110 transition-all"
      >
        Login
      </Link>
    );
  }

  const initial = (user.displayName || user.email).charAt(0).toUpperCase();

  return (
    <div className="relative ml-2" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-bolt-elements-background-depth-3 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-sm font-medium">
          {initial}
        </div>
        <span className="text-sm text-bolt-elements-textPrimary hidden sm:inline">{user.displayName || user.email}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-lg z-50">
          <div className="px-4 py-3 border-b border-bolt-elements-borderColor">
            <p className="text-sm font-medium text-bolt-elements-textPrimary">{user.displayName}</p>
            <p className="text-xs text-bolt-elements-textSecondary truncate">{user.email}</p>
          </div>
          <div className="p-1">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="block w-full text-left px-3 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 rounded-md transition-colors"
            >
              Profile
            </Link>
            <Form method="post" action="/logout">
              <button
                type="submit"
                className="w-full text-left px-3 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 rounded-md transition-colors"
              >
                Logout
              </button>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}
