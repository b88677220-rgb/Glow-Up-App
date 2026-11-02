GLOW UP 2026 – KI-Backend und Deployment
========================================

Die App bleibt eine statische GitHub-Pages-PWA. Das KI-Backend ist ein separater Cloudflare Worker. Der Browser speichert das Nutzerprofil weiterhin lokal unter `glowup2026-v5`; ein Update der Website löscht diesen Schlüssel nicht. Vor einem Update trotzdem ein JSON-Backup in der App unter Fortschritt > Datensicherung herunterladen.

Frontend-Dateien
----------------
- `index.html`: Oberfläche und App-Logik.
- `app-core.js`: geprüfte lokale Profil-Lese-/Schreibpfade, Nährwertsummen und wiederherstellbare Zwischenstände für eine Mahlzeit, deren lokaler Speicherversuch fehlgeschlagen ist.
- `ai-client.js`: begrenzter HTTPS-Aufruf, Fehlercodes, Timeout und Nutzungsmeldung.
- `sw.js`: PWA-Cache (v30) einschließlich der beiden Frontend-Helfer.
- `exercise-library.json`, `manifest.json` und `icon.svg`: Übungsdaten und Installationsdarstellung.

`node test-worker.mjs`, `node test-app-core.mjs`, `node test-ai-client.mjs` und `node test-service-worker.mjs` laufen ohne API-Key, Netzverbindung oder zusätzliche Pakete. `npm test` startet alle vier Prüfungen.

Worker einrichten
-----------------
1. In Cloudflare einen Worker mit `index.js` und ein KV-Namespace für `RATE_LIMIT_KV` bereitstellen.
2. Das KV-Binding in den Worker-Einstellungen bzw. in `wrangler.toml` setzen. Die ausgelieferte `wrangler.toml` enthält absichtlich nur einen Platzhalter für die KV-ID.
3. `OPENAI_API_KEY` ausschließlich als Worker-Secret hinterlegen. Den Schlüssel nie in die Website, ein öffentliches Repository, ein Backup oder einen Chat schreiben.
4. `ALLOWED_ORIGIN` auf die genaue GitHub-Pages-Origin setzen, zum Beispiel `https://b88677220-rgb.github.io`. Bei einem Projektpfad bleibt die Origin der Hostname ohne Pfad.
5. Optional `OPENAI_MODEL` setzen; ohne Variable nutzt der Worker den in `index.js` angegebenen Standard. Modellzugriff muss im API-Projekt vorhanden sein.
6. Die Worker-URL in der App unter Ernährung > KI-Verbindung eintragen. Für KI-Anfragen sind eine aktive Einwilligung und eine HTTPS-URL erforderlich. Manuelle Mahlzeiten funktionieren ohne Worker.

Schutzgrenzen und Kosten
------------------------
- Standardmäßig höchstens 5 Anfragen je Minute und 30 je UTC-Tag pro IP. Variablen `MINUTE_REQUEST_LIMIT` und `DAILY_REQUEST_LIMIT` sind serverseitig auf höchstens 10 bzw. 100 begrenzt.
- Das Limit wird über Cloudflare KV gezählt; IP-Werte werden vor dem Speichern gehasht. Bei fehlendem oder fehlerhaftem KV blockiert der Worker die KI-Anfrage.
- KV ist nicht atomar und eventual-consistent. Parallele Anfragen oder mehrere Nutzer hinter einer IP können die Wirkung verändern. Das ist kein garantiertes Euro-Ausgabenlimit.
- Eingaben sind pro Aktion begrenzt (Mahlzeit 3.000, Rezept 4.500, Coach 5.000, Health 500 Zeichen des serialisierten Payloads); HTTP-Anfragen über 10.000 Zeichen werden abgewiesen.
- Maximale Ausgabe: Mahlzeit 400 Tokens, ein Rezept 1.400, drei Rezepte 3.200, Coach 1.000. Der Worker bricht nach 25 Sekunden ab; der Browser wartet höchstens 30 Sekunden und versucht nicht automatisch erneut.
- `store: false`, CORS-Allowlist und serverseitige API-Key-Nutzung bleiben aktiv. CORS ist keine Anmeldung und schützt allein nicht vor direkten Aufrufen.
- Die App zeigt übermittelte Input-/Output-Token als lokale Nutzungsübersicht. Fehlende Provider-Angaben werden nicht geschätzt. Tokenzahlen sind keine Euro-Abrechnung und die Übersicht ist kein Kostenlimit. API-Preise und projektbezogene Ausgabenlimits sind separat im Anbieter-Konto zu prüfen.

GitHub Pages
------------
Die geänderten Frontend-Dateien müssen im selben Verzeichnis liegen wie die bisherige `index.html`. Relative Asset-Pfade funktionieren auch in einem GitHub-Pages-Projektpfad. Bestehende Pages-Einstellungen nicht ändern, wenn die Seite bereits daraus veröffentlicht wird. Pages veröffentlicht nach dem Commit automatisch gemäß der eingerichteten Quelle.

Für eine kurze iPhone-Anleitung siehe `README_IPHONE_DEPLOYMENT_DE.txt`. Ein Backend-Update ist optional und getrennt vom Frontend; ändere Worker-Secrets, KV-Bindings und Variablen dabei nicht.
