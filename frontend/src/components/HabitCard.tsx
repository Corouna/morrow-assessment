import { Habit } from '../types';

interface HabitCardProps {
  readonly habit: Habit;
  readonly onLogToday: (habitId: number) => void;
  readonly isLogging: boolean;
}

function HabitCard({ habit, onLogToday, isLogging }: HabitCardProps) {
  const logButtonLabel = getLogButtonLabel(habit.loggedToday, isLogging);

  return (
    <div className="habit-card">
      <h2 className="habit-card__name">{habit.name}</h2>
      <p className="habit-card__target">Target: {habit.targetPerWeek}x / week</p>

      <div className="habit-card__stats">
        <div className="habit-card__stat">
          <span className="habit-card__stat-value">{habit.currentStreak}</span>
          <span className="habit-card__stat-label">day streak</span>
        </div>
        <div className="habit-card__stat">
          <span className="habit-card__stat-value">{habit.weeklyCompletionPercent}%</span>
          <span className="habit-card__stat-label">this week</span>
        </div>
      </div>

      <button
        type="button"
        className="habit-card__log-button"
        onClick={() => onLogToday(habit.id)}
        disabled={habit.loggedToday || isLogging}
      >
        {logButtonLabel}
      </button>
    </div>
  );
}

function getLogButtonLabel(loggedToday: boolean, isLogging: boolean): string {
  if (loggedToday) {
    return 'Logged today';
  }
  return isLogging ? 'Logging…' : 'Log today';
}

export default HabitCard;
