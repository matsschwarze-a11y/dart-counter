import { h, downloadFile, confirmDialog, toast } from '../dom.js';
import { dartsCsv, matchesCsv } from '../../stats/csv.js';

const today = () => new Date().toISOString().slice(0, 10);

export async function renderBackup(root, ctx) {
  ctx.setTitle('Sicherung & Export');
  const { repo } = ctx;
  const page = h('div', { class: 'page' });
  root.append(page);

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const ok = await confirmDialog('Sicherung einspielen?', 'Alle aktuellen Spieler und Matches auf diesem Gerät werden durch die Sicherung ersetzt.', { okLabel: 'Ersetzen', danger: true });
      if (!ok) return;
      const r = await repo.importAll(text);
      toast(`Importiert: ${r.players} Spieler, ${r.matches} Matches`);
    } catch (e) {
      toast('Import fehlgeschlagen: ' + e.message, 5000);
    }
  });

  page.append(h('section', { class: 'card' },
    h('h2', {}, 'Sicherung (JSON)'),
    h('p', { class: 'muted small' }, 'Kompletter Datenbestand – für Backups und den Umzug auf ein anderes Gerät.'),
    h('button', {
      class: 'btn primary block',
      onClick: async () => {
        const data = await repo.exportAll();
        downloadFile(`dart-counter-sicherung-${today()}.json`, JSON.stringify(data, null, 1), 'application/json');
      },
    }, 'Sicherung herunterladen'),
    h('button', { class: 'btn block', onClick: () => fileInput.click() }, 'Sicherung einspielen …'),
    fileInput));

  page.append(h('section', { class: 'card' },
    h('h2', {}, 'Export für Excel (CSV)'),
    h('p', { class: 'muted small' }, 'Semikolon-getrennt, Dezimalkomma, UTF-8 – öffnet sich direkt in Excel.'),
    h('button', {
      class: 'btn block',
      onClick: async () => downloadFile(`dart-counter-darts-${today()}.csv`, dartsCsv(await repo.listMatches()), 'text/csv;charset=utf-8'),
    }, 'Alle Darts (CSV)'),
    h('button', {
      class: 'btn block',
      onClick: async () => downloadFile(`dart-counter-matches-${today()}.csv`, matchesCsv(await repo.listMatches()), 'text/csv;charset=utf-8'),
    }, 'Alle Matches (CSV)')));
}
