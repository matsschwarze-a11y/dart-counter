# Übergabe: Dart Counter (X01)

Stand: 29.10.2026 · Version `v2` (in `sw.js`) · 53/53 Tests grün

Live: https://matsschwarze-a11y.github.io/dart-counter/ (Repo `matsschwarze-a11y/dart-counter`, öffentlich).

Dieses Dokument fasst alles zusammen, um das Projekt auf einem anderen Account
(Claude, GitHub, Rechner) weiterzuführen. Der komplette Code liegt in diesem Ordner.
Für die Bedienung, das Deployment und die Installation gilt die `README.md`.

---

## 1. Was ist fertig

Mobile Web-App (PWA) zum Zählen von Steeldart-Spielen (X01), Oberfläche auf Deutsch.
Vanilla JavaScript ohne Framework, ohne Build-Schritt und ohne externe Abhängigkeiten;
sie läuft direkt auf GitHub Pages.

| Bereich | Stand |
|---|---|
| Spiellogik | 301/501, Double-/Master-/Straight-out, Double-in, Legs (First to / Best of), Sets, Anwurf-Wechsel |
| Eingabe | Jeder Dart einzeln (S/D/T + 1–20, 25, BULL, 0), Schnellwahl-Chips 0/26/41/45/60/81/85/100/140/180 (nur ohne Bust) |
| Korrektur | Rückgängig pro Dart (auch über Spielerwechsel/Leg-Ende), Aufnahme nachträglich ändern (laufendes oder gerade beendetes Leg) |
| Checkout | Vorschlag nach jedem Dart für 1/2/3 verbleibende Darts; Tabelle mit Profi-Wegen, durch Tests abgesichert |
| Bot | Ziel-Average 25–100, 1 Dart/Sekunde, realistisches Wurfbild; schwächere Bots stellen nicht immer perfekt; Pause / „Sofort beenden" |
| Anzeige | Jede abgeschlossene Aufnahme bleibt 3 s stehen (Mensch und Bot), Antippen überspringt |
| Turnier | K.-o. mit 8 Teilnehmern (du + 7 Bots um deinen Average, gesetzt), QF/HF First to 3, Finale First to 4, 501 DO; Stärke wird nach jedem eigenen Spiel aufgedeckt, Rest am Ende |
| Speicherung | IndexedDB, Autosave nach jedem Dart, Fortsetzen nach Neuladen |
| Statistik | Average, First 9, Checkout-Quote, Doppelquote je Feld, 60+/100+/140+/180, bestes Leg/Finish, Siegquoten, Wurfbild (Heatmap je Dart 1/2/3), Streutendenz 20er/19er, Verlauf (SVG), Head-to-Head, Historie mit allen Aufnahmen; Filter nach Zeitraum, Gegner/Bot-Stufe, Startscore |
| Backup | JSON-Export/-Import (vollständig), CSV für Excel (`;`, Dezimalkomma, UTF-8 mit BOM) |
| PWA | Manifest, Icons, Service Worker mit versioniertem Cache und Update-Hinweis, Wake Lock |
| Entwickler | `?dev=1` → Bot-Simulation über 1.000 Legs mit allen Kennzahlen |

**Geprüft:** Im Browser mit iPhone-Viewport (375×812) lief ein komplettes Match gegen den Bot.
Getestet wurden außerdem Fortsetzen nach Neuladen, Bearbeiten, Rückgängig, Statistik,
Dev-Seite und Offline-Betrieb nach dem Stoppen des Servers.

**Noch nicht geprüft:** echtes iPhone/Android, Wake Lock, Download/Upload der Sicherung
auf dem Handy, Deployment auf GitHub Pages.

---

## 2. Offene Punkte / nächste Schritte

1. **Version v2 hochladen**: Im Repo *Add file → Upload files*, den Inhalt des Ordners hineinziehen, *Commit changes*.
   Die Xcode-Lizenz ist auf diesem Mac nicht akzeptiert, daher sind `git` und `python3` gesperrt.
   `/Library/Developer/CommandLineTools/usr/bin/git` funktioniert trotzdem. Der lokale Git-Stand ist nicht mit GitHub verbunden,
   weil per Browser hochgeladen wurde.
2. Auf echtem iPhone installieren und ein Match spielen (Safari → Teilen → Zum Home-Bildschirm).
3. Ideen für später (vom Nutzer bewusst zurückgestellt): weitere Spielmodi wie Cricket oder
   Around the Clock, Mehrsprachigkeit.

---

## 3. Getroffene Entscheidungen

Vom Nutzer vorgegeben:
- Hosting: GitHub Pages als installierbare PWA
- Zuerst nur X01
- Eingabe jedes Darts einzeln, dazu Schnellwahl für häufige Aufnahmen (z. B. 26)
- Bot-Average 25–100, 1 Sekunde pro Dart, Darts erscheinen nacheinander
- Statistikseite in der App, keine Extras, Sprache Deutsch

Festgelegt während der Umsetzung:
- **Datenmodell:** Quelle der Wahrheit eines Matches ist `match.inputs` (Liste aller Darts
  `{seg, mult}`). Legs, Aufnahmen und Dart-Details werden per Replay (`js/core/match.js`)
  abgeleitet und mitgespeichert. Darauf beruhen Rückgängig und Bearbeiten.
- **Gastspieler** haben keine Profil-ID und erscheinen nicht in der Statistik.
  Löschen von Spielern ist ein Soft-Delete.
- **Bot-Profile:** Pro Bot-Stufe wird automatisch ein Profil „Bot 60" usw. angelegt, damit sich
  die Statistik nach Bot-Stufe filtern lässt.
