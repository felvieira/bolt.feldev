// app/root.tsx
import { useStore } from '@nanostores/react';
import { json, redirect, type LoaderFunction, type LinksFunction } from '@remix-run/node';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?inline';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';

// Importar estilos como inline para evitar problemas de loader
import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?inline';
import globalStyles from './styles/index.scss?inline';
import xtermStyles from '@xterm/xterm/css/xterm.css?inline';

// Importar UnoCSS diretamente do plugin
import 'uno.css';

import { requireAuth } from '~/utils/auth.server';
import { logStore } from './lib/stores/logs';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

// Works with both Express and Remix loaders
export const loader: LoaderFunction = async ({ request, context }) => {
  // Handle both Express Request objects and Remix Request objects
  const url = request instanceof Request 
    ? request.url 
    : `http://${request.headers.host || 'localhost'}${request.url}`;
  
  const pathname = new URL(url).pathname;

  // Skip auth check for login page
  if (pathname === '/login') {
    return json({});
  }

  // Check auth for all other routes
  try {
    await requireAuth(request, context);
    return json({});
  } catch (error) {
    if (error instanceof Response && error.status === 302) {
      throw error; // Rethrow redirects
    }
    
    console.error("Auth error:", error);
    // For the login page, just return an empty object instead of showing an error
    if (pathname === '/login') {
      return json({});
    }
    
    throw redirect('/login');
  }
};

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    {/* Incluir estilos inline para garantir carregamento mesmo sem loaders configurados */}
    <style dangerouslySetInnerHTML={{ __html: tailwindReset }} />
    <style dangerouslySetInnerHTML={{ __html: reactToastifyStyles }} />
    <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
    <style dangerouslySetInnerHTML={{ __html: xtermStyles }} />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      {children}
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

export default function App() {
  const theme = useStore(themeStore);

  useEffect(() => {
    logStore.logSystem('Application initialized', {
      theme,
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'server',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
