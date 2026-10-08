# Mobile UX und Performance – 3. Oktober 2026

Die zentralen mobilen Wege sind nutzbar. Die wichtigsten Probleme lagen beim Öffnen und Schließen von HQ-Dateien sowie bei Fenstern im Querformat. Diese Stellen wurden korrigiert.

## Prüfung

Browserprüfung mit 320 × 568, 390 × 844 und 844 × 390 CSS-Pixeln. Geprüft wurden Start, Tour, neue Erfahrungsstationen, HQ-Dateien, Einstellungen und Schließen-Bedienelemente. Die Prüfung emuliert die Bildschirmgröße; sie ersetzt keinen Test auf einem echten iPhone oder Android-Gerät.

| Priorität | Befund | Korrektur und Nachweis |
| --- | --- | --- |
| Hoch | Im Querformat war das HQ-Fenster 540 px hoch und reichte bei 390 px Bildschirmhöhe über den unteren Rand. | HQ nutzt auch im schmalen Querformat die verfügbare Höhe. Nachgemessen: Fenster beginnt bei 48 px und endet bei 390 px. Der Inhalt scrollt im Fenster. |
| Hoch | Desktop-Dateien benötigten auch auf dem Handy einen Doppeltipp. | Auf Touch-Geräten und in mobilen Layouts öffnet ein Tipp die Datei. Mit H1_BBP.h1 im Browser geprüft. Desktop-Doppelklick und Tastaturbedienung bleiben verfügbar. |
| Mittel | Fensterknöpfe waren 12 × 12 px groß, der Kartenknopf 20 × 20 px. | Mobile Schließen-Knöpfe und Kartenknopf sind mindestens 44 × 44 px groß. Das HQ-Schließen ist als echtes, beschriftetes Button-Element erreichbar. |
| Mittel | Im HQ lag das Dock über geöffneten Dokumenten. | Im mobilen Fensterlayout wird das Dock beim Lesen ausgeblendet. Nach dem Schließen der Datei erscheint es wieder. |
| Mittel | Tour zeigte Fahrgeschwindigkeit und zeitweise einen Recenter-Knopf, obwohl das Bike gesperrt war. | Diese Fahranzeigen bleiben während der Tour ausgeblendet. Der Drawer nutzt den Platz am unteren Rand und berücksichtigt die Safe Area. |
| Mittel | Kleine oder niedrige Displays konnten Dialoginhalte abschneiden. | Tour-Start, Steuerungsauswahl, Einstellungen und mobiler Drawer haben begrenzte Höhen und scrollbare Inhalte. HQ nutzt dynamische Viewport-Höhe und Safe Areas. Bei 320 px gab es im geprüften Dokument keinen horizontalen Seitenüberlauf. |
| Niedrig | Mobile Startaufforderung sprach vom Klicken; Desktop-Tastenhilfe stand im schmalen Layout. | „Tippen zum Start“ im mobilen Layout. Die Desktop-Hilfe bleibt auf schmalen Displays ausgeblendet. |
| Mittel | Karte und Tour-Knopf behielten nach einer Größenänderung ihre ursprüngliche Position. | Beide passen ihre Position bzw. Größe bei Resize an. |

## Performance

- Die Glow-Logik markierte sämtliche anklickbaren Materialien pro Frame mit `needsUpdate`, auch ohne Hover oder Tour-Highlight. Die Korrektur bearbeitet nur aktive Materialien, hält einen Cache und restauriert Originalwerte beim Verlassen. Nicht leuchtende Logo-Materialien bleiben unberührt.
- Gleichfarbige statische Teile der beiden neuen Stationen werden zusammengeführt. Beispielsweise werden die 14 Tastaturtasten in einem gemeinsamen Mesh gerendert. Geometriegrenzen, Dreiecksanzahl, Schatten und Raycast-Treffer wurden getestet.
- „Low“ reduziert die Auflösung von Szene und WebGL-Bloom gemeinsam. Ein Resize hebt die gewählte Grafikstufe nicht mehr auf.
- In einer synthetischen Prüfung mit 200 Materialien und 600 Ruheframes sank die Zahl der Material-Invalidierungen von 120.000 auf 0; Szenenknotenbesuche sanken von 126.000 auf 0. Das ist ein Test der Update-Logik, keine gemessene FPS-Steigerung auf dem Rechner des Nutzers.
- Die gemeldeten dauerhaften 4 FPS unter Brave/WebGPU konnten im eingebauten Browser nicht reproduziert werden. Die korrigierte lokale WebGPU-Tour zeigte hier etwa 100 FPS. Unterschiedliche Browser, Grafikkarten, Treiber und Auflösungen lassen sich daraus nicht vergleichen.

## Validierung

Produktionsbuild, ESLint, Diff-Prüfung und sechs Regressionstests erfolgreich. Die Tests prüfen inaktive Frames, Glow-Eintritt und -Austritt, gemeinsam verwendete Materialien, Logo-Materialien, Geometrie-Batching, Raycasts und Grafikqualität einschließlich Resize.

Noch am Zielgerät zu prüfen: neue Version in Brave/WebGPU nach Bereitstellung neu laden und FPS während Fahren und Tour vergleichen. WebGL ist die vorhandene Ausweichoption, falls WebGPU mit der verwendeten GPU weiterhin langsam bleibt. Echte Touch-Gesten, iOS-Browserleisten und Displayausschnitte wurden hier nicht auf physischer Hardware getestet.
