// Mirrors backend/src/types/index.ts's HabitResponse shape. There's no shared
// package between the two projects in this exercise (see README "What would
// change for production"), so this is kept in sync by hand.
export interface Habit {
  id: number;
  name: string;
  targetPerWeek: number;
  currentStreak: number;
  weeklyCompletionPercent: number;
  loggedToday: boolean;
}

export interface CreateHabitInput {
  name: string;
  targetPerWeek: number;
}

export interface LogHabitResult {
  habitId: number;
  logDate: string;
}
