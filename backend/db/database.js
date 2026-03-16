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

db.run(
  `CREATE TABLE IF NOT EXISTS qrs (
    id              INTEGER   PRIMARY KEY AUTOINCREMENT,
    name            TEXT      NOT NULL,
    destination_url TEXT      NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  (err) => {
    if (err) console.error('Error creating table:', err.message);
  }
);

module.exports = db;
