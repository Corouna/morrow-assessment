import { Habit } from '../types';

interface HabitCardProps {
  habit: Habit;
}

function HabitCard({ habit }: HabitCardProps) {
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

      {habit.loggedToday && <p className="habit-card__logged-today">Logged today</p>}
    </div>
  );
}

export default HabitCard;
