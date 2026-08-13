import { FormEvent, useState } from 'react';
import { createHabit } from '../api/client';

interface AddHabitFormProps {
  readonly onCreated: () => Promise<void>;
}

const MIN_TARGET = 1;
const MAX_TARGET = 7;

function AddHabitForm({ onCreated }: AddHabitFormProps) {
  const [name, setName] = useState('');
  const [targetPerWeek, setTargetPerWeek] = useState(String(MAX_TARGET));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmedName = name.trim();
    const parsedTarget = Number(targetPerWeek);

    if (trimmedName.length === 0) {
      setError('Habit name is required.');
      return;
    }
    if (!Number.isInteger(parsedTarget) || parsedTarget < MIN_TARGET || parsedTarget > MAX_TARGET) {
      setError(`Target must be a whole number between ${MIN_TARGET} and ${MAX_TARGET}.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createHabit({ name: trimmedName, targetPerWeek: parsedTarget });
      setName('');
      setTargetPerWeek(String(MAX_TARGET));
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create habit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="add-habit-form" onSubmit={handleSubmit}>
      <h2 className="add-habit-form__heading">Add a habit</h2>

      <label className="add-habit-form__field">
        Name
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          disabled={submitting}
        />
      </label>

      <label className="add-habit-form__field">
        Target (days / week)
        <input
          type="number"
          min={MIN_TARGET}
          max={MAX_TARGET}
          value={targetPerWeek}
          onChange={(event) => setTargetPerWeek(event.target.value)}
          disabled={submitting}
        />
      </label>

      {error && <p className="status-message status-message--error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add habit'}
      </button>
    </form>
  );
}

export default AddHabitForm;
