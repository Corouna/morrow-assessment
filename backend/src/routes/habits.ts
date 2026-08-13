import { NextFunction, Request, Response, Router } from 'express';
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

export default router;