- **Ausbullen:** Am Board ausbullen und den Gewinner als Anwurf wählen (oder „Zufall").
- **Sets:** Der Anwurf wechselt je Set und innerhalb des Sets je Leg.
- **Bot-Stellen:** Nur mit dem letzten Dart einer Aufnahme und nur bei einem Rest ≤ 170;
  darüber punktet der Bot normal auf T20.
- **Startscore:** 701 entfernt (alte Einstellungen fallen auf 501 zurück). Die Auswahlfelder steckten in `<label>`;
  Safari leitete Klicks nach dem Neuzeichnen an den ersten Knopf weiter. Jetzt `<div>`, Knöpfe bleiben erhalten.
  Best of erlaubt nur ungerade Legs/Sets.
- **Bot 301 vs. 501:** Gleiche Wurfstärke (σ) in beiden Modi. Simuliert liegt der Average in 301 ca. 6 Punkte
  niedriger (mehr Checkout-Anteil), das ist auch bei Menschen so. Kein Kalibrieren pro Modus (Nutzerentscheidung).
- **Turnier-Bots** haben keine Profil-ID (`playerId: null`), damit kein „Bot 52"-Profil die Stärke verrät.
  Turniere liegen im Meta-Speicher (`tournaments`) und sind damit in der JSON-Sicherung enthalten.
- **Wurfbild:** Single innen/außen lassen sich nicht unterscheiden. Die Streutendenz nimmt bei Rest ≥ 100 an, dass auf 20 bzw. 19 gezielt wurde.
- **Checkout-Wege:** Werden berechnet; für die Reste 61–170 sind gängige Profi-Wege fest hinterlegt.

---

## 4. Bot-Modell und Kalibrierung

- Scheibe mit Originalmaßen (mm). Treffer = Zielpunkt + Normalverteilung, σy = 1,2 · σx.
- Form-Schwankung pro Leg: σ × N(1; 0,05), begrenzt auf ±10 %.
- Zielwahl: T20; nach einem Treffer in 1 oder 5 mit 35 % Wahrscheinlichkeit Wechsel auf T19.
  Schwache Bots zielen öfter auf das breite Single-Feld. Beim Checkout folgt der Bot der Tabelle
  und zielt auf die Feldmitte.
- Die Tabelle Average → σ (`js/bot/calibration-table.js`) wurde per `npm run calibrate`
  erzeugt (6.000 simulierte Legs je Stützstelle).
- Ergebnis: Ziel 30/50/70/90 innerhalb ±2 über 1.000 Legs (geprüft mit 8 Seeds,
  max. Abweichung 1,5). Checkout-Quote von ca. 5 % (Bot 25) bis 48 % (Bot 100).
- **Wichtig:** Nach jeder Änderung an `js/bot/strategy.js` oder `throw-model.js`
  neu kalibrieren (`npm run calibrate`, dauert einige Minuten) und `npm test` laufen lassen.

---

## 5. Dateien

```
index.html, manifest.webmanifest, sw.js, .nojekyll   App-Shell und PWA
css/app.css                                          Design (dunkel, kontrastreich)
icons/                                               generiert mit tools/gen-icons.js
js/core/     board, rules, match, checkout(+table), quick, rng, tournament   – reine Logik, testbar
js/bot/      throw-model, strategy, simulate, sim-match, calibration-table, bot-player
js/stats/    stats, csv
js/data/     db (IndexedDB + In-Memory), repo (CRUD, Export/Import)
js/ui/       app (Router, Service Worker), dom, chart, board-svg, views/*
tools/       serve.js, gen-checkouts.js, calibrate.js, gen-icons.js
tests/       *.test.js (node --test)
README.md    Bedienung, Deployment, Installation
UEBERGABE.md dieses Dokument
```

Nicht im Ordner: `Claude/.claude/launch.json` und `Split/.claude/launch.json` (nur für die Vorschau im Claude-Code-Tab, nicht nötig).

---

## 6. Umzug Schritt für Schritt

### Code
1. Den Ordner `dart-counter` (oder `dart-counter.zip`) auf den neuen Rechner bzw. in den
   neuen Account kopieren. Er ist vollständig und hat keine Abhängigkeiten.
2. Prüfen, ob alles läuft (Node.js ≥ 20 nötig):
   ```bash
   cd dart-counter
   npm test
   npm run serve
   ```
   Dann http://localhost:8080/ öffnen.

### GitHub
- Neues Repository im neuen GitHub-Account anlegen, Inhalt von `dart-counter` hochladen und
  Pages aktivieren (README, Abschnitt 1). Die URL lautet dann
  `https://<neuer-name>.github.io/<repo>/`.

### Spieldaten (falls schon gespielt wurde)
- Die Spieldaten liegen **im Browser des Geräts**, nicht im Code-Ordner.
- In der alten App: *Sicherung & Export → Sicherung herunterladen* (JSON).
- In der neuen App (neue Adresse): *Sicherung & Export → Sicherung einspielen*.
- Eine neue Adresse bedeutet einen leeren Speicher. Ohne diesen Schritt fehlen die alten Spiele.

### Mit Claude weiterarbeiten
Im neuen Account eine Session im Ordner `dart-counter` starten und zum Beispiel schreiben:

> Lies `UEBERGABE.md` und `README.md`. Das ist meine Dart-Counter-PWA (X01, Bot, Statistik,
> Vanilla JS, Tests mit `node --test`). Ich möchte als Nächstes … (z. B. GitHub Pages einrichten /
> Cricket ergänzen / …).

Die ursprüngliche Projektbeschreibung (Anforderungen) ist in den Abschnitten 1 und 3 dieses
Dokuments vollständig abgebildet.
