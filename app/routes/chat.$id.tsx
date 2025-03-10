import { Request, Response } from 'express';
import { default as IndexRoute } from './_index';
import { createApiHandler } from '~/utils/api-utils.server';
import type { ExpressAppContext } from '~/utils/express-context-adapter.server';

export const loader = createApiHandler(async (context: ExpressAppContext, request: Request, response: Response) => {
  const id = request.params.id;
  response.status(200).json({ id });
  return response;
});

export default IndexRoute;
