GLOW UP 2026 – Update mit dem iPhone
====================================

1. **Daten sichern:** Öffne die App in derselben Safari- oder Home-Bildschirm-Version, die du gewöhnlich nutzt. Gehe zu Fortschritt > Datensicherung > „Backup herunterladen“ und sichere die JSON-Datei in der Dateien-App, am besten in iCloud Drive. Nicht vorher Website-Daten oder Website-Einstellungen löschen.

2. **ZIP entpacken:** Speichere `GLOW_UP_2026_Stability_Upgrade.zip` in „Dateien“, tippe darauf und öffne den entpackten Ordner.

3. **Website-Dateien hochladen:** Öffne GitHub.com in Safari, melde dich an und gehe zum bestehenden Repository, aus dem die App veröffentlicht wird. Öffne denselben Ordner, in dem die bisherige `index.html` liegt. Wähle „Add file“ > „Upload files“ und lade diese vier Dateien aus dem ZIP hoch: `app-core.js`, `ai-client.js`, `sw.js` und `index.html`. Committe auf den Branch und in den Ordner, den die bestehende GitHub-Pages-Seite verwendet. Wenn Safari nur eine Datei auf einmal auswählen lässt, lade zuerst `app-core.js`, `ai-client.js` und `sw.js` hoch und `index.html` zuletzt.

4. **Veröffentlichung abwarten:** Öffne im Repository „Actions“ und warte, bis der GitHub-Pages-Lauf erfolgreich ist. Rufe dann die bisherige App-Adresse in Safari auf und prüfe Ernährung, Training und Fortschritt. Wenn du ein Home-Bildschirm-Symbol nutzt, öffne es nach dem Update erneut; der neue Offline-Cache wird beim nächsten Seitenaufruf geladen. GitHub kann Dateien im Browser hochladen und die konfigurierte Pages-Quelle veröffentlicht Änderungen nach einem Commit.

5. **Backup bei Bedarf zurückspielen:** Die App behält `glowup2026-v5`. Falls Daten in der verwendeten App-Ansicht fehlen, gehe zu Fortschritt > Datensicherung > „Backup wiederherstellen“, wähle die zuvor gesicherte JSON-Datei und bestätige den Austausch. Stelle das Backup in derselben Safari- oder Home-Bildschirm-Version wieder her, aus der es exportiert wurde.

6. **KI-Backend nur wenn gewünscht:** Das Frontend-Update funktioniert ohne Worker-Update; manuelle Mahlzeiten funktionieren ohne KI. Wenn du den Worker selbst aktualisieren möchtest, verwende `index.js` im Cloudflare-Dashboard. Lass vorhandenes `OPENAI_API_KEY`-Secret, KV-Binding und Variablen dort unverändert. Füge niemals einen API-Schlüssel in GitHub, die ZIP-Datei oder die App ein.

Wenn dein Repository geschützte Branches nutzt, folge GitHubs Aufforderung für einen neuen Branch oder Pull Request. Die Pages-Quelle und Cloudflare-Einstellungen werden durch diese Schritte nicht automatisch geändert.
