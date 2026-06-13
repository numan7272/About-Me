# Lebenslauf

`cv.html` ist ein eigenständiger, ATS-tauglicher Lebenslauf: eine Spalte,
Standard-Schrift, echter Text, Standard-Überschriften. Allgemein gehalten
(nicht auf eine einzelne Stellenanzeige zugeschnitten).

**Seitenumbruch-sicher:** Über `break-inside: avoid` wird kein Abschnitt
und kein einzelner Eintrag mitten durch einen Seitenumbruch getrennt.

**Bewusst NICHT unter `public/`** — wird damit nicht mit der Website
deployt und nicht öffentlich indexierbar (DSGVO + die im ContactPanel
dokumentierte Praxis „Lebenslauf auf Anfrage"). Enthält Adresse und
Telefonnummer; öffentliches Verlinken wäre ein separater, bewusster Schritt.

## PDF erzeugen
1. `cv.html` im Browser öffnen
2. `Strg/Cmd + P` → Ziel „Als PDF speichern"
3. Ränder „Standard", Hintergrundgrafiken aus
