import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import pool from './db/pool';
import habitsRouter from './routes/habits';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';

const app: Express = express();

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.use('/api/habits', habitsRouter);

// Confirms both the server and the DB pool are wired up correctly.
app.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

// Must be registered last: Express only routes to error middleware (4 args)
// once a handler upstream calls next(err) instead of next().
app.use(errorHandler);

export default app;
