// Datenzugriff: Spieler, Matches, laufendes Match, Export/Import.
import { newId } from '../core/match.js';

export const EXPORT_FORMAT = 'dart-counter';
export const EXPORT_VERSION = 1;

export class Repo {
  constructor(db) {
    this.db = db;
  }

  // ---- Spieler ----
  async listPlayers({ includeDeleted = false } = {}) {
    const all = await this.db.getAll('players');
    return all
      .filter((p) => includeDeleted || !p.deleted)
      .sort((a, b) => Number(a.isBot) - Number(b.isBot) || (a.botAverage ?? 0) - (b.botAverage ?? 0) || a.name.localeCompare(b.name, 'de'));
  }

  getPlayer(id) {
    return this.db.get('players', id);
  }

  async createPlayer({ name, isBot = false, botAverage = null }) {
    const p = { id: newId(), name: name.trim(), isBot, botAverage: isBot ? botAverage : null, createdAt: Date.now(), deleted: false };
    await this.db.put('players', p);
    return p;
  }

  async renamePlayer(id, name) {
    const p = await this.getPlayer(id);
    p.name = name.trim();
    await this.db.put('players', p);
    return p;
  }

  /** Soft-Delete: alte Matches bleiben lesbar. */
  async deletePlayer(id) {
    const p = await this.getPlayer(id);
    p.deleted = true;
    await this.db.put('players', p);
  }

  /** Bot-Profil zu einem Average (wird bei Bedarf angelegt, damit Statistik je Stufe möglich ist). */
  async botForAverage(avg) {
    const all = await this.db.getAll('players');
    const found = all.find((p) => p.isBot && p.botAverage === avg && !p.deleted);
    if (found) return found;
    return this.createPlayer({ name: `Bot ${avg}`, isBot: true, botAverage: avg });
  }

  // ---- Matches ----
  saveMatch(match) {
    return this.db.put('matches', match);
  }

  getMatch(id) {
    return this.db.get('matches', id);
  }

  async listMatches() {
    const all = await this.db.getAll('matches');
    return all.sort((a, b) => b.createdAt - a.createdAt);
  }

  async getRunningMatch() {
    const all = await this.db.getAll('matches');
    return all.filter((m) => m.status === 'running').sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  }

  async abortMatch(id) {
    const m = await this.getMatch(id);
    if (!m) return;
    m.status = 'aborted';
    await this.saveMatch(m);
  }

  deleteMatch(id) {
    return this.db.delete('matches', id);
  }

  // ---- Einstellungen ----
  async getMeta(key, fallback = null) {
    const r = await this.db.get('meta', key);
    return r ? r.value : fallback;
  }

  setMeta(key, value) {
    return this.db.put('meta', { key, value });
  }

  // ---- Turniere (im Meta-Speicher, damit sie in Sicherungen enthalten sind) ----
  listTournaments() {
    return this.getMeta('tournaments', []);
  }

  async getRunningTournament() {
    return (await this.listTournaments()).find((t) => t.status === 'running') || null;
  }

  async saveTournament(t) {
    const all = await this.listTournaments();
    const i = all.findIndex((x) => x.id === t.id);
    if (i >= 0) all[i] = t;
    else all.unshift(t);
    await this.setMeta('tournaments', all);
  }

  // ---- Export / Import ----
  async exportAll(now = Date.now()) {
    const [players, matches, meta] = await Promise.all([this.db.getAll('players'), this.db.getAll('matches'), this.db.getAll('meta')]);
    return buildExport({ players, matches, meta }, now);
  }

  async importAll(json) {
    const data = parseImport(json);
    await this.db.replaceAll(data);
    return { players: data.players.length, matches: data.matches.length };
  }
}

const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export function buildExport({ players, matches, meta = [] }, now = Date.now()) {
  return {
    app: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    players: [...players].sort(byId),
    matches: [...matches].sort(byId),
    meta: [...meta].sort((a, b) => (a.key < b.key ? -1 : 1)),
  };
}

export function parseImport(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || data.app !== EXPORT_FORMAT) throw new Error('Keine Dart-Counter-Sicherung');
  if (data.version > EXPORT_VERSION) throw new Error('Sicherung stammt aus einer neueren App-Version');
  if (!Array.isArray(data.players) || !Array.isArray(data.matches)) throw new Error('Sicherung unvollständig');
  for (const p of data.players) if (!p.id || typeof p.name !== 'string') throw new Error('Ungültiger Spieler in der Sicherung');
  for (const m of data.matches) if (!m.id || !Array.isArray(m.inputs) || !m.settings) throw new Error('Ungültiges Match in der Sicherung');
  return { players: data.players, matches: data.matches, meta: Array.isArray(data.meta) ? data.meta : [] };
}
