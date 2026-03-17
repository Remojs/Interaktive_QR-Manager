const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'qrs.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

db.serialize(() => {
  // Groups table
  db.run(
    `CREATE TABLE IF NOT EXISTS groups (
      id         INTEGER   PRIMARY KEY AUTOINCREMENT,
      name       TEXT      NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => { if (err) console.error('Error creating groups table:', err.message); }
  );

  // QRs table (group_id added here for fresh installs)
  db.run(
    `CREATE TABLE IF NOT EXISTS qrs (
      id              INTEGER   PRIMARY KEY AUTOINCREMENT,
      name            TEXT      NOT NULL,
      destination_url TEXT      NOT NULL,
      group_id        INTEGER,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    (err) => { if (err) console.error('Error creating qrs table:', err.message); }
  );

  // Migration: add group_id to existing databases (safe – ignored if column already exists)
  db.run(
    `ALTER TABLE qrs ADD COLUMN group_id INTEGER`,
    (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error (group_id):', err.message);
      }
    }
  );

  // Migration: add locked column (safe – ignored if column already exists)
  db.run(
    `ALTER TABLE qrs ADD COLUMN locked INTEGER NOT NULL DEFAULT 0`,
    (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error (locked):', err.message);
      }
    }
  );

  // Indexes for query performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_qrs_group_id   ON qrs(group_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_qrs_created_at ON qrs(created_at)`);
});

module.exports = db;
