import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let db;
export async function openDatabase() {
  const dbPath = path.resolve('./data.sqlite');
  const exists = fs.existsSync(dbPath);
  db = new Database(dbPath);
  if (!exists) initialize();
}

function initialize() {
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE user_data (
      user_id INTEGER PRIMARY KEY,
      json TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
}

export async function getUserByUsername(username) {
  const row = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username);
  return row;
}

export async function createUser(username, passwordHash) {
  const info = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
  return info.lastInsertRowid;
}

export async function saveUserData(userId, obj) {
  const json = JSON.stringify(obj || {});
  const existing = db.prepare('SELECT user_id FROM user_data WHERE user_id = ?').get(userId);
  if (existing) {
    db.prepare('UPDATE user_data SET json = ? WHERE user_id = ?').run(json, userId);
  } else {
    db.prepare('INSERT INTO user_data (user_id, json) VALUES (?, ?)').run(userId, json);
  }
}

export async function getUserData(userId) {
  const row = db.prepare('SELECT json FROM user_data WHERE user_id = ?').get(userId);
  return row ? JSON.parse(row.json) : null;
}

export default db;
