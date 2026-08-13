import { useEffect, useState } from 'react';
import { getHabits } from '../api/client';
import { Habit } from '../types';
import HabitCard from './HabitCard';

function HabitDashboard() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return <p className="status-message">Loading habits…</p>;
  }

  if (error) {
    return <p className="status-message status-message--error">Couldn't load habits: {error}</p>;
  }

  if (habits.length === 0) {
    return <p className="status-message">No habits yet. Add one below to get started.</p>;
  }

  return (
    <div className="habit-grid">
      {habits.map((habit) => (
        <HabitCard key={habit.id} habit={habit} />
      ))}
    </div>
  );
}

export default HabitDashboard;
