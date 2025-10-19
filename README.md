# Last Man Standing — Puppeteer Test (Kurzübersicht)

Diese README erklärt, wie du das Puppeteer-Testskript lokal ausführst und wie du es per GitHub Actions auf deiner GitHub-Repository auslösen und die Ergebnisse herunterladen kannst.

Wichtig: Die Anleitung ist auf Windows (cmd.exe) für lokale Befehle ausgelegt. GitHub Actions läuft auf einem Ubuntu-Runner.

## Lokaler Test (Windows cmd.exe)

1. Projektverzeichnis öffnen:

```cmd
cd "C:\Users\Crave\IdeaProjects\Last man standing"
```

2. Abhängigkeiten installieren (erstmalig oder sauber):

```cmd
npm ci
```

3. Script lokal ausführen (Standard-URL verwendet, wenn keine übergeben wird):

```cmd
npm run puppeteer-test
```

4. Mit eigener URL (z. B. andere Lobby):

```cmd
node server\puppeteer-live-test-debug.js "https://last-man-standing-1.onrender.com/lobby.html?code=SZ038G"
```

5. Ergebnisdateien:
- Screenshot: `server\puppeteer-live-test.png`
- Log: `server\puppeteer-live-test.log` (wenn du die Umleitung manuell vornimmst)
- In der Konsole werden JSON-Blöcke mit Prefixes wie `LIVE_TEST_RESULT:`, `PAGE_CONSOLE:` usw. geloggt.

## Test auf GitHub (GitHub Actions)

Ich habe einen Workflow angelegt unter `.github/workflows/puppeteer-test.yml`. Er wird automatisch bei Push und Pull Requests ausgeführt und kann manuell per `workflow_dispatch` gestartet werden.

1. Änderungen committen und pushen:

```cmd
git add .github/workflows/puppeteer-test.yml package.json README.md
git commit -m "Add GitHub Action and local puppeteer test script"
git push origin <dein-branch>
```

2. Manuelles Auslösen (über GitHub UI):
- GitHub → Repository → Actions → "Puppeteer test" auswählen → Run workflow → Optional `test_url` eingeben → Run workflow.

3. Workflow-Verhalten:
- Installiert Node 20, notwendige Systempakete und `npm ci`.
- Führt `server/puppeteer-live-test-debug.js` aus. Du kannst optional `test_url` eingeben, damit der Runner die gewünschte Seite testet.
- Lädt zwei Artefakte hoch (auch wenn das Skript fehlschlägt):
  - `puppeteer-screenshot` (server/puppeteer-live-test.png)
  - `puppeteer-log` (server/puppeteer-live-test.log)

4. Artefakte herunterladen:
- Gehe zur Actions-Ausführung → Rechtsbereich "Artifacts" → Dateien herunterladen.

## Hinweise und Troubleshooting
- Wenn das Skript auf GitHub fehlschlägt (z. B. Netzwerk, CORS, fehlender Chromium), findest du Details in `puppeteer-live-test.log` und den Action-Logs.
- Wenn du möchtest, dass die Action auch `npm run build` oder zusätzliche Linter ausführt, sag mir Bescheid — ich ergänze das.
- Die Workflow-Datei verwendet `workflow_dispatch` mit dem Input `test_url`. Wenn du regelmäßig verschiedene URLs testen willst, kannst du das Input-Feld beim manuellen Start verwenden.

---

Wenn du willst, dass ich die Workflow-Datei noch so erweitere, dass sie z. B. ein PR-Comment mit dem Ergebnis postet oder die Artefakte automatisch in den Release/Pages hochlädt, setze ich das gern um.
