import { useEffect, useState } from 'react';
import { getHabits, logHabitToday } from '../api/client';
import { Habit } from '../types';

interface UseHabitsResult {
  habits: Habit[];
  loading: boolean;
  error: string | null;
  loggingHabitId: number | null;
  logError: string | null;
  handleLogToday: (habitId: number) => Promise<void>;
  refetchHabits: () => Promise<void>;
}

// Extracted from what used to be HabitDashboard so the form and the list can
// live in different parts of the layout (sidebar vs. main) while sharing one
// source of truth for habit state.
export function useHabits(): UseHabitsResult {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingHabitId, setLoggingHabitId] = useState<number | null>(null);
  const [logError, setLogError] = useState<string | null>(null);

  // Empty deps: this only needs to run once, on mount. `cancelled` guards
  // against setting state after the component has unmounted if the request
  // is still in flight.
  useEffect(() => {
    let cancelled = false;

    async function loadHabits() {
      setLoading(true);
      setError(null);
      try {
        const data = await getHabits();
        if (!cancelled) {
          setHabits(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load habits');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadHabits();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refetchHabits(): Promise<void> {
    const refreshed = await getHabits();
    setHabits(refreshed);
  }

  async function handleLogToday(habitId: number): Promise<void> {
    const previousHabits = habits;
    setLogError(null);
    setLoggingHabitId(habitId);

    // Optimistic update so the button reflects the click immediately. The
    // authoritative streak/weekly % come from the refetch below rather than
    // being recomputed here, so this stays in sync with the backend's math.
    setHabits((current) =>
      current.map((habit) => (habit.id === habitId ? { ...habit, loggedToday: true } : habit))
    );

    try {
      await logHabitToday(habitId);
      await refetchHabits();
    } catch (err) {
      setHabits(previousHabits);
      setLogError(err instanceof Error ? err.message : 'Failed to log habit. Please try again.');
    } finally {
      setLoggingHabitId(null);
    }
  }

  return { habits, loading, error, loggingHabitId, logError, handleLogToday, refetchHabits };
}
