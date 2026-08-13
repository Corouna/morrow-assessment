import { NextFunction, Request, Response } from 'express';

// express.json() (via body-parser) throws these two exact shapes for a bad
// request body — verified against the real error objects it produces for a
// malformed-JSON body and an oversized body. Both are client mistakes, not
// server failures, so they get their own status code instead of falling
// through to the generic 500 below.
const BODY_PARSER_ERROR_MESSAGES: Record<string, string> = {
  'entity.parse.failed': 'Invalid JSON in request body',
  'entity.too.large': 'Request body too large',
};

function getBodyParserError(err: unknown): { statusCode: number; message: string } | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const { type, statusCode } = err as { type?: unknown; statusCode?: unknown };
  if (typeof type !== 'string' || typeof statusCode !== 'number') return undefined;
  const message = BODY_PARSER_ERROR_MESSAGES[type];
  return message === undefined ? undefined : { statusCode, message };
}

// Express only treats a middleware as an error handler if it declares all
// four params, even though `next` is unused — this is the end of the chain.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const bodyParserError = getBodyParserError(err);
  if (bodyParserError !== undefined) {
    res.status(bodyParserError.statusCode).json({ error: bodyParserError.message });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
