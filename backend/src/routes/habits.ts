import { NextFunction, Request, Response, Router } from 'express';
import { ResultSetHeader } from 'mysql2';
import pool from '../db/pool';
import { DEMO_USER_ID } from '../config/constants';
import { HabitRow, HabitResponse, LogDateRow } from '../types';
import { calculateStreak, calculateWeeklyCompletionPercent, getTodayDateString, toDateString } from '../utils/date';

const router = Router();

// How far back to look when computing a streak. A habit logged every single
// day for longer than this would show a capped streak — an acceptable
// tradeoff for keeping the per-habit query bounded.
const STREAK_LOOKBACK_DAYS = 90;

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [habits] = await pool.query<HabitRow[]>(
      'SELECT id, user_id, name, target_per_week, created_at FROM habits WHERE user_id = ? ORDER BY created_at ASC',
      [DEMO_USER_ID]
    );

    const lookbackStart = new Date();
    lookbackStart.setDate(lookbackStart.getDate() - STREAK_LOOKBACK_DAYS);
    const lookbackStartDate = toDateString(lookbackStart);

    const habitsWithStats: HabitResponse[] = await Promise.all(
      habits.map(async (habit): Promise<HabitResponse> => {
        const [logs] = await pool.query<LogDateRow[]>(
          `SELECT log_date FROM habit_logs
           WHERE user_id = ? AND habit_id = ? AND log_date >= ?
           ORDER BY log_date DESC`,
          [DEMO_USER_ID, habit.id, lookbackStartDate]
        );
        const logDates = logs.map((log) => log.log_date);

        return {
          id: habit.id,
          name: habit.name,
          targetPerWeek: habit.target_per_week,
          currentStreak: calculateStreak(logDates),
          weeklyCompletionPercent: calculateWeeklyCompletionPercent(logDates, habit.target_per_week),
          loggedToday: logDates.includes(getTodayDateString()),
        };
      })
    );

    res.json(habitsWithStats);
  } catch (err) {
    next(err);
  }
});

type ParsedHabitInput = { valid: true; name: string; targetPerWeek: number } | { valid: false; error: string };

function parseNewHabitInput(name: unknown, targetPerWeek: unknown): ParsedHabitInput {
  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 100) {
    return { valid: false, error: 'name is required and must be 1-100 characters' };
  }
  if (
    typeof targetPerWeek !== 'number' ||
    !Number.isInteger(targetPerWeek) ||
    targetPerWeek < 1 ||
    targetPerWeek > 7
  ) {
    return { valid: false, error: 'targetPerWeek is required and must be an integer between 1 and 7' };
  }
  return { valid: true, name: name.trim(), targetPerWeek };
}

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, targetPerWeek } = req.body as { name?: unknown; targetPerWeek?: unknown };

    const parsed = parseNewHabitInput(name, targetPerWeek);
    if (!parsed.valid) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO habits (user_id, name, target_per_week) VALUES (?, ?, ?)',
      [DEMO_USER_ID, parsed.name, parsed.targetPerWeek]
    );

    const newHabit: HabitResponse = {
      id: result.insertId,
      name: parsed.name,
      targetPerWeek: parsed.targetPerWeek,
      currentStreak: 0,
      weeklyCompletionPercent: 0,
      loggedToday: false,
    };
    res.status(201).json(newHabit);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const habitId = Number(req.params.id);
    if (!Number.isInteger(habitId) || habitId <= 0) {
      res.status(400).json({ error: 'Invalid habit id' });
      return;
    }

    const [habitRows] = await pool.query<HabitRow[]>('SELECT id FROM habits WHERE id = ? AND user_id = ?', [
      habitId,
      DEMO_USER_ID,
    ]);
    if (habitRows.length === 0) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }

    const today = getTodayDateString();

    // Idempotent by construction: the UNIQUE KEY on (user_id, habit_id,
    // log_date) makes a same-day repeat a no-op update rather than a new
    // row. This avoids a racy "check if logged, then insert" — two
    // concurrent requests can't both pass a check and both insert, because
    // there's no check to race against.
    await pool.query(
      `INSERT INTO habit_logs (user_id, habit_id, log_date)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE log_date = log_date`,
      [DEMO_USER_ID, habitId, today]
    );

    res.status(200).json({ habitId, logDate: today });
  } catch (err) {
    next(err);
  }
});

export default router;
