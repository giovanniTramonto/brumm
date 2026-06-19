CREATE TABLE IF NOT EXISTS members (
  user_id       TEXT PRIMARY KEY,
  storage_ref   TEXT,
  first_name    TEXT,
  last_name     TEXT,
  birth_date    TEXT,
  guardian1_name TEXT,
  guardian2_name TEXT,
  email1        TEXT,
  email2        TEXT,
  group_id      TEXT,
  contract_end  TEXT,
  phone1        TEXT,
  phone2        TEXT,
  surcharges    TEXT,
  care_type     TEXT,
  last_edited_at TEXT,
  last_edited_by TEXT,
  address       TEXT
);

CREATE TABLE IF NOT EXISTS managers (
  manager_id  TEXT PRIMARY KEY,
  storage_id  TEXT UNIQUE,
  name        TEXT,
  email       TEXT
);

CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT PRIMARY KEY,
  name     TEXT,
  email    TEXT
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id    TEXT PRIMARY KEY,
  storage_id TEXT UNIQUE,
  name       TEXT,
  email      TEXT
);
