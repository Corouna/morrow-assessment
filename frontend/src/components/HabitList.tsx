import { Habit } from '../types';
import HabitCard from './HabitCard';

interface HabitListProps {
  readonly habits: Habit[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly logError: string | null;
  readonly loggingHabitId: number | null;
  readonly onLogToday: (habitId: number) => void;
}

function HabitList({ habits, loading, error, logError, loggingHabitId, onLogToday }: HabitListProps) {
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
        <p className="status-message">No habits yet. Add one from the sidebar to get started.</p>
      ) : (
        <div className="habit-grid">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onLogToday={onLogToday}
              isLogging={loggingHabitId === habit.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default HabitList;
