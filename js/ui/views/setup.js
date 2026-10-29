import { h, clear, segmented, stepper, askText, toast } from '../dom.js';
import { createMatch, DEFAULT_SETTINGS } from '../../core/match.js';
import { MIN_AVERAGE, MAX_AVERAGE } from '../../bot/calibration-table.js';

const GUEST = '__guest';
const BOT = '__bot';
const NEW = '__new';

export async function renderSetup(root, ctx) {
  ctx.setTitle('Neues Match');
  const { repo } = ctx;
  const last = await repo.getMeta('lastSetup', null);
  const settings = structuredClone(last?.settings || DEFAULT_SETTINGS);
  settings.format = { ...DEFAULT_SETTINGS.format, ...settings.format };
  if (![301, 501].includes(settings.startScore)) settings.startScore = 501; // 701 gibt es nicht mehr
  let players = await repo.listPlayers();
  const humans = () => players.filter((p) => !p.isBot);
  // Teilnehmer-Slots: {kind: 'player'|'guest'|'bot', playerId, botAverage}
  let slots = (last?.slots || []).filter((s) => s.kind !== 'player' || humans().some((p) => p.id === s.playerId));
  if (!slots.length) {
    slots = [humans()[0] ? { kind: 'player', playerId: humans()[0].id } : { kind: 'guest' }, { kind: 'bot', botAverage: 50 }];
  }
  let starter = 0; // Index oder 'random'

  const page = h('div', { class: 'page setup' });
  root.append(page);

  const slotLabel = (s, i) => {
    if (s.kind === 'player') return humans().find((p) => p.id === s.playerId)?.name || 'Spieler';
    if (s.kind === 'bot') return `Bot ${s.botAverage}`;
    return slots.filter((x, j) => x.kind === 'guest' && j <= i).length > 1 ? `Gast ${i + 1}` : 'Gast';
  };

  function render() {
    clear(page);
    // ---- Teilnehmer
    const list = h('div', { class: 'slots' });
    slots.forEach((s, i) => {
      const select = h('select', { class: 'select', 'aria-label': `Teilnehmer ${i + 1}` },
        humans().map((p) => h('option', { value: p.id, selected: s.kind === 'player' && s.playerId === p.id }, p.name)),
        h('option', { value: GUEST, selected: s.kind === 'guest' }, 'Gast (ohne Statistik)'),
        h('option', { value: BOT, selected: s.kind === 'bot' }, 'Bot'),
        h('option', { value: NEW }, '+ Neuer Spieler …'));
      select.addEventListener('change', async () => {
        const v = select.value;
        if (v === NEW) {
          const name = await askText('Neuer Spieler', '', { placeholder: 'Name' });
          if (name) {
            const p = await repo.createPlayer({ name });
            players = await repo.listPlayers();
            slots[i] = { kind: 'player', playerId: p.id };
          }
        } else if (v === GUEST) slots[i] = { kind: 'guest' };
        else if (v === BOT) slots[i] = { kind: 'bot', botAverage: slots[i].botAverage || 50 };
        else slots[i] = { kind: 'player', playerId: v };
        render();
      });
      const row = h('div', { class: 'slot' },
        h('div', { class: 'slot-head' },
          h('span', { class: 'slot-no' }, String(i + 1)),
          select,
          slots.length > 1 ? h('button', { class: 'btn icon ghost', 'aria-label': 'Teilnehmer entfernen', onClick: () => { slots.splice(i, 1); if (starter !== 'random' && starter >= slots.length) starter = 0; render(); } }, '✕') : null));
      if (s.kind === 'bot') {
        const out = h('output', { class: 'bot-avg' }, String(s.botAverage));
        const range = h('input', { type: 'range', min: MIN_AVERAGE, max: MAX_AVERAGE, step: 1, value: s.botAverage, 'aria-label': 'Ziel-Average des Bots' });
        range.addEventListener('input', () => {
          s.botAverage = Number(range.value);
          out.textContent = range.value;
        });
        range.addEventListener('change', render);
        row.append(h('div', { class: 'bot-row' }, h('span', { class: 'muted' }, 'Ziel-Average'), range, out));
      }
      list.append(row);
    });

    page.append(h('section', { class: 'card' },
      h('h2', {}, 'Teilnehmer'),
      list,
      slots.length < 4 ? h('button', { class: 'btn', onClick: () => { slots.push({ kind: 'bot', botAverage: 50 }); render(); } }, '+ Teilnehmer') : null));

    // ---- Spielmodus
    const f = settings.format;
    // Best of: nur ungerade Anzahl, sonst gäbe es Unentschieden-Grenzen wie „Best of 4"
    const oddOnly = (max, withZero) => [...(withZero ? [0] : []), ...Array.from({ length: Math.ceil(max / 2) }, (_, i) => 2 * i + 1)];
    const legsStepper = stepper(f.legs, { min: 1, max: 21, values: f.type === 'bestOf' ? oddOnly(21) : null, onChange: (v) => (f.legs = v) });
    const setsStepper = stepper(f.sets || 0, {
      min: 0, max: 13, values: f.type === 'bestOf' ? oddOnly(13, true) : null,
      format: (v) => (v ? String(v) : 'keine'),
      onChange: (v) => {
        f.sets = v;
        legsLabel.textContent = v ? 'Legs pro Set' : 'Legs';
      },
    });
    const legsLabel = h('span', {}, f.sets ? 'Legs pro Set' : 'Legs');
    page.append(h('section', { class: 'card' },
      h('h2', {}, 'Spiel'),
      h('div', { class: 'field' }, h('span', {}, 'Startscore'),
        segmented([301, 501].map((v) => ({ value: v, label: String(v) })), settings.startScore, (v) => (settings.startScore = v), { name: 'Startscore' })),
      h('div', { class: 'field' }, h('span', {}, 'Out'),
        segmented([{ value: 'double', label: 'Double' }, { value: 'master', label: 'Master' }, { value: 'straight', label: 'Straight' }], settings.outMode, (v) => (settings.outMode = v), { name: 'Out-Modus' })),
      h('div', { class: 'field' }, h('span', {}, 'Double-in'),
        segmented([{ value: false, label: 'Aus' }, { value: true, label: 'An' }], settings.doubleIn, (v) => (settings.doubleIn = v), { name: 'Double-in' })),
      h('div', { class: 'field' }, h('span', {}, 'Format'),
        segmented([{ value: 'firstTo', label: 'First to' }, { value: 'bestOf', label: 'Best of' }], f.type, (v) => {
          f.type = v;
          if (v === 'bestOf') {
            if (f.legs % 2 === 0) f.legs++;
            if (f.sets && f.sets % 2 === 0) f.sets++;
          }
          render();
        }, { name: 'Format' })),
      h('div', { class: 'field' }, legsLabel, legsStepper),
      h('div', { class: 'field' }, h('span', {}, 'Sets'), setsStepper),
    ));

    // ---- Anwurf
    const opts = slots.map((s, i) => ({ value: i, label: slotLabel(s, i) }));
    opts.push({ value: 'random', label: 'Zufall' });
    page.append(h('section', { class: 'card' },
      h('h2', {}, 'Anwurf'),
      h('p', { class: 'muted small' }, 'Wer beginnt? Beim Ausbullen am Board einfach den Gewinner wählen.'),
      segmented(opts, starter, (v) => (starter = v), { name: 'Anwurf' })));

    page.append(h('div', { class: 'sticky-actions' },
      h('button', { class: 'btn primary big block', onClick: start }, 'Match starten')));
  }

  async function start() {
    const guests = slots.filter((s) => s.kind === 'guest').length;
    const ids = slots.filter((s) => s.kind === 'player').map((s) => s.playerId);
    if (new Set(ids).size !== ids.length) return toast('Ein Spieler ist doppelt ausgewählt');
    const participants = [];
    let g = 0;
    for (const s of slots) {
      if (s.kind === 'player') {
        const p = humans().find((x) => x.id === s.playerId);
        participants.push({ playerId: p.id, name: p.name, isBot: false });
      } else if (s.kind === 'bot') {
        const b = await repo.botForAverage(s.botAverage);
        participants.push({ playerId: b.id, name: b.name, isBot: true, botAverage: s.botAverage });
      } else {
        g++;
        participants.push({ playerId: null, name: guests > 1 ? `Gast ${g}` : 'Gast', isBot: false });
      }
    }
    // gleiche Bot-Stufe zweimal → Namen unterscheiden
    const seen = {};
    for (const p of participants) {
      seen[p.name] = (seen[p.name] || 0) + 1;
      if (seen[p.name] > 1) p.name += ` (${seen[p.name]})`;
    }
    const sp = starter === 'random' ? Math.floor(Math.random() * participants.length) : starter;
    const match = createMatch({ settings: { ...settings, format: { ...settings.format }, startPlayer: sp }, participants });
    const running = await repo.getRunningMatch();
    if (running) await repo.abortMatch(running.id);
    await repo.saveMatch(match);
    await repo.setMeta('lastSetup', { settings, slots });
    ctx.navigate('#/spiel');
  }

  render();
}
