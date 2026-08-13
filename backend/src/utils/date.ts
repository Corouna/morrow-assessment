// All date math here is UTC-based (Date#toISOString / #getDate/#setDate on
// a Date constructed from "now" run in the process's local time, but we only
// ever read back the UTC calendar date). MySQL DATE columns are timezone-less,
// so keeping the app's notion of "today" consistent and UTC-based avoids
// off-by-one-day bugs from mixing timezones between app and DB. A production
// version would derive "today" from the user's own timezone instead.

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getTodayDateString(): string {
  return toDateString(new Date());
}

// logDates does not need to be sorted; a Set lookup is used either way.
export function calculateStreak(logDates: string[]): number {
  const dateSet = new Set(logDates);
  const today = getTodayDateString();

  const cursor = new Date();
  if (!dateSet.has(today)) {
    // Today hasn't been logged yet, but the day isn't over — don't treat
    // that as a broken streak. Start counting from yesterday instead.
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (dateSet.has(toDateString(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function calculateWeeklyCompletionPercent(logDates: string[], targetPerWeek: number): number {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // today + 6 previous days = a 7-day window

  const windowStart = toDateString(sevenDaysAgo);
  const countInWindow = logDates.filter((date) => date >= windowStart).length;

  const percent = (countInWindow / targetPerWeek) * 100;
  return Math.min(100, Math.round(percent));
}
