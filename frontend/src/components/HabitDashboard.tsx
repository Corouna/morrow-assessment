import { useEffect, useState } from 'react';
import { getHabits, logHabitToday } from '../api/client';
import { Habit } from '../types';
import AddHabitForm from './AddHabitForm';
import HabitCard from './HabitCard';

function HabitDashboard() {
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

  if (loading) {
    return <p className="status-message">Loading habits…</p>;
  }

  if (error) {
    return <p className="status-message status-message--error">Couldn't load habits: {error}</p>;
  }

  return (
    <div>
      {logError && <p className="status-message status-message--error">{logError}</p>}

      {habits.length === 0 ? (
        <p className="status-message">No habits yet. Add one below to get started.</p>
      ) : (
        <div className="habit-grid">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onLogToday={handleLogToday}
              isLogging={loggingHabitId === habit.id}
            />
          ))}
        </div>
      )}

      <AddHabitForm onCreated={refetchHabits} />
    </div>
  );
}

export default HabitDashboard;
