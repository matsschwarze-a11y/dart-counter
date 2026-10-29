# Dart Counter (X01)

Zähl-App für Steeldart auf dem Handy – als installierbare Web-App (PWA), offline nutzbar.
Gegen Freunde oder gegen einen Bot, dessen Stärke über einen Ziel-Average (25–100) eingestellt
wird und der Dart für Dart wie ein Mensch wirft. Jedes Spiel wird gespeichert und ausgewertet.

- X01: 301 / 501, Double-/Master-/Straight-out, optional Double-in, Legs und Sets
- Eingabe jedes Darts einzeln (Single/Double/Triple + Zahl) plus Schnellwahl (26, 41, 45, 60, 81, 85, 100, 140, 180, 0)
- Rückgängig pro Dart, Aufnahmen nachträglich ändern, Checkout-Vorschläge nach jedem Dart
- Jede abgeschlossene Aufnahme bleibt 3 Sekunden sichtbar
- Bot mit realistischem Wurfbild, 1 Dart pro Sekunde
- Turnier: K.-o. mit 8 Teilnehmern, Gegner rund um deinen Average, Stärke wird erst nach dem Spiel aufgedeckt
- Statistik pro Spieler (Average, First 9, Checkout-Quote, Doppelquote je Feld, Wurfbild, Streutendenz, Verlauf, Head-to-Head, Historie)
- Sicherung als JSON, Export als CSV für Excel

Keine Abhängigkeiten, kein Build-Schritt: reines HTML, CSS und JavaScript.

---

## 1. Auf GitHub Pages veröffentlichen

### Variante A – im Browser (ohne git)

