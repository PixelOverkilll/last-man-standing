README FOR NEXT AI

Zweck
------
Diese Datei hilft einer nachfolgenden KI, schnell den Projektzustand zu erfassen und sicher weiterzuarbeiten, falls der Chat mit der vorherigen Instanz abbricht.

Kurzüberblick zum Repository
-----------------------------
- Projekt: Last Man Standing (Frontend-Quiz)
- Aktueller Branch: main (wurde zuletzt auf Commit 2010b46bcb17c4686acfd1c6ab2ed1f0cfbd367e zurückgesetzt)
- Remote: https://github.com/PixelOverkilll/last-man-standing.git
- Hauptsprache: HTML/CSS/JS, Webpack für Dev/Build

Wichtige Dateien / Orte
------------------------
- `index.html` - Startseite, enthält bg-selector UI und lädt `js/app.js`.
- `css/style.css` - Haupt-CSS für Startseite; hier wurden kürzlich Änderungen an Hintergrund-Styles vorgenommen und später zurückgesetzt.
- `css/lobby.css` - Lobby-spezifische Styles (Referenz für Hintergrund-Attachment/Static-Einstellungen).
- `js/app.js` - Haupt-JavaScript (UI-Interaktion, bg-selector-Handling).
- `js/p2p-connection.js` - P2P/PeerJS-Handling.
- `config.js` - Projektkonfiguration (wird in `index.html` vor `app.js` geladen).
- `webpack.config.dev.js`, `webpack.config.prod.js` - Build/Dev-Server-Konfigurationen.
- `package.json` - enthält scripts: `start` (webpack dev server) und `build`.

Aktueller Zustand / Kontext (wichtig für die Übernahme)
------------------------------------------------------
- Der Benutzer hatte Änderungen an `css/style.css` vorgenommen, um Hintergrund-Animationen auf der Startseite zu deaktivieren und `bg-dots`/`bg-waves` mit Lobby-Einstellungen abzugleichen. Diese Änderung wurde erstellt, committed und gepusht, wurde aber auf Wunsch wieder zurückgesetzt (Reset auf Commit `2010b46b...`).
- Der Stand der Dateien entspricht jetzt dem Commit `2010b46bcb17c4686acfd1c6ab2ed1f0cfbd367e`.

Schnelle Prüf- und Fortsetzungs-Checklist für die nächste KI
-----------------------------------------------------------
1. Repository-Integrität prüfen
   - `cd "C:\Users\Crave\IdeaProjects\Last man standing"`
   - `git fetch --all`
   - `git status --porcelain`  (Arbeitsbaum sauber?)
   - `git rev-parse HEAD` und `git log --oneline -n 5` (Bestätigen, dass HEAD `2010b46...` ist)

2. Lokale Entwicklung starten (falls nötig)
   - Voraussetzung: Node & npm installiert
   - `npm install` (nur wenn node_modules fehlen)
   - Dev-Server starten (PowerShell / cmd.exe):
     ```cmd
     npm run start
     ```
   - Alternativ die Seite direkt öffnen: `index.html` im Browser (kein Build nötig für schnelle visuelle Prüfung).

3. Visueller Smoke-Test
   - Öffne `index.html` im Browser.
   - Öffne DevTools (F12) -> Console: nach Fehlern suchen.
   - Überprüfe Hintergrund-Optionen (Design-Button oben rechts). Wähle `Punkte` und `Wellen` und vergleiche mit Lobby (`lobby.html`) — sie sollten aktuell animiert sein, weil wir auf älteren Commit zurückgesetzt haben.

4. Wenn du Änderungen anwenden willst (sichere Vorgehensweise)
   - Niemals direkt `main` verändern, wenn Änderungen ungetestet sind. Stattdessen neuen Branch anlegen:
     ```cmd
     git checkout -b fix/bg-static-startpage
     ```
   - Änderungen in `css/style.css` vornehmen.
   - Test lokal mit `npm run start` oder Seite manuell öffnen.
   - Committen und pushen:
     ```cmd
     git add css/style.css
     git commit -m "fix: make startpage backgrounds static + sync with lobby"
     git push -u origin fix/bg-static-startpage
     ```
   - Erstelle einen Pull Request (PR) in GitHub, damit der Benutzer oder Reviewer die Änderung prüft.

5. Wenn du den Repo-Zustand zurücksetzen musst (vorsichtig mit --force)
   - Falls du das Remote auf einen bestimmten Commit setzen musst (nur wenn ausdrücklich erlaubt):
     ```cmd
     git fetch --all
     git checkout main
     git reset --hard <commit-hash>
     git push --force origin main
     ```
   - WARNUNG: `--force` überschreibt Remote-Historie. Nur mit Erlaubnis verwenden.

