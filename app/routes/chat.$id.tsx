import { Request, Response } from 'express';
import { default as IndexRoute } from './_index';
import { createApiHandler } from '~/utils/api-utils.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';
import { json } from '@remix-run/node';

export const loader = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
  const id = request.params.id;
  return json({ id });
});

export default IndexRoute;
