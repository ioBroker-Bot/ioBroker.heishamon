# Phase 2 — Wärmepumpen-Simulator (`heishamon-sim`)

## Ziel

Ein Programm, das sich gegenüber einem **echten HeishaMon-Modul** wie eine Panasonic Aquarea verhält. Der Simulator ist die Sicherheitsnetz-Phase — er macht es möglich, den Adapter zu entwickeln, ohne die produktive Heizung zu riskieren.

## Voraussetzung

Phase 1 abgeschlossen. Die Protokoll-Bibliothek wird vom Simulator wiederverwendet.

## Aufgaben

### 2.1 Paket-Setup
- `packages/heishamon-sim/` als CLI-Tool.
- Abhängigkeiten: `heishamon-protocol` (Workspace-Link), `serialport`.
- Konfiguration über CLI-Flags oder YAML-Datei (Device, Baudrate, Initialwerte).

### 2.2 Zustandsmodell
- Innerer State, der alle Datenpunkte hält, die HeishaMon abfragt.
- Realistische Default-Werte (VL, RL, Außentemp, Modus etc.).
- Werte sind zur Laufzeit veränderbar — Mindestens via:
  - Interaktiver REPL (`set Outside_Temp -2.5`)
  - Optional HTTP-Endpoint (`POST /state`) für Skripte
  - Optional Szenario-Files (`scenarios/winter-day.yaml`)

### 2.3 Frame-Handling
- Eingehende Bytes über `serialport` einlesen, in Frames assemblen.
- Frame-Typ erkennen (Poll, Set, Optional-PCB).
- Antwort-Frame aus aktuellem State bauen und zurücksenden.
- Bei Set-Commands: State aktualisieren, Bestätigungs-Frame schicken (so wie die echte WP).

### 2.4 Fehler-Injektion
Damit der Adapter später robust ist:
- CRC absichtlich kaputt machen
- Antwort verzögern bis zum Timeout
- Antwort komplett ausfallen lassen
- Teilantworten (abgeschnittene Frames)

Konfigurierbar pro Anfrage-Typ und Häufigkeit (`--inject-crc-error=5%`).

### 2.5 Logging
- Alle ein- und ausgehenden Frames als Hex-Dump + dekodierte Werte loggen.
- Trace-Modus mit Zeitstempeln (μs-Auflösung wenn möglich).
- Aufzeichnung in eine `.cap`-Datei für späteres Replay (siehe `.gitignore`).

## Test-Setup

PC mit zwei USB-RS485-Adaptern:
- Adapter A → Simulator
- Adapter B → echtes HeishaMon-Modul
- A/B verkabelt (A↔A, B↔B)
- HeishaMon publiziert MQTT → wir vergleichen mit den vom Simulator gesetzten Werten.

## Deliverable

CLI-Tool, das einen echten HeishaMon zufrieden stellt — HeishaMon glaubt, mit einer echten WP zu sprechen.

## Exit-Kriterium

Ein **unverändertes, echtes HeishaMon-Modul** kommuniziert ≥ 1 Stunde am Stück mit dem Simulator, ohne dass HeishaMon Fehler im Log meldet, und alle Topics zeigen die vom Simulator gesetzten Werte.

## Nicht-Ziele

- Kein Versuch, die Heizung selbst zu simulieren (Thermodynamik, COP-Kurven etc.). Werte sind statisch oder per Hand gesetzt.