6. Tests & Linting
   - Projekt enthält keine automatisierten Unit-Tests.
   - Für CSS/JS-Syntaxprüfung: öffne die Dateien in einem Editor mit Linter oder prüfe Browser Console auf Laufzeitfehler.

7. Fehlerquellen und Debugging-Hints
   - Probleme beim Laden von PeerJS: Prüfe Browser-Konsole auf CORS / Netzwerkausfälle; es gibt ein Fallback-Skript in `index.html`.
   - Wenn Background-Styles nicht wie erwartet sind: vergleiche `css/style.css` mit `css/lobby.css` (Variable-Namen wie `--bg-dots-size-1` etc.).
   - Wenn der Dev-Server nicht startet: `npm install` ausführen, dann `npm run start`; prüfe Node-Version.

8. Wichtige Git-Hashes (Referenz)
   - Aktueller Ziel-Commit (Stand dieser Übergabe): `2010b46bcb17c4686acfd1c6ab2ed1f0cfbd367e` (main)
   - Falls du die Änderung, die wir kurz committed hatten, wiederfinden willst, suche nach älteren Commits in `git reflog` oder `git log --all --grep="bg"`.

Neues Punktesystem-Design (Oktober 2025)
----------------------------------------
- Die Punkte-Leiste (.player-score) und die Buttons sind jetzt optisch ruhiger und besser integriert.
- Die Primärfarbe des Discord-Avatars des ausgewählten Spielers wird per JS als CSS-Variable (--avatar-color, --avatar-rgb) auf der Spielerkarte gesetzt.
- Die Punkte-Leiste nutzt diese Variable für Umrandung und Schatten, der Hintergrund ist hell und dezent.
- Buttons in der Leiste sind neutral (weiß/grau) und erhalten beim Hover die Avatar-Farbe als Umrandung.
- Die Logik zur Farbextraktion und Variablen-Setzung befindet sich in lobby.js (applyPlayerColor).
- Das Styling erfolgt in style.css, die Leiste und Buttons greifen auf die CSS-Variable zu.
- Die Leiste bleibt rechts, ist aber optisch ruhiger und besser integriert.
- Test: Beim Spielerwechsel passt sich die Leiste dynamisch an.

Design-Änderung Punkte-Knöpfe (Okt 2025)
----------------------------------------
- Die CSS-Klasse `.points-btn` wurde optisch verbessert:
  - Hintergrund jetzt lila Farbverlauf (`#7c3aed` → `#a855f7`)
  - Schrift weiß und fett für bessere Lesbarkeit
  - Hover-Effekt: Border und Schatten kräftiger lila (`#8b27c4`), Schatten intensiver
  - Farbverlauf kehrt sich beim Hover um
- Änderungen in `css/style.css` ab Zeile 1002 vorgenommen
- Ziel: Buttons sind auffälliger, klarer und besser lesbar

Für zukünftige KIs:
- Die Avatar-Farbe kann für weitere UI-Elemente als CSS-Variable genutzt werden.
- Erweiterungen am Punktesystem sollten die CSS-Variable und die bestehenden Klassen verwenden.
- Visuelle Tests: Spieler wechseln, Punkte vergeben, Hover-Effekte prüfen.

Kommunikation & Sicherheit
--------------------------
- Keine Secrets in Klartext ins Repo einchecken.
- Keine Remote-API-Keys in `config.js` committen.
- Wenn Auth für Push fehlt, informiere den Nutzer; versuche nicht, Credentials zu ändern.

Aufgaben, die der nächste KI als erstes tun könnte
-------------------------------------------------
- 1) Kurz prüfen: `git status`, `git rev-parse HEAD` bestätigen.
- 2) `npm run start` und visuell prüfen, ob Startseite und Lobby-Hintergründe konsistent sind.
- 3) Falls der Benutzer die vorige Änderung wiederhaben will, erstelle einen Branch (siehe Abschnitt 4) und apply die Änderung dort.

Kontakt/Meta
------------
- Erstellungsdatum dieser Übergabe: (automatisch generiert vom automatischen Helfer)
- Autor: Generiert als Übergabeinstruktion für die nächste KI

ENDE

Fix: Punktevergabe - weiße Buttons behoben (17.10.2025)
-------------------------------------------------------
Kurzbeschreibung
- Problem: Die Punktevergabe-Buttons wurden auf weiß dargestellt und waren kaum lesbar, obwohl ein dunkles lila Design gewünscht war.
- Ursache: Kombination aus einer überschreibenden CSS-Regel in `css/lobby.css` (weißes Styling) und Inline-Stilzuweisungen in `js/lobby.js`, die den Button-Hintergrund auf `#fff` gesetzt haben. Inline-Stile haben höhere Priorität als CSS-Dateien und führten zu dem hellen, verwaschenen Aussehen.

