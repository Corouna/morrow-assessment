import { CreateHabitInput, Habit, LogHabitResult } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

interface ApiErrorBody {
  error?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const body: ApiErrorBody = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getHabits(): Promise<Habit[]> {
  return request<Habit[]>('/habits');
}

export function createHabit(input: CreateHabitInput): Promise<Habit> {
  return request<Habit>('/habits', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function logHabitToday(habitId: number): Promise<LogHabitResult> {
  return request<LogHabitResult>(`/habits/${habitId}/log`, {
    method: 'POST',
  });
}
