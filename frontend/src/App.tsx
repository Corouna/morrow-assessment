import AddHabitForm from './components/AddHabitForm';
import HabitList from './components/HabitList';
import { useHabits } from './hooks/useHabits';

function App() {
  const { habits, loading, error, loggingHabitId, logError, handleLogToday, refetchHabits } = useHabits();

  return (
    <div className="app">
      <header className="app-header">
        <h1>Habit Tracker</h1>
      </header>

      <div className="app-layout">
        <aside className="app-sidebar">
          <AddHabitForm onCreated={refetchHabits} />
        </aside>

        <main className="app-main">
          <HabitList
            habits={habits}
            loading={loading}
            error={error}
            logError={logError}
            loggingHabitId={loggingHabitId}
            onLogToday={handleLogToday}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
