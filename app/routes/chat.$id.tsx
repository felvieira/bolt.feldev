import { Request, Response } from 'express';
import { default as IndexRoute } from './_index';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

export const loader = async (args: { context: ExpressAppContext, request: Request }) => {
  const { json } = await import('@remix-run/node');
  const { createApiHandler } = await import('~/utils/api-utils.server');
  
  const handler = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
    const id = request.params.id;
    return json({ id });
  });

  return handler(args.context, args.request, args.context.res);
};

export default IndexRoute;
