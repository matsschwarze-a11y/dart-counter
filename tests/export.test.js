import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDb } from '../js/data/db.js';
import { Repo, parseImport } from '../js/data/repo.js';
import { makeMatch, play } from './helpers.js';

test('JSON-Export → Import → Export ergibt denselben Bestand', async () => {
  const repo = new Repo(memoryDb());
  const a = await repo.createPlayer({ name: 'Anna' });
  const bot = await repo.botForAverage(60);
  await repo.setMeta('lastSettings', { startScore: 501 });
  const m = play(makeMatch(), 'T20 T20 T20  S1');
  m.participants[0].playerId = a.id;
  m.participants[1] = { playerId: bot.id, name: bot.name, isBot: true, botAverage: 60 };
  await repo.saveMatch(m);

  const first = await repo.exportAll(0);
  const json = JSON.stringify(first);

  const repo2 = new Repo(memoryDb());
  await repo2.createPlayer({ name: 'wird überschrieben' });
  const res = await repo2.importAll(json);
  assert.deepEqual(res, { players: 2, matches: 1 });
  const second = await repo2.exportAll(0);
  assert.deepEqual(second, first);
  assert.equal((await repo2.getRunningMatch()).id, m.id);
});

test('Import lehnt fremde Dateien ab', () => {
  assert.throws(() => parseImport('{"foo":1}'), /Keine Dart-Counter-Sicherung/);
  assert.throws(() => parseImport({ app: 'dart-counter', version: 1, players: [{}], matches: [] }), /Ungültiger Spieler/);
});

test('Bot-Profil je Stufe wird wiederverwendet; Löschen ist Soft-Delete', async () => {
  const repo = new Repo(memoryDb());
  const b1 = await repo.botForAverage(55);
  const b2 = await repo.botForAverage(55);
  assert.equal(b1.id, b2.id);
  await repo.deletePlayer(b1.id);
  assert.equal((await repo.listPlayers()).length, 0);
  assert.equal((await repo.listPlayers({ includeDeleted: true })).length, 1);
});
