const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const defaults = () => ({ modules: {}, spamThreshold: 6, raidThreshold: 5, newAccountDays: 7, logChannel: null, supportRole: null, ticketCategory: null, blacklist: { word: [], domain: [], user: [] }, tickets: {}, trusted: [], lockdown: null });
class Store {
  constructor(file = path.join(process.env.DATA_DIR || './data', 'guardbot.sqlite')) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS guilds (id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS cases (id INTEGER PRIMARY KEY AUTOINCREMENT, guild TEXT NOT NULL, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS cases_guild ON cases(guild,id); CREATE TABLE IF NOT EXISTS backups (id TEXT PRIMARY KEY, guild TEXT NOT NULL, data TEXT NOT NULL);');
  }
  get(id) { const row = this.db.prepare('SELECT data FROM guilds WHERE id=?').get(id); return row ? { ...defaults(), ...JSON.parse(row.data) } : defaults(); }
  update(id, fn) { const value = this.get(id); fn(value); this.db.prepare('INSERT INTO guilds VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(id, JSON.stringify(value)); return value; }
  addCase(guild, data) { return Number(this.db.prepare('INSERT INTO cases(guild,data) VALUES (?,?)').run(guild, JSON.stringify({ ...data, at: new Date().toISOString() })).lastInsertRowid); }
  cases(guild, user) { return this.db.prepare('SELECT id,data FROM cases WHERE guild=? ORDER BY id DESC LIMIT 500').all(guild).map(r => ({ id: r.id, ...JSON.parse(r.data) })).filter(r => !user || r.target === user).slice(0, 20); }
  backup(guild, data) { const id = randomUUID(); this.db.prepare('INSERT INTO backups VALUES (?,?,?)').run(id, guild, JSON.stringify({ ...data, at: new Date().toISOString() })); return id; }
  backups(guild) { return this.db.prepare('SELECT id,data FROM backups WHERE guild=? ORDER BY rowid DESC LIMIT 20').all(guild).map(r => ({ id: r.id, ...JSON.parse(r.data) })); }
  getBackup(guild, id) { const row = this.db.prepare('SELECT data FROM backups WHERE guild=? AND id=?').get(guild, id); return row ? JSON.parse(row.data) : null; }
  deleteBackup(guild, id) { return this.db.prepare('DELETE FROM backups WHERE guild=? AND id=?').run(guild, id).changes; }
  removeGuild(id) { this.db.prepare('DELETE FROM guilds WHERE id=?').run(id); this.db.prepare('DELETE FROM cases WHERE guild=?').run(id); this.db.prepare('DELETE FROM backups WHERE guild=?').run(id); }
  close() { this.db.close(); }
}
module.exports = { Store, defaults };
