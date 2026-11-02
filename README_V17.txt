GLOW UP 2026 – Version 19 (KI gehärtet)
======================================

Neu:
- KI-Backend nutzt standardmäßig gpt-6-luna als kostenbewusste Modellwahl.
- Cloudflare KV Rate-Limit: 5 Anfragen pro Minute und 60 pro Tag pro IP (best-effort).
- Eingabegrößenlimits, 25-Sekunden-Timeout, max. 900 Ausgabetokens.
- Worker antwortet mit verständlichen Fehlern bei Limit-/Timeout-Problemen.
- API-Key weiterhin ausschließlich als Server-Secret.
- Detaillierte Cloudflare/KV-Einrichtungsanleitung.

Vor Livebetrieb:
- KV Namespace erstellen und ID in wrangler.toml eintragen bzw. Binding im Dashboard setzen.
- OPENAI_API_KEY als Secret setzen.
- ALLOWED_ORIGIN auf GitHub-Pages-Origin setzen.
- Budget und API Usage Limits im OpenAI API-Projekt kontrollieren.
- Worker deployen, dann Worker-URL in der App speichern und Verbindung testen.

CORS ist kein Login. Rate-Limits sind Best-effort und keine harte Kostenobergrenze.
