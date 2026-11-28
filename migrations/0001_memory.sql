-- Shiomi's memory (docs/nagi-agent-design.md §10). Every row belongs to one Firebase uid.

-- the user corrected one of Shiomi's values by hand
CREATE TABLE corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('impact', 'penalty', 'effort', 'dependency', 'must')),
  shiomi_value TEXT,
  user_value TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX corrections_uid ON corrections (uid, at);

-- a Dive ended: how long the task really took against the estimate
CREATE TABLE actuals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  shiomi_effort INTEGER,
  est_min INTEGER,
  actual_min INTEGER NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX actuals_uid ON actuals (uid, at);

-- Shiomi asked back and the user answered
CREATE TABLE clarifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  task_id TEXT NOT NULL,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX clarifications_uid ON clarifications (uid, at);

-- A2A tasks waiting for the user's answer (input-required). Cloud Run scales to zero, so Shiomi keeps them here.
CREATE TABLE pending_tasks (
  uid TEXT NOT NULL,
  task_id TEXT NOT NULL,
  context_id TEXT NOT NULL,
  body TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (uid, task_id)
);
