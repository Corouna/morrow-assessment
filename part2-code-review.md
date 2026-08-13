# Code Review: Habit Dashboard API + Frontend

Reviewed as a colleague's PR. Issues below are grouped by severity, each with why it matters and a suggested fix.

---

## Critical — must fix before merge

### 1. SQL injection in every query (`server.ts`)
```ts
`SELECT * FROM habits WHERE user_id = ${userId}`
`INSERT INTO habit_logs (...) VALUES (${userId}, ${habitId}, '${value}', CURDATE())`
```
`userId`, `habitId`, and `value` are interpolated directly into SQL strings from user input. Any of them can inject arbitrary SQL — this is a full database compromise waiting to happen, not a theoretical risk.

**Fix:** use parameterized queries everywhere.
```ts
const [habits] = await db.query("SELECT * FROM habits WHERE user_id = ?", [userId]);
```

### 2. Hardcoded production DB credentials in source
```ts
host: "prod-db.internal", user: "root", password: "Passw0rd123!",
```
Root credentials to a production database, committed to source control. Anyone with repo access (or a leaked commit history) has full DB access. The app also shouldn't connect as `root` at all — least privilege applies to service accounts too.

**Fix:** load from environment variables / a secrets manager, and use a scoped DB user with only the permissions this service needs.

### 3. No authentication or authorization (IDOR)
`userId` is taken from `req.query`/`req.body` with no session/token check that the caller actually *is* that user. Anyone can read or write any other user's habit data just by changing the ID in the request.

**Fix:** require an authenticated session/JWT, and derive `userId` from the verified token — never trust a client-supplied ID for whose data to return.

### 4. Dashboard always returns an empty array
```ts
habits.forEach(async (habit) => { ... result.push(...) });
res.json(result);
```
`forEach` doesn't wait for async callbacks. `res.json(result)` fires before any inner query resolves, so `result` is always `[]`. The core endpoint is silently broken.

**Fix:** use `Promise.all` with `map` instead:
```ts
const result = await Promise.all(habits.map(async (habit) => {
  const [logs] = await db.query(
    "SELECT * FROM habit_logs WHERE habit_id = ? AND log_date > DATE_SUB(NOW(), INTERVAL 7 DAY)",
    [habit.id]
  );
  return { ...habit, logs };
}));
res.json(result);
```

### 5. Frontend fetch loop with no dependency array
```ts
useEffect(() => {
  fetch(`/api/dashboard?userId=${userId}`)...
}); // no dependency array
```
With no dependency array, this effect re-runs on every render. Since it triggers a state update (`setHabits`), which causes a re-render, which re-runs the effect — this refetches on a tight loop, hammering the API continuously.

**Fix:** add `[userId]` as the dependency array so it only runs on mount / when `userId` changes.

### 6. Stack traces returned to the client
```ts
res.status(500).json({ error: err.stack });
```
Leaking stack traces exposes internal file paths, library versions, and implementation details to any client — a real information-disclosure risk.

**Fix:** log the full error server-side, return a generic message to the client (`{ error: "Internal server error" }`), with request-correlated logging for debugging.

---

## High priority

### 7. Race condition on duplicate log check
The "already logged today" check is a `SELECT` followed by a separate `INSERT` — not atomic. Two concurrent requests can both pass the `SELECT` before either `INSERT` completes, creating duplicate logs for the same day.

**Fix:** add a unique constraint on `(user_id, habit_id, log_date)` at the DB level and use `INSERT ... ON DUPLICATE KEY UPDATE` (or catch the constraint violation), rather than relying on an application-level check-then-act.

### 8. No error handling around async route handlers
None of the `await` calls are wrapped in try/catch, and Express 4 doesn't automatically catch rejected promises thrown in async handlers — the global error middleware at the bottom won't catch these; they'll surface as unhandled promise rejections instead, which can crash the process.

**Fix:** wrap handlers in a try/catch that calls `next(err)`, or use a small async-handler wrapper utility.

### 9. `INSERT` not awaited — client is told "success" before the write is confirmed
```ts
db.query(
  `INSERT INTO habit_logs (...) VALUES (...)`
);
res.json({ success: true });
```
The insert call isn't `await`ed, so `res.json({ success: true })` fires without knowing whether the write actually completed — or even started. If it fails (a dropped connection, a constraint violation, anything), the client is still told it succeeded, and the rejected promise becomes an unhandled rejection nobody sees. This is distinct from #8: even wrapping the handler in try/catch wouldn't catch this, because nothing is awaiting the call for the catch to intercept.

