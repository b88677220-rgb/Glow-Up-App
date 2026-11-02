GLOW UP 2026 – Version 21 (QA)

Diese Version erweitert die automatisierten Backend-Tests:
- CORS-Allowlist und OPTIONS-Preflight
- Rate-Limit-Speicher fehlt oder ist nicht erreichbar: Anfrage wird blockiert
- Health-Check
- unbekannte Aktion, ungültiges JSON und zu große Requests
- OpenAI-Request: Modell, store:false und Token-Obergrenze
- Token-Nutzungsdaten in der Antwort
- ungültige KI-Antworten werden abgewiesen
- Minutenlimit: fünfte Anfrage erlaubt, sechste blockiert
- Aktionsbezogene Eingabegrenzen

Die Tests laufen lokal mit Node.js:
  cd cloudflare-worker
  node test-worker.mjs

Die Tests verwenden einen simulierten OpenAI-Endpunkt und Testschlüssel. Sie beweisen nicht, dass Cloudflare oder OpenAI live erreichbar sind. Die App wurde nicht auf einem realen iPhone getestet.
