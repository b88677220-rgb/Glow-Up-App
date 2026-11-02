GLOW UP 2026 – Version 18
=========================

Änderungen gegenüber Version 17:
- Fehler behoben: Eine alte lokale sendMeal()-Funktion hat die asynchrone KI-Mahlzeitenanalyse überschrieben. Jetzt wird die echte KI-Funktion verwendet, sobald die Verbindung und Einwilligung eingerichtet sind.
- Einwilligung kann in der KI-Verbindung jederzeit widerrufen werden. Danach werden keine neuen KI-Anfragen gesendet.
- Datenschutztext präzisiert: Trainingsdaten werden nur bei separatem Häkchen mitgesendet.
- Worker prüft KI-Antworten je Aktion auf erwartete Struktur und plausible Größenbereiche, bevor sie an die App gehen.
- Service-Worker Cache auf v18 aktualisiert.

Wichtig:
- Live-KI ist erst aktiv, wenn der Cloudflare Worker mit OPENAI_API_KEY und KV eingerichtet und deployed wurde.
- API-Nutzung wird separat abgerechnet. 5 € Startbudget ist eine sinnvolle kleine Testgröße, aber kein garantierter Festpreis.
- KV-Limits bleiben Best-effort; CORS ist kein Login und keine harte Kostengrenze.
- Vor echter Veröffentlichung zusätzlich Browser-/iPhone-Test, Authentifizierung oder Turnstile und Monitoring einrichten.
