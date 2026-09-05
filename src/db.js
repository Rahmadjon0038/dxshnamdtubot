const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'bot.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    first_seen TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    joylashgan_sanasi TEXT,
    fish TEXT,
    passport_seriyasi TEXT,
    tugilgan_sanasi TEXT,
    jinsi TEXT,
    fakulteti TEXT,
    guruh_raqami TEXT,
    kursi TEXT,
    talim_turi TEXT,
    talim_shakli TEXT,
    viloyat_tuman TEXT,
    telefon_raqami TEXT,
    ijtimoiy_holati TEXT,
    xona_raqami TEXT,
    tyutor_fish_tel TEXT,
    photo_file_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

function upsertUser(telegramId, username) {
  db.prepare(
    `INSERT INTO users (telegram_id, username) VALUES (?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username`
  ).run(telegramId, username || null);
}

function getAllUserIds() {
  return db.prepare('SELECT telegram_id FROM users').all().map((r) => r.telegram_id);
}

function hasApplication(telegramId) {
  const row = db
    .prepare('SELECT id FROM applications WHERE telegram_id = ? LIMIT 1')
    .get(telegramId);
  return Boolean(row);
}

function deleteApplicationsByUser(telegramId) {
  db.prepare('DELETE FROM applications WHERE telegram_id = ?').run(telegramId);
}

const APPLICATION_FIELDS = [
  'joylashgan_sanasi', 'fish', 'passport_seriyasi', 'tugilgan_sanasi',
  'jinsi', 'fakulteti', 'guruh_raqami', 'kursi', 'talim_turi', 'talim_shakli',
  'viloyat_tuman', 'telefon_raqami', 'ijtimoiy_holati', 'xona_raqami',
  'tyutor_fish_tel', 'photo_file_id',
];

function saveApplication(telegramId, data) {
  const stmt = db.prepare(`
    INSERT INTO applications (
      telegram_id, joylashgan_sanasi, fish, passport_seriyasi, tugilgan_sanasi,
      jinsi, fakulteti, guruh_raqami, kursi, talim_turi, talim_shakli,
      viloyat_tuman, telefon_raqami, ijtimoiy_holati, xona_raqami,
      tyutor_fish_tel, photo_file_id
    ) VALUES (
      @telegramId, @joylashgan_sanasi, @fish, @passport_seriyasi, @tugilgan_sanasi,
      @jinsi, @fakulteti, @guruh_raqami, @kursi, @talim_turi, @talim_shakli,
      @viloyat_tuman, @telefon_raqami, @ijtimoiy_holati, @xona_raqami,
      @tyutor_fish_tel, @photo_file_id
    )
  `);
  const params = { telegramId };
  for (const field of APPLICATION_FIELDS) {
    params[field] = data[field] ?? null;
  }
  const info = stmt.run(params);
  return info.lastInsertRowid;
}

module.exports = {
  db,
  upsertUser,
  getAllUserIds,
  saveApplication,
  hasApplication,
  deleteApplicationsByUser,
};
