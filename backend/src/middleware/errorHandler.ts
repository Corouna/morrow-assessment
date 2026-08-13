import { NextFunction, Request, Response } from 'express';

// Express only treats a middleware as an error handler if it declares all
// four params, even though `next` is unused — this is the end of the chain.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
