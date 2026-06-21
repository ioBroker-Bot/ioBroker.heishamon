# Phase 3 — ioBroker-Adapter (`iobroker.heishamon`)

> **ARCHIV.** Phase 3 ist abgeschlossen. Der Adapter ist auf [npm](https://www.npmjs.com/package/iobroker.heishamon) publiziert und läuft live an einer echten Aquarea-WP. Mit dem Mono-Repo-Revert am 2026-05-25 (Commit `c281d4f`) ist `packages/iobroker.heishamon/` im Repo-Root aufgegangen. Pfade weiter unten zeigen noch auf die historische Mono-Repo-Struktur.

## Ziel

Ein installierbarer ioBroker-Adapter, der direkt mit der WP spricht und dieselben Datenpunkte wie HeishaMon anbietet.

## Voraussetzung

Phase 1 + 2 abgeschlossen. Der Adapter wird **ausschließlich gegen den Simulator** entwickelt und validiert. Erst Phase 4 bringt ihn in Kontakt mit der echten Heizung.

## Aufgaben

### 3.1 Adapter-Skeleton
- Mit `@iobroker/create-adapter` (TypeScript-Variante) erzeugen.
- Paket-Slot: `packages/iobroker.heishamon/`.
- Abhängigkeit auf `heishamon-protocol` (Workspace-Link), `serialport`.

### 3.2 Objekttree
- Pfadstruktur spiegelt **exakt** die HeishaMon-MQTT-Topics:
  - `heishamon.0.main.<Datapoint>` (z.B. `Heatpump_State`, `Outside_Temp`, `Z1_Heat_Request_Temp`)
  - `heishamon.0.optional.<Datapoint>` (Optional-PCB)
- Rollen / Typen sauber gesetzt (`level.temperature`, `value.temperature`, `switch`, `state`).
- Schreibbare Datenpunkte sind `common.write: true`, alle anderen read-only.

### 3.3 Lebenszyklus
- `onReady`: Serial-Port öffnen, Polling-Loop starten.
- `onStateChange`: bei beschreibbaren States Set-Command an WP senden.
- `onUnload`: Port schließen, Timer stoppen.
- Reconnect-Logik bei Port-Fehlern.

### 3.4 Polling
- Konfigurierbares Intervall (Standard z.B. alle 10 s, wie HeishaMon).
- Optional-PCB-Antworten in eigenem (oder kein) Intervall, je nach Anforderung der WP.
- Backoff bei Fehlern, kein hartes Hammern auf den Bus.

### 3.5 Konfig-UI
- `admin/jsonConfig.json` mit Feldern:
  - Serial-Device (`/dev/ttyAMA0`, `/dev/serial0`, …)
  - Baudrate (Standard 9600)
  - Poll-Intervall
  - Optional-PCB-Modus ein/aus
  - Read-Only-Modus (für Parallelbetrieb in Phase 4)

### 3.6 Read-Only-Modus
Wichtig für Phase 4: Adapter pollt **nicht** selbst, sondern lauscht nur passiv auf dem Bus mit, was HeishaMon abfragt und welche Antworten kommen. Schreibt die dekodierten Werte in den Objekttree, sendet aber **nichts**.

## Deliverable

Installierbarer Adapter, der gegen den Simulator vollständig funktioniert (Read + Write + Optional-PCB).

## Exit-Kriterium

Mit Simulator als Gegenstelle:
- Alle in Phase 0 erfassten Datenpunkte sind korrekt befüllt.
- Set-Command von ioBroker (z.B. Soll-Temp ändern) verändert den Simulator-Zustand, der neue Wert kommt zurück.
- Read-Only-Modus liest passiv mit, wenn HeishaMon zwischengeschaltet ist.

## Nicht-Ziele

- Keine Veröffentlichung im offiziellen ioBroker-Repo in dieser Phase.
- Kein Web-Interface (das macht ioBroker-Vis).
- Kein Firmware-Update der WP.
