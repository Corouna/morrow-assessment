# Habit Tracker

A small habit-tracking feature slice: log daily health habits, see a dashboard
with current streak and weekly completion % per habit, and add new habits.
Built as a take-home technical assessment within a 6-hour timebox.

## What it does

- **Dashboard** — shows every habit with its current streak (consecutive days
  logged) and weekly completion % (days logged in the last 7 / target days
  per week).
- **Log today** — one click marks a habit complete for today. Clicking it
  twice in a day is safe: the second click is a harmless no-op, not a
  duplicate entry.
- **Add a habit** — name + a target of how many days per week you're aiming
  for (1–7).

## Stack

- **Backend**: Node.js, Express, TypeScript, MySQL via `mysql2` (parameterized
  queries only, no string interpolation).
- **Frontend**: React, TypeScript, Vite, plain CSS (no UI framework).

### Why MySQL over MongoDB

The data here is inherently relational and small in shape: two tables, a
foreign key from logs to habits, and — critically — idempotent logging
depends on a **compound uniqueness constraint** across `(user_id, habit_id,
log_date)` that the database enforces atomically. That's a natural fit for a
relational unique index; doing the equivalent in MongoDB (a compound unique
index) works too, but there's no upside to a document model here — there's no
deeply nested or polymorphic data, no schema flexibility being exploited, and
losing FK-enforced referential integrity (e.g. `ON DELETE CASCADE` from
habits to logs) would be a step backward for a dataset this structured. MySQL
was also the stack the assessment specified.

## Running it locally

### Prerequisites

- Node.js 20+
- A MySQL 8 instance. Easiest via Docker:

  ```bash
  docker run -d --name habit-tracker-mysql \
    -e MYSQL_ROOT_PASSWORD=rootpass \
    -e MYSQL_DATABASE=habit_tracker \
    -e MYSQL_USER=habit_app \
    -e MYSQL_PASSWORD=habit_app_pw \
    -p 3306:3306 \
    mysql:8.0
  ```

### Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in your DB credentials
npm run migrate         # creates the habits / habit_logs tables
npm run dev              # http://localhost:4000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL if the backend isn't on :4000
npm run dev              # http://localhost:5173
```

Open `http://localhost:5173`. The backend must allow CORS from the
frontend's origin — set via `CORS_ORIGIN` in the backend's `.env`, defaults
to `http://localhost:5173`.

## Assumptions & shortcuts

- **No auth.** Every request acts as a single hardcoded demo user
  (`DEMO_USER_ID = 1` in `backend/src/config/constants.ts`). This is an
  explicit, documented shortcut for the exercise, not something silently
  skipped — a real version would add real authentication and scope every
  query by the authenticated user instead of a constant.
- **"Target" means days per week.** The brief said "name + target" without
  specifying units; I interpreted it as "how many days per week you're aiming
  to complete this habit," and weekly completion % is `min(100, round(days
  logged in the last 7 / target × 100))`. This gives the target field an
  actual purpose in the weekly % calculation rather than just being a label.
- **Date math is UTC-based**, not the user's local timezone. MySQL `DATE`
  columns are timezone-less, and keeping "today" consistently UTC on both
  sides avoids off-by-one-day bugs from mixing timezones — but it does mean a
  user far from UTC could see their "day" roll over at a non-midnight local
  time. Deliberately not handled given the timebox; a production version
  would derive "today" from the user's own timezone.
- **Streak lookback is capped at 90 days** (`STREAK_LOOKBACK_DAYS` in
  `backend/src/routes/habits.ts`) to keep the per-habit query bounded. A habit
  logged every day for longer than that would show a capped streak.
- **No update/delete/archive for habits.** Out of scope for this slice
  (add + log + view only, per the feature brief).
- **No pagination** on `GET /api/habits` — reasonable at demo scale (a
  handful of habits), would need pagination or virtualization for a user
  with hundreds.
- **No automated test suite.** Given the timebox, every endpoint and
  component was verified live instead: the migration and all three routes
  were run against a real local MySQL container, and the dashboard/log/add
  flows were verified with scripted headless-Chrome (Puppeteer) clicks
  against the actual running app, not just read for plausibility. This is
  the most significant gap for a real production codebase — see below.
- **No request cancellation (AbortController)** on the frontend's fetch
  calls. A component unmounting mid-request is a low-risk edge case here
  and wasn't worth the added complexity in the time available.
- Frontend `src/types/index.ts` is a **hand-kept mirror** of the backend's
  response shape — there's no shared package between the two projects in
  this exercise, so they can drift if not updated together.
- `npm audit` flags a moderate advisory in `esbuild` (via Vite's dev server
  only — it doesn't affect the production build). Fixing it requires a
  breaking upgrade to Vite 6+/8, which wasn't worth the risk this late in
  the timebox; noted here rather than silently left unmentioned.

## What would change for production

- Real authentication (sessions or JWT) with per-user data scoping, replacing
  `DEMO_USER_ID`.
- An automated test suite: unit tests for the streak/weekly-% math (pure
  functions in `backend/src/utils/date.ts`, easy to test in isolation),
  integration tests for the routes against a test database, and component
  tests for the frontend.
- A real migration tool (e.g. `db-migrate`, Prisma Migrate) with versioned,
  reversible migrations, replacing the current "create tables if they don't
  exist" script.
- A shared types package between frontend and backend instead of a hand-kept
  mirror.
- Timezone-aware date handling driven by the user's actual timezone.
- Structured logging (e.g. `pino`) and error tracking (e.g. Sentry) wired
  into the centralized error handler, instead of `console.error`.
- Rate limiting, `helmet`, and request size limits on the Express app.
- Habit update/delete/archive endpoints, and pagination on the habit list.
- A CI pipeline running typecheck, lint, and tests on every push.
- Upgrading off the flagged `esbuild`/Vite dev-dependency advisory.

## AI tool usage

**Part 1 (this app)** was built with **Claude Code** (Anthropic), working
from a detailed step-by-step brief: one step per commit, each scoped to a
single concern (schema, one endpoint, one component, etc.). For every step,
Claude Code ran real, live verification rather than just producing code that
looked plausible — e.g. running the schema migration against an actual local
MySQL 8 container (via Docker), curling each endpoint with both valid and
invalid input, deliberately killing the database mid-request to confirm the
error handler behaved correctly, and driving the running frontend with
scripted headless-Chrome (Puppeteer) clicks to confirm the dashboard,
log-today, and add-habit interactions actually work end-to-end, not just that
they compile. Those verification steps and their results are recorded in
each commit message. No AI-generated code in this repository was corrected
or overridden during the build.

**Part 2 (`part2-code-review.md`)** was written with **Claude** via the
claude.ai web interface (not Claude Code): the provided code sample was
pasted in, and the resulting review was used as generated, with no edits to
the findings, prioritization, or wording.

Both are disclosed here plainly, rather than glossed over, so this can be
verified against the commit history and discussed candidly in the follow-up
session.