Was geändert wurde
- `css/lobby.css`: Entferntes helles/weißes `.points-btn`-Styling; ersetzt durch dunkles lila Verlauf-Design mit verbessertem Kontrast, Schatten und Hover.
- `css/style.css`: Globale `.points-sidebar` auf dunkles, semi-transparente Oberfläche gesetzt; spezifische Regeln `.points-sidebar .points-btn` hinzugefügt sowie ein `!important`-Fallback für hartnäckige Überschreibungen.
- `js/lobby.js`: Inline-Stilzuweisungen entfernt; Hover-Styles nur noch temporär (mouseenter/mouseleave); `cleanupPointsSidebarInlineStyles()` ergänzt und beim `DOMContentLoaded` aufgerufen, um alte Inline-Styles zu bereinigen.

Test- und Prüf-Anleitung
1) Pull & Log:
   ```cmd
   cd "C:\Users\Crave\IdeaProjects\Last man standing"
   git pull
   git log --oneline -n 5
   ```
2) Seite neu laden (Cache löschen): STRG+F5 oder STRG+Shift+R, oder Inkognito-Fenster verwenden.
3) Visuell prüfen: Punkte-Sidebar öffnen — Buttons sollten dunkellila mit weißer, fetter Schrift und gutem Schatten sein; Hover zeigt intensivere lila Umrandung.
4) DevTools-Check: Bei einem `.points-btn` im Inspector im Tab "Computed" nachsehen, welche Regel den `background` liefert; kein `rgb(255,255,255)` als Quelle sollte erscheinen.
5) Falls nötig: Inline-Cleanup in Console ausführen:
   ```javascript
   if (typeof cleanupPointsSidebarInlineStyles === 'function') cleanupPointsSidebarInlineStyles();
   ```

Git / Commit-Historie
- Relevante Commits (Beispiele):
  - "fix(ui): Punkte-Sidebar dunkel, entferne weiße Inline-Styles"
  - "fix: Punktevergabe-Buttons dunkler und besser lesbar"
- Änderungen sind auf `origin/main` gepusht.

Weiteres / Empfohlene Optionen
- Wenn du möchtest, kann ich eine zusätzliche Variante mit noch dunkleren Farben (z. B. `#3a0c7a`) oder eine UI-Toggle-Option (hell/dunkel) implementieren.


=== NEUE ÄNDERUNGEN (17.10.2025) ===

Hinzugefügt: Host-Screen-Flash für Richtig/Falsch
-------------------------------------------------
Kurzbeschreibung
- Der Host hat jetzt zwei zusätzliche Knöpfe in der Lobby: "Richtig" (grün) und "Falsch" (rot).
- Beim Drücken eines Knopfes leuchtet der gesamte Bildschirm kurz in der jeweiligen Farbe auf (sichtbar für Host und alle Clients in der Lobby).
- Technisch: Der Host sendet ein P2P-Broadcast mit dem Typ `screen-flash` an alle verbundenen Clients; Clients empfangen dieses Ereignis und spielen die gleiche Flash-Animation lokal ab.

Betroffene Dateien
- `lobby.html` — zwei neue Buttons in `.host-controls` (`btn-correct`, `btn-incorrect`).
- `css/lobby.css` — neue Styles für `.screen-flash` Overlay und Button-Stile für die Host-Knöpfe.
- `js/lobby.js` — neue Funktionen `triggerScreenFlash(color, duration)` und Empfangs-Handler für `screen-flash` Nachrichten. Die Host-Buttons senden außerdem ein Broadcast, damit alle Clients synchron flashen.

Design / Verhalten
- Dauer: Standardmäßig ca. 700ms (mit sanftem Ein-/Ausblenden).
- Farben: Richtig = `rgba(34,197,94,0.92)` (grün), Falsch = `rgba(239,68,68,0.92)` (rot).
- Accessibility: Overlay verwendet `pointer-events: none` so dass Interaktionen nicht blockiert werden; Host-Buttons sind normal erreichbar.

Safety / Hinweise
- Broadcast-Nachrichten sind nur kleine Steuerbefehle (kein Transfer von sensiblen Daten).
- Wenn die P2P-Verbindung instabil ist, funktioniert der Host-Lokal-Flash immer noch (Host sieht sein eigenes Feedback); Clients bekommen ggf. kein Signal.

Test- und Prüf-Anleitung
1) Erstelle Lobby als Host (wie zuvor). Die Host-Knöpfe erscheinen in `.host-controls`.
2) Host klickt "Richtig" oder "Falsch": Bildschirm sollte kurz grün bzw. rot aufblitzen.
3) Clients in der Lobby sollten das gleiche Flash sehen, wenn sie verbunden sind.
4) Console/Network: In DevTools siehst du in der Console das gesendete Broadcast-Event (`screen-flash`).
