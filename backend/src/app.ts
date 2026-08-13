import express, { Express, NextFunction, Request, Response } from 'express';
import pool from './db/pool';

const app: Express = express();

app.use(express.json());

// Confirms both the server and the DB pool are wired up correctly.
// No error middleware yet (added in a later step), so a DB failure here
// still surfaces via Express's default handler for now.
app.get('/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
});

export default app;
