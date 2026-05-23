# Phase 4 — Read-Only-Parallelbetrieb & Cut-Over

## Ziel

Der neue Adapter übernimmt den Bus, ohne dass die Heizung Schaden nimmt oder Service-Lücken entstehen.

## Voraussetzung

Phase 3 abgeschlossen. Adapter ist gegen den Simulator vollständig validiert.

## Phase 4a — Read-Only-Parallelbetrieb (1–2 Tage)

### Setup
- Auf dem Heizungs-Pi: Adapter installieren.
- Adapter **im Read-Only-Modus** starten.
- Variante A (empfohlen): zweiter RS485-Transceiver am Pi, parallel auf den WP-Bus geklemmt — nur RX aktiv. Adapter lauscht passiv, was HeishaMon abfragt und was die WP antwortet.
- HeishaMon läuft weiter und versorgt die Automatisierung wie gewohnt.

### Validierung
- ioBroker-Script vergleicht alle Datenpunkte:
  - HeishaMon-MQTT-Wert (via `mqtt`-Adapter eingelesen) vs. Adapter-Datenpunkt
  - Differenzen werden geloggt
- Erwartung: 0 Abweichungen (gleicher Bus, gleiches Protokoll).
- Lauf über mindestens 24 h, idealerweise über einen kompletten Heiz- + Warmwasser-Zyklus.

### Exit-Kriterium 4a

Über 24 h Parallelbetrieb 0 (oder ausschließlich erklärbare) Differenzen zwischen HeishaMon und Adapter.

## Phase 4b — Cut-Over

### Vorbereitung
- Backup der ioBroker-Konfiguration.
- Liste aller Skripte/Visualisierungen, die HeishaMon-Topics verwenden — Mapping auf Adapter-Datenpunkte vorbereiten (sollte 1:1 sein, daher trivial).

### Cut-Over
1. HeishaMon abklemmen (Strom weg oder vom Bus trennen).
2. Adapter aus Read-Only- in Master-Modus schalten.
3. Adapter pollt jetzt selbst die WP.
4. Skripte/Vis auf neue Datenpunkt-Pfade umstellen (oder Alias-Adapter zwischenschalten, falls Pfade abweichen).

### Validierung
- 24 h Heizungsbetrieb beobachten:
  - Temperaturen plausibel
  - Set-Commands wirken (z.B. Soll-Temp-Änderung über ioBroker → WP reagiert)
  - Keine Fehler in WP-Diagnose

### Rollback-Plan
- HeishaMon-Modul bleibt griffbereit liegen.
- Bei Problemen: Adapter stoppen, HeishaMon wieder anklemmen, Skripte/Vis zurückrollen.
- Rollback-Zeit-Budget: 15 Minuten.

## Exit-Kriterium

24 h Heizungsbetrieb am neuen Adapter ohne Anomalien. HeishaMon kann dauerhaft abgehängt werden.

## Nach der Cut-Over

- Optional: HeishaMon-Modul für späteren Service als Backup behalten.
- Optional: Adapter-Veröffentlichung im ioBroker-Repo vorbereiten — neuer Plan in `docs/plan/phase-5-release.md`, wenn relevant.
