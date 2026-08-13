# Habit Tracker

A small habit-tracking feature slice: log daily health habits, see a dashboard with current streak and weekly completion % per habit, and add new habits. Built as a take-home technical assessment within a 6-hour timebox.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
  - [Environment Variables](#environment-variables)
- [Scope and Non-Goals](#scope-and-non-goals)
  - [What This System Does Not Solve](#what-this-system-does-not-solve)
  - [Bounding Assumptions](#bounding-assumptions)
- [API Reference](#api-reference)
- [Architecture](#architecture)
  - [Directory Structure](#directory-structure)
  - [Tech Stack](#tech-stack)
  - [Request Flow](#request-flow)
- [Business Rules](#business-rules)
  - [Unique Habit Names](#unique-habit-names)
  - [Idempotent Logging: Why It's Actually Safe](#idempotent-logging-why-its-actually-safe)
- [Consistency & Failure Semantics](#consistency--failure-semantics)
- [Assumptions and Tradeoffs](#assumptions-and-tradeoffs)
- [What Would Change for Production](#what-would-change-for-production)
- [Verification Approach](#verification-approach)
- [AI Tool Usage](#ai-tool-usage)

---

## Overview

- **Dashboard** — shows every habit with its current streak (consecutive days logged) and weekly completion % (days logged in the last 7 / target days per week).
- **Log today** — one click marks a habit complete for today. Clicking it twice in a day is safe: the second click is a harmless no-op, not a duplicate entry.
- **Add a habit** — name + a target of how many days per week you're aiming for (1–7).

This is a small, deliberately un-layered feature slice, not a platform. Three endpoints, three components, no service/repository abstraction — see [Architecture](#architecture) for why that's the right call at this size, not an oversight.

---

## Getting Started

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

Open `http://localhost:5173`. The backend must allow CORS from the frontend's origin — set via `CORS_ORIGIN` in the backend's `.env`, defaults to `http://localhost:5173`.

### Environment Variables

**Backend** (`backend/.env`, see `backend/.env.example`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP server port |
| `CORS_ORIGIN` | `http://localhost:5173` | Origin allowed to call the API |
| `DB_HOST` | — (required) | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | — (required) | MySQL user |
| `DB_PASSWORD` | — (required) | MySQL password |
| `DB_NAME` | — (required) | MySQL database name |

Missing required variables fail loudly at startup (`config/env.ts` throws before the server binds a port), rather than connecting with `undefined` and failing confusingly on the first query.

**Frontend** (`frontend/.env`, see `frontend/.env.example`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:4000/api` | Base URL the API client calls |

---

## Scope and Non-Goals

This slice solves one problem: **let a user log daily habits and see their streak and weekly progress.** Everything built here serves that goal directly.

The following are explicitly out of scope — not oversights, but decisions made to respect the 6-hour timebox and documented rather than silently skipped.

### What This System Does Not Solve

**Authentication and user identity**
Every request acts as a single hardcoded demo user (`DEMO_USER_ID = 1` in `backend/src/config/constants.ts`). There is no login, no session, no token. In production, `userId` would be extracted from a verified session/JWT and every query scoped to it — the interesting problem for this exercise was the feature slice itself, not auth.

**Editing or removing habits**
There is no update, delete, or archive endpoint. The brief scoped this slice to add + log + view; editing a habit's name or target, or retiring one, is a straightforward but separate feature that wasn't built.

**Multi-user concurrency beyond the logging path**
The only concurrency guarantee this system makes is about duplicate logs (see [Idempotent Logging](#idempotent-logging-why-its-actually-safe)). There's no locking, queuing, or rate limiting elsewhere — with a single hardcoded demo user, there's no real multi-tenant contention to defend against yet.

**Timezone-aware "today"**
"Today" is computed in UTC on both the server and the date-math helpers, not the requesting user's local timezone. A user far from UTC could see their day roll over at a non-midnight local time. Documented and deliberately not handled — see [Bounding Assumptions](#bounding-assumptions).

**An automated test suite**
No unit, integration, or component tests exist. Given the timebox, verification was done live against a running stack instead — see [Verification Approach](#verification-approach). This is the single biggest gap between this slice and something production-ready.

**A shared frontend/backend types package**
`frontend/src/types/index.ts` is a hand-kept mirror of `backend/src/types/index.ts`'s `HabitResponse` shape. They can drift if one is changed without the other. A monorepo with a shared `types` package is the production fix; not worth the setup cost for two files in a 6-hour slice.

---

### Bounding Assumptions

These define the operating envelope of the system as built. They're true here and would need revisiting in a production context.

| Assumption | Implication |
|---|---|
| Single hardcoded demo user | No per-request auth check needed; every query filters by a constant instead of a verified identity. |
| "Target" means days per week | The brief said "name + target" without specifying units. Interpreted as a weekly frequency goal, which gives `weeklyCompletionPercent` an actual denominator to work with. |
| "Today" is UTC | Keeps app-side date math and MySQL's timezone-less `DATE` columns consistent with each other, at the cost of not matching every user's local midnight. |
| Streak lookback capped at 90 days | Keeps the per-habit log query bounded. A habit logged every day for longer than that shows a capped streak. |
| No pagination on `GET /api/habits` | Fine at demo scale (a handful of habits); would need pagination or virtualization for hundreds of habits. |
| No request cancellation (`AbortController`) on the frontend | A component unmounting mid-fetch is a low-risk edge case here; not worth the added complexity in the time available. |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/habits` | List habits for the demo user, each with `currentStreak`, `weeklyCompletionPercent`, and `loggedToday` |
| POST | `/api/habits` | Create a habit (`{ name, targetPerWeek }`) |
| POST | `/api/habits/:id/log` | Log today's completion for a habit — idempotent, safe to call more than once per day |
| GET | `/health` | Liveness check; round-trips a query through the DB pool |

### Example Flow

```bash
# 1. Create a habit
curl -X POST http://localhost:4000/api/habits \
  -H "Content-Type: application/json" \
  -d '{"name": "Exercise", "targetPerWeek": 5}'

# 2. Log it for today (safe to repeat)
curl -X POST http://localhost:4000/api/habits/1/log

# 3. See it on the dashboard
curl http://localhost:4000/api/habits
```

---

## Architecture

### Directory Structure

```
backend/src/
├── config/       # env loading (fail-fast on missing vars) + the demo user id
├── db/           # connection pool, schema.sql, one-shot migration script
├── middleware/   # centralized error handler
├── routes/       # the three habit endpoints — see below
├── types/        # DB row types + the API response shape
├── utils/        # pure streak / weekly-% date math, no I/O
├── app.ts        # Express app: middleware + routes wired together
└── server.ts     # entry point — binds the configured port

frontend/src/
├── api/          # typed fetch client (client.ts)
├── components/   # HabitDashboard, HabitCard, AddHabitForm
├── types/        # API response shape, hand-mirrored from the backend
├── App.tsx
└── main.tsx
```

**Key design choices — and why they stop where they do:**

- All three route handlers live directly in `routes/habits.ts`. There's no separate service or repository layer. At 3 endpoints, splitting into layers would be indirection with no present benefit — it's the kind of abstraction that pays for itself once there are multiple call sites or multiple data sources to swap between, and there's exactly one of each here.
- `utils/date.ts` is pure functions with no I/O — `calculateStreak`, `calculateWeeklyCompletionPercent`, `getTodayDateString`, `toDateString`. That makes the one piece of actual business logic in this system trivially unit-testable in isolation, even though no test suite exists yet (see [Verification Approach](#verification-approach)).
- The DB pool (`db/pool.ts`) is a plain module-level singleton, not injected through an interface or container. A DI framework here would be pure ceremony for one consumer.
- Frontend types are a hand-kept mirror rather than a shared package — a deliberate, documented tradeoff (see [Scope and Non-Goals](#what-this-system-does-not-solve)), not a missed abstraction.

### Tech Stack

| Technology | Role | Why |
|---|---|---|
| **Node.js + Express + TypeScript** | Backend runtime + API framework | Small and unopinionated, matches what the brief specified; TypeScript catches response-shape mismatches a plain JS API wouldn't. |
| **MySQL** (`mysql2`) | Data store | Idempotent logging needs an atomic compound-unique constraint across `(user_id, habit_id, log_date)` — a natural fit for a relational unique index. See the full justification in [Business Rules](#business-rules). |
| **React + Vite + TypeScript** | Frontend | Vite's near-instant dev-server startup made the repeated start → verify → stop cycles (see [Verification Approach](#verification-approach)) fast to run; React was specified in the brief. |
| **Plain CSS** | Styling | The brief explicitly said "functional and clear beats beautiful." A UI framework would be solving a problem that wasn't asked. |

### Request Flow

`GET /api/habits` is the one endpoint doing real work — fetch habits, fan out to fetch each habit's logs, compute stats, respond:

```
Client
  │  GET /api/habits
  ▼
┌────────────────────────────────────────────────────┐
│  habitsRouter (routes/habits.ts)                    │
│                                                      │
│  1. SELECT habits WHERE user_id = ?                 │
│                                                      │
│  2. Promise.all(habits.map(habit =>                 │
│       SELECT log_date FROM habit_logs                │
│       WHERE user_id = ? AND habit_id = ?              │
│         AND log_date >= <90 days ago>                │
│     ))                                               │
│     — fanned out with Promise.all, never a           │
│       forEach-with-async-callback                    │
│                                                      │
│  3. per habit: calculateStreak(logDates)              │
│               calculateWeeklyCompletionPercent(...)   │
│                                                      │
│  4. res.json(habitsWithStats)                        │
└──────────────────────┬───────────────────────────────┘
                       │ 200 OK
                       │   or: thrown error → next(err) →
                       │        errorHandler → generic 500
                       ▼
                     Client
```

`POST /api/habits/:id/log` is simpler and doesn't need a diagram: validate the id, confirm the habit belongs to the demo user, then `INSERT ... ON DUPLICATE KEY UPDATE` — see [Idempotent Logging](#idempotent-logging-why-its-actually-safe) for why that single statement is the whole safety mechanism.

---

## Business Rules

```
weeklyCompletionPercent = min(100, round(daysLoggedInLast7 / targetPerWeek × 100))
currentStreak           = consecutive days counting back from today
                           (or from yesterday, if today hasn't been logged yet —
                            an in-progress day doesn't zero out the streak)
```

- A habit can be logged at most once per calendar day.
- Logging a habit that's already logged today is not an error — it's a no-op that returns the same result as the original log.
- `targetPerWeek` is fixed at creation (1–7); there's no endpoint to change it.
- A habit's name must be unique per user, case-insensitive — see below.

### Unique Habit Names

A habit name is unique per user, case- and whitespace-insensitive: `UNIQUE KEY uniq_user_habit_name (user_id, name)`, with an explicit `COLLATE utf8mb4_0900_ai_ci` on the table so `"Drink Water"` and `"drink water"` collide regardless of a given MySQL instance's default collation, and names are trimmed before insert so padding can't slip past it either. `POST /api/habits` catches the resulting `ER_DUP_ENTRY` error and returns `409 { error: "A habit with this name already exists" }`, rather than letting it fall through to the generic 500 handler.

This wasn't part of the original design — it surfaced from testing the running app (creating "Drink Water" twice produced two visually identical cards on the dashboard, with no way to tell them apart). Fixed with the same pattern already established for idempotent logging: a DB constraint as the source of truth, not an application-level "check if the name exists, then insert."

### Idempotent Logging: Why It's Actually Safe

The requirement was that double-clicking (or double-submitting, or retrying after a timeout) "log today" must never create two log entries for the same day. That's enforced at the database layer, not in application code:

```sql
UNIQUE KEY uniq_user_habit_date (user_id, habit_id, log_date)
```

```sql
INSERT INTO habit_logs (user_id, habit_id, log_date)
VALUES (?, ?, ?)
ON DUPLICATE KEY UPDATE log_date = log_date
```

Two requests logging the same habit on the same day, arriving at the same instant, cannot both create a row. There's no application-level "check if a log exists, then insert" step for two requests to race through — the second `INSERT` collides with the unique key at the storage layer itself, and `ON DUPLICATE KEY UPDATE` turns that collision into a harmless no-op instead of a constraint-violation error. This was verified directly: logging the same habit twice in immediate succession leaves exactly one row in `habit_logs` for that day (see commit history for the local-MySQL verification).

This is a narrower guarantee than the reference pattern of a distributed lock or an atomic counter — it doesn't need to be broader. There is exactly one write path that needs to be race-safe in this system, and a database-enforced unique constraint fully covers it without any application-level coordination.

---

## Consistency & Failure Semantics

A small, honest list of what happens when things don't go perfectly — deliberately short, because this system doesn't have the moving parts (locks, timers, distributed nodes) that would make this section long.

| Scenario | What happens |
|---|---|
| The database is unreachable mid-request | The error propagates to the centralized error handler, which logs the full error server-side and returns a generic `{ error: "Internal server error" }` with a 500 — never a stack trace to the client. Verified by stopping the MySQL container mid-request and confirming both halves. |
| Two browser tabs log the same habit at nearly the same time | Both requests succeed harmlessly (idempotent by construction). Whichever tab's dashboard refetch resolves last shows the correct, current streak — there's no stale-write problem because every read recomputes from the DB, nothing is cached client-side. |
| The frontend's optimistic UI update fires but the network request then fails | `HabitDashboard` rolls the `habits` array back to the pre-click snapshot and shows an inline error. The user sees the button return to "Log today," not a UI that's silently lying about state. |
| A create-habit or log request is retried after a timeout | Create: safe against retries with the *same name* — the unique constraint returns 409 instead of a duplicate row. Not safe against a retry with a *different* name (e.g. a client-side auto-rename-on-conflict) creating a second, distinct habit; there's no idempotency key on this endpoint, since deduplicating genuinely-different-looking requests wasn't a stated requirement. Log: safe, per the row above. |

---

## Assumptions and Tradeoffs

| Decision | Rationale |
|---|---|
| MySQL over MongoDB | Idempotent logging needs a DB-enforced compound unique constraint — a natural fit for a relational unique index. The data is two small, clearly-related tables with a foreign key; no nested or polymorphic shape that would justify a document model. MySQL was also the stack the assessment specified. |
| No service/repository layers | At 3 endpoints with one data source, that split adds indirection with no current benefit. Revisit if either count grows. |
| Client-side validation duplicates server-side validation | The frontend re-checks name/target rules for instant feedback; the backend is the actual authority. Standard pattern, same category as the type-mirroring tradeoff above. |
| No shared types package | Two files, kept in sync by hand — not worth a monorepo setup for this scope. |
| `dateStrings: true` on the MySQL pool | Returns `DATE` columns as plain `'YYYY-MM-DD'` strings instead of JS `Date` objects, so the streak/weekly-window logic can compare dates as strings without timezone-conversion surprises from the driver. |
| Optimistic UI update + authoritative refetch on log | The button needs to feel instant (brief: UI should be clear and functional) and the streak/% math needs to stay in sync with the backend's calculation — recomputing it client-side would risk drift. Refetching after the optimistic flip gets both without duplicating the streak formula in two languages. |

---

## What Would Change for Production

| Gap | Impact | Production Fix |
|---|---|---|
| No authentication | Anyone can act as the demo user; no real multi-tenancy | Session/JWT auth; derive `userId` from the verified token, not a constant |
| No automated tests | Regressions caught only by manual/live verification | Unit tests for `utils/date.ts` (pure, easy), integration tests for the routes, component tests for the frontend |
| No shared types package | Frontend/backend response shape can silently drift | Monorepo with a shared `types` package |
| UTC-only date handling | A user far from UTC sees their "day" roll over at a non-midnight local time | Derive "today" from the authenticated user's timezone |
| `console.error`/`console.log` only | No aggregation, no alerting, no structured fields to filter on | Structured logging (e.g. `pino`) + error tracking (e.g. Sentry) wired into the centralized handler |
| No rate limiting | A single client could hammer the API with no pushback | Rate limiting + `helmet` + request size limits on the Express app |
| Simple "create tables if missing" script | No versioned, reversible schema history | A real migration tool (`db-migrate`, Prisma Migrate) |
| No habit update/delete/archive | Users can't fix a typo'd name or retire a habit | Add the missing CRUD endpoints |
| No pagination on `GET /api/habits` | Would degrade with hundreds of habits | Cursor or offset pagination |
| `esbuild`/Vite dev-dependency advisory (moderate, dev-server only) | No production impact; flagged by `npm audit` | Upgrade to Vite 6+/8 once compatibility is verified |

---

## Verification Approach

No automated test suite exists — see [What This System Does Not Solve](#what-this-system-does-not-solve) for why, given the timebox. In its place, every piece of functionality was verified live against a running stack rather than just read for plausibility:

- **Schema & migration**: run against a real local MySQL 8 container (Docker); confirmed via `SHOW CREATE TABLE` that the unique constraint and foreign key landed as written.
- **Every endpoint**: exercised with `curl`, both valid and invalid input — including confirming the duplicate-log no-op by calling `POST /api/habits/:id/log` twice and checking `habit_logs` still had exactly one row for that day.
- **Error handling**: the MySQL container was deliberately stopped mid-request to confirm the client gets a generic 500 while the real error (with stack trace) only appears in the server log.
- **Frontend**: the dashboard, log-today, and add-habit flows were driven with scripted headless-Chrome (Puppeteer) clicks against the actual running app — not just a build check — confirming real state transitions (optimistic update → refetch → correct streak) end-to-end.

The results of each of these checks are recorded in the commit history, one verification per step.

If this became a real codebase, the top priority from [What Would Change for Production](#what-would-change-for-production) would be turning these manual checks into an automated suite — `utils/date.ts`'s pure functions in particular are close to zero-effort to unit test, since they take plain arrays of date strings and return numbers.

---

## AI Tool Usage

**Part 1 (this app)** was built with **Claude Code** (Anthropic), working from a detailed step-by-step brief: one step per commit, each scoped to a single concern (schema, one endpoint, one component, etc.). For every step, Claude Code ran real, live verification rather than just producing code that looked plausible — e.g. running the schema migration against an actual local MySQL 8 container (via Docker), curling each endpoint with both valid and invalid input, deliberately killing the database mid-request to confirm the error handler behaved correctly, and driving the running frontend with scripted headless-Chrome (Puppeteer) clicks to confirm the dashboard, log-today, and add-habit interactions actually work end-to-end, not just that they compile. Those verification steps and their results are recorded in each commit message. No AI-generated code in this repository was corrected or overridden during the build.

**Part 2 (`part2-code-review.md`)** was written with **Claude** via the claude.ai web interface (not Claude Code): the provided code sample was pasted in and Claude produced the initial review. It was then cross-checked line-by-line against the actual sample code (with Claude Code, as a second pass) to verify every quoted snippet and finding was accurate — all 14 original findings held up — and two additional issues the first pass missed were added: the unawaited `INSERT` in `POST /api/logs` that lets a failed write still report `success: true`, and the missing `.catch()`/loading state on the dashboard's initial fetch. So the review was AI-drafted, then AI-assisted-but-human-directed verification caught and closed two real gaps before submission.

Both are disclosed here plainly, rather than glossed over, so this can be verified against the commit history and discussed candidly in the follow-up session.
