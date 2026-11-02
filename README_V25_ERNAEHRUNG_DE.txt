GLOW UP 2026 – Version 25: Ernährungsauswertung

Neu:
- Protein- und Kalorienverlauf je Tag (Darstellung der letzten 14 Tage innerhalb des gewählten Zeitraums).
- Zeitraumfilter: 7, 30, 90 Tage oder Gesamt.
- Tagesdurchschnitt für Kalorien und Protein.
- Wochenübersicht mit Gesamtkalorien, Gesamtprotein und Durchschnitt je erfasstem Tag.
- Anzahl erfasster Tage und Mahlzeiten.
- Anzeige, wie viele Einträge als KI-Schätzung markiert sind.

Datenlogik:
- Auswertung nutzt data.meals, da dort die datierten Mahlzeiten fortlaufend gespeichert sind.
- Leere Tage gehen nicht als 0 in den Tagesdurchschnitt ein.
- Es werden nur gespeicherte numerische Werte aggregiert; fehlende Werte bleiben fehlend.
- Mahlzeiten aus mealHistory werden nicht zusätzlich gezählt, um Doppelzählungen zu verhindern.
- Alle Darstellungen sind lokale Auswertungen; keine Mahlzeiten werden an externe Dienste gesendet, wenn die Auswertung angezeigt wird.
- KI-geschätzte Nährwerte bleiben Schätzwerte.
