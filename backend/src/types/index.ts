import { RowDataPacket } from 'mysql2';

export interface HabitRow extends RowDataPacket {
  id: number;
  user_id: number;
  name: string;
  target_per_week: number;
  created_at: string;
}

export interface LogDateRow extends RowDataPacket {
  log_date: string;
}

// Shape sent to the frontend: camelCase, and only the fields the UI needs
// (no user_id — there's only ever one demo user, see config/constants.ts).
export interface HabitResponse {
  id: number;
  name: string;
  targetPerWeek: number;
  currentStreak: number;
  weeklyCompletionPercent: number;
  loggedToday: boolean;
}
