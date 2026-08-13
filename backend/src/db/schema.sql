-- Habit tracker schema
--
-- This exercise uses a single hardcoded demo user (id = 1, see src/config/constants.ts)
-- instead of a real auth system. user_id columns are kept on both tables so the
-- schema doesn't have to change shape when real auth/users are added later.

CREATE TABLE IF NOT EXISTS habits (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  target_per_week TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_habits_user_id (user_id),
  CONSTRAINT chk_target_per_week CHECK (target_per_week BETWEEN 1 AND 7)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per habit per calendar day it was completed. The unique constraint
-- below is what makes logging idempotent: a second "log today" for the same
-- user+habit+date is a harmless no-op at the database level, not something
-- application code has to guard against with a check-then-insert (which would
-- be racy under concurrent requests).
CREATE TABLE IF NOT EXISTS habit_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  habit_id INT UNSIGNED NOT NULL,
  log_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user_habit_date (user_id, habit_id, log_date),
  KEY idx_habit_logs_habit_id (habit_id),
  CONSTRAINT fk_habit_logs_habit
    FOREIGN KEY (habit_id) REFERENCES habits (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
