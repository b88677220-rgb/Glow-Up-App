GLOW UP 2026 – Version 16 KI
============================

Echte KI-Integration:
- KI-Mahlzeitenanalyse und Nährwertschätzung.
- KI-Rezeptgenerator.
- KI-Rezepte aus ausgewählten Vorratszutaten.
- GLOW KI-Coach.
- Einwilligung vor KI-Übertragung; Trainingsdaten nur bei separater Checkbox.
- API-Key bleibt serverseitig, nicht in der App.

Backend:
Cloudflare Worker im Ordner cloudflare-worker/. Deploye ihn und setze OPENAI_API_KEY als Secret sowie ALLOWED_ORIGIN=https://b88677220-rgb.github.io. Anleitung: cloudflare-worker/README_DEPLOYMENT_DE.txt.

API-Kosten sind separat vom ChatGPT-Abo. Nährwerte und Empfehlungen sind Näherungswerte, keine medizinische Beratung.
Die Live-KI kann erst funktionieren, wenn Worker und API-Key eingerichtet wurden.
ZIP lädt die Website nicht selbst hoch.
