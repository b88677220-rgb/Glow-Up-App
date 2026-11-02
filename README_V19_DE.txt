GLOW UP 2026 – Version 19

Änderungen:
- KI-Anfragen pro IP standardmäßig auf 30 pro UTC-Tag und 5 pro Minute begrenzt.
- KI-Anfragen werden blockiert, wenn das Rate-Limit-KV nicht erreichbar ist.
- IP-Adresse wird vor dem Speichern des Rate-Limit-Schlüssels gehasht.
- Geringere maximale Antwort-Token je KI-Aktion zur Begrenzung des Verbrauchs.
- OpenAI-API-Key bleibt ausschließlich serverseitig im Cloudflare Worker.

Wichtig:
Die Limits sind ein Schutzgeländer und keine garantierte Euro-Ausgabenobergrenze.
Live-KI funktioniert erst nach Einrichtung von Cloudflare KV, Worker und OPENAI_API_KEY.
API-Schlüssel niemals in die App, GitHub-Dateien oder einen Chat kopieren.
