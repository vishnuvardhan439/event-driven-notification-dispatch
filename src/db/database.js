
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || './data/notifications.db';
const resolvedPath = path.resolve(process.cwd(), DB_PATH);

// Make sure the folder that will hold the SQLite file actually exists.
const dbDir = path.dirname(resolvedPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Uses Node's built-in SQLite module (stable in Node 22.5+ / Node 24+).
// This avoids native compilation entirely, unlike better-sqlite3 or
// sqlite3, which require a C++ build toolchain on Windows.
const db = new DatabaseSync(resolvedPath);

// Reasonable defaults for a small local app.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function initSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

module.exports = { db, initSchema };