**Fix:** `await` the insert before responding, inside the same try/catch as the rest of the handler:
```ts
await db.query(
  "INSERT INTO habit_logs (user_id, habit_id, value, log_date) VALUES (?, ?, ?, CURDATE())",
  [userId, habitId, value]
);
res.json({ success: true });
```

### 10. User email logged to console
```ts
console.log(`User ${email} logged habit ${habitId}: ${value}`);
```
Logging PII (email) to stdout is a privacy/compliance concern (GDPR/PDPA-style data minimization) and `email` isn't even validated against the authenticated user — it's taken as-is from the request body.

**Fix:** don't log PII directly; log a user ID or hashed identifier if traceability is needed, and remove `email` from the payload entirely once real auth is in place.

### 11. Direct state mutation in `logHabit`
```ts
const updated = habits;
updated.find((h) => h.id === habitId)!.logs.push({ ... });
setHabits(updated);
```
This mutates the existing array/objects in place rather than creating new references. React's change detection and any memoization downstream rely on referential equality — mutating in place is a common source of subtle, hard-to-reproduce UI bugs.

**Fix:** build a new array/object immutably:
```ts
setHabits(habits.map((h) =>
  h.id === habitId ? { ...h, logs: [...h.logs, { value: "done", log_date: new Date().toISOString() }] } : h
));
```

---

## Medium priority

### 12. Filtered list goes stale
```ts
useEffect(() => { setFiltered(habits.filter(...)); }, [search]);
```
This only re-filters when `search` changes, not when `habits` updates — so logging a habit won't be reflected in the filtered view until the user types in the search box again.

**Fix:** include `habits` in the dependency array, or better, derive `filtered` directly during render instead of storing it as separate state (`useMemo` if the filter is expensive enough to warrant memoizing).

### 13. Unsafe non-null assertion
```ts
updated.find((h) => h.id === habitId)!
```
If the habit isn't found (stale state, race with a delete elsewhere), this throws at runtime instead of failing gracefully.

**Fix:** check for `undefined` explicitly and handle the not-found case.

### 14. No handling of the POST response
The `logHabit` fetch call has no `.then`/`.catch` — the UI updates optimistically regardless of whether the request succeeds, and the `{ success: false, reason: "already logged today" }` response from the backend is silently discarded.

**Fix:** handle the response, and roll back the optimistic update (or show an error) if the request fails or returns `success: false`.

### 15. No error handling or loading state on the initial dashboard fetch
```ts
useEffect(() => {
  fetch(`/api/dashboard?userId=${userId}`)
    .then((res) => res.json())
    .then((data) => setHabits(data));
});
```
There's no `.catch()` here, and no loading state. If the request fails — network error, non-2xx response, malformed JSON — the rejection is unhandled and `habits` just stays `[]` forever, indistinguishable from "this user has no habits yet." The user has no signal that anything went wrong.

**Fix:** add a `.catch()` (or wrap in try/catch with `async`/`await`) that sets an error state the component can render, and a loading flag shown until the first fetch resolves either way.

### 16. Fragile date comparison
```ts
habit.logs.some((log) => log.log_date.startsWith(day))
```
This assumes `log_date` is always an ISO string starting with `YYYY-MM-DD`. Depending on how `mysql2` returns `DATE` columns (often as a JS `Date` object, not a string), this could throw or silently never match.

**Fix:** parse both sides as dates and compare using a date library or normalized `YYYY-MM-DD` extraction on the backend before sending to the client, so the frontend always receives a consistent format.

---

## Low priority / polish

- **`key={index}`** in the habit list — use `habit.id` instead. Index keys break React's reconciliation when the list is filtered/reordered.
- **`any` used throughout the backend** (`[habits]: any`, `[logs]: any`, `[existing]: any`) — defeats the purpose of TypeScript. Type the query results properly.
- **Case-sensitive search** — `.includes(search)` won't match "Sleep" against a search of "sleep"; lowercase both sides before comparing.

---

## Summary

The most urgent fixes are the SQL injection, hardcoded credentials, and missing auth — any one of these is a genuine security incident waiting to happen in production. The `forEach`/async bug and the missing `useEffect` dependency array are also critical in a different way: they mean the feature doesn't actually work correctly even in the happy path, independent of security. I'd block this PR on items 1–6 before anything else; 7–11 should be fixed in the same PR or an immediate fast-follow; 12–16 are worth raising but wouldn't block a merge on their own.
