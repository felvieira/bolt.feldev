import express from 'express';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';
import BackgroundRays from '~/components/ui/BackgroundRays';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

// Use type em vez de importação direta
type Request = express.Request;
type Response = express.Response;

// Metadata function can remain the same as it's used by the client-side Remix
export const meta = () => {
  return [{ title: 'Bolt' }, { name: 'description', content: 'Talk with Bolt, an AI assistant from StackBlitz' }];
};

// Convert loader to Express-compatible handler
export const loader = async (args: { context: ExpressAppContext, request: Request }) => {
  const { json } = await import('@remix-run/node');
  const { createApiHandler } = await import('~/utils/api-utils.server');
  
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    return json({});
  });

  return handler(args.context, args.request, args.context.res);
};

export default function Index() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <BackgroundRays />
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