1. Auf [github.com](https://github.com) anmelden → oben rechts **+** → **New repository**.
2. Name z. B. `dart-counter`, Sichtbarkeit **Public** (für GitHub Pages im Gratis-Tarif nötig) → **Create repository**.
3. Auf der leeren Repo-Seite **uploading an existing file** anklicken.
4. Den **Inhalt** des Ordners `dart-counter` (nicht den Ordner selbst) per Drag & Drop hineinziehen –
   also `index.html`, `sw.js`, `manifest.webmanifest`, `css/`, `js/`, `icons/` usw.
   (Der Ordner `tests/` und `tools/` schaden nicht, werden aber für die App nicht gebraucht.)
5. Unten **Commit changes**.
6. Im Repo **Settings** → links **Pages** → bei *Build and deployment*:
   *Source* = **Deploy from a branch**, *Branch* = **main**, Ordner **/ (root)** → **Save**.
7. Nach ca. 1 Minute erscheint oben die Adresse, z. B. `https://<dein-name>.github.io/dart-counter/`.

### Variante B – mit git im Terminal

> Auf diesem Mac blockiert aktuell die nicht akzeptierte Xcode-Lizenz `git`. Einmalig im Terminal
> `sudo xcodebuild -license` ausführen, mit Leertaste durchblättern und `agree` eingeben.

```bash
cd dart-counter
git init -b main
git add .
git commit -m "Dart Counter"
git remote add origin https://github.com/<dein-name>/dart-counter.git
git push -u origin main
```

Danach wie oben Schritt 6 (Settings → Pages).

### Updates veröffentlichen

1. Dateien ändern und hochladen bzw. pushen.
2. **Wichtig:** In `sw.js` die Zeile `const VERSION = 'v2';` hochzählen (`'v3'`, `'v4'`, …).
   Nur dann merkt die installierte App, dass es etwas Neues gibt.
3. Beim nächsten Öffnen erscheint unten „Neue Version verfügbar – Aktualisieren".
   Neue Dateien zusätzlich in die Liste `FILES` in `sw.js` eintragen (ein Test prüft das).

---

## 2. Auf dem Handy installieren

### iPhone / iPad (Safari)

1. Die GitHub-Pages-Adresse in **Safari** öffnen (nicht in Chrome – nur Safari kann auf iOS installieren).
2. Unten auf **Teilen** (Quadrat mit Pfeil) tippen.
3. **Zum Home-Bildschirm** wählen → **Hinzufügen**.
4. Die App über das neue Icon starten – sie läuft dann im Vollbild und offline.

### Android (Chrome)

1. Die Adresse in **Chrome** öffnen.
2. Es erscheint meist ein Hinweis **App installieren** – sonst Menü **⋮** → **App installieren**
   bzw. **Zum Startbildschirm hinzufügen**.
3. Bestätigen; die App erscheint im App-Drawer und auf dem Startbildschirm.

### Hinweise

- Die Daten liegen **nur auf dem Gerät** (IndexedDB). Regelmäßig unter
  *Sicherung & Export → Sicherung herunterladen* ein Backup ziehen – damit klappt auch der Umzug
  auf ein neues Handy (*Sicherung einspielen*).
- Auf dem iPhone ist der Speicher einer installierten Web-App von dem in Safari getrennt:
  Spiele, die du im Safari-Tab gemacht hast, siehst du in der installierten App nicht.
- Während eines Spiels bleibt der Bildschirm an (Wake Lock, iOS ab 16.4).

---

## 3. Bedienung in Kürze

- **Neues Match**: Teilnehmer (1–4) aus Spielerprofilen, Gast oder Bot wählen. Beim Bot den
  Ziel-Average mit dem Schieberegler einstellen.
- **Eingabe**: erst Double/Triple antippen (springt danach auf Single zurück), dann die Zahl.
  `25` = Single Bull, `BULL` = 50, `0` = daneben. Die Schnellwahl-Chips füllen alle drei Darts
  auf einmal und werden nur angezeigt, wenn sie keinen Bust verursachen.
- **↶** nimmt den letzten Dart zurück – auch über Spielerwechsel und Leg-Ende hinweg.
- **Verlauf** (oben rechts): Aufnahmen des laufenden (bzw. gerade beendeten) Legs ansehen und ändern.
- **Bot**: wirft 1 Dart pro Sekunde. *Pause* hält an, *Sofort beenden* wirft den Rest der Aufnahme sofort.
- **Nach jeder Aufnahme** bleiben die drei Darts 3 Sekunden stehen. Antippen oder einfach weiter eingeben überspringt das.
- **Turnier**: Spieler und eigenen Average wählen (vorbelegt mit dem 501-Average der letzten 30 Tage).
  Die 7 Gegner liegen höchstens zwei Standardabweichungen (10 % des Averages) um diesen Wert und sind
  nach Stärke gesetzt. Viertel- und Halbfinale First to 3, Finale First to 4, jeweils 501 Double-out.
  Die Ziel-Averages deiner Gegner siehst du nach jedem eurer Spiele, die aller anderen am Turnierende.
- **Wurfbild** (Statistik): Scheibe mit allen Treffern, filterbar nach 1./2./3. Dart der Aufnahme.
  Die Streutendenz wertet Darts bei Rest ab 100 aus: links/rechts (5/1 bzw. 7/3) und Triple/Single/Double.
- **Entwickler-Seite**: App mit `?dev=1` öffnen (z. B. `…/dart-counter/?dev=1`) → Menüpunkt
  „Entwickler: Bot-Simulation" simuliert 1.000 Legs für einen Ziel-Average.

---

## 4. Entwicklung

Voraussetzung: Node.js ≥ 20 (nur für Tests und Hilfsskripte, nicht für die App).

```bash
npm test              # alle Tests (node --test)
npm run serve         # lokaler Server auf http://localhost:8080/
npm run calibrate     # Bot neu kalibrieren → js/bot/calibration-table.js (dauert ein paar Minuten)
npm run checkouts     # Checkout-Tabelle neu erzeugen → js/core/checkout-table.js
npm run icons         # App-Icons neu zeichnen
```

Beim lokalen Testen cached der Service Worker alle Dateien. Nach Code-Änderungen in den
Entwicklertools des Browsers unter *Application → Service Workers* „Unregister" klicken
oder „Update on reload" aktivieren.

### Aufbau

```
js/core/    Spiellogik ohne DOM: Scheibe, Regeln, Match-Engine (Replay), Checkouts, Schnellwahl
js/bot/     Wurfmodell, Zielwahl, Simulation, Kalibrierungstabelle, Bot im Spiel
js/stats/   Statistik und CSV – immer aus den Rohdaten berechnet
js/data/    IndexedDB, Repository, Export/Import
js/ui/      Router, Ansichten, Diagramme
tools/      Generatoren (Checkouts, Kalibrierung, Icons) und Dev-Server
tests/      node --test
```

**Datenmodell:** Quelle der Wahrheit eines Matches ist die Liste aller eingegebenen Darts
(`inputs`). Legs, Aufnahmen und Dart-Details (Punkte, Rest vorher, Doppelversuch, Bust, Checkout)
werden per Replay abgeleitet und mitgespeichert. Dadurch funktionieren Rückgängig und Bearbeiten
über Spielerwechsel hinweg, und alle Statistiken lassen sich jederzeit neu berechnen.

**Bot:** Jeder Dart zielt auf die Mitte eines Feldes; der Treffer streut normalverteilt
(vertikal 1,2× stärker als horizontal) auf einer Scheibe mit Originalmaßen. Pro Leg schwankt die
Form um einige Prozent. Der Bot punktet auf T20 (wechselt nach Fehlwürfen in 1/5 manchmal auf T19,
schwache Bots zielen öfter auf das breite Single-Feld), stellt sich mit dem letzten Dart einen guten
Rest und folgt beim Checkout der Tabelle. Schwächere Bots planen den Stell-Dart nicht immer: Dann punkten sie einfach
weiter oder stellen nach Faustregel (z. B. auf 40 oder 32), wie Amateure auch. Welche Streuung zu welchem Average führt, wurde per
Monte-Carlo-Simulation ganzer Legs ermittelt (`tools/calibrate.js`); der Test prüft, dass die
Ziel-Averages 30/50/70/90 über 1.000 Legs auf ±2 Punkte getroffen werden.
