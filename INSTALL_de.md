# INSTALL — iobroker.heishamon

Schritt-für-Schritt-Anleitung für die Installation auf einer ioBroker-Instanz, mit Fokus auf die Linux-Defaults (`/opt/iobroker`, User `iobroker`). Für die Verdrahtung der Wärmepumpe siehe [README.md](README.md#wiring).

Eine englische Fassung dieser Anleitung steht in [INSTALL.md](INSTALL.md).

## Voraussetzungen

- ioBroker ≥ 7.0, Node.js ≥ 22.
- User `iobroker` ist in der Gruppe `dialout`, damit er auf serielle Geräte zugreifen kann:
  ```bash
  groups iobroker                     # muss 'dialout' enthalten
  sudo usermod -aG dialout iobroker   # falls nicht — anschließend ioBroker neu starten
  ```
- Serial-Device ist eingesteckt und reproduzierbar erreichbar. Stabilen `/dev/serial/by-id/...`-Pfad notieren:
  ```bash
  ls -l /dev/serial/by-id/
  ```
  Bei Pi-GPIO-UART ist der Pfad statisch (z. B. `/dev/ttyAMA2`).

## Installation

Installation aus dem offiziellen ioBroker-Repository über die Admin-UI: **Adapter → `heishamon` suchen → installieren**.

Anschließend eine Instanz anlegen: **Instanzen → `heishamon` hinzufügen**.

## Konfiguration

In der Admin-UI → Instanzen → `heishamon.0` → Einstellungen:

| Feld | Empfehlung beim ersten Start |
|---|---|
| Serial port | `/dev/serial/by-id/...` (stabilen Pfad nutzen, nicht `/dev/ttyUSB0`) |
| Baud rate | `9600` (Panasonic CN-CNT-Default — nicht ändern) |
| Poll interval | `5` Sekunden |
| Read-only mode | **aktivieren** — verhindert jeden Set-Command, sicherer Erststart |
| Extra poll | `true` (harmlos bei älteren WPs) |

Speichern → Adapter startet automatisch.

## Verifikation

Das Adapter-Log in der Admin-UI öffnen (**Log**-Tab, nach `heishamon` filtern).

Erwartetes Bild bei laufender WP:
- `info: wire queue: minSendGapMs=…, capacity=100`
- `info: opened /dev/serial/by-id/… @ 9600 8E1`
- Nach wenigen Sekunden: 157 Datenpunkte unter `heishamon.0.main.*` und `heishamon.0.extra.*`.
- `heishamon.0.info.connection = true`, `info.connectionQuality` läuft Richtung 100.

Object-Tree in der Admin-UI prüfen: **Objekte → heishamon.0** → Channels `main`, `extra`, ggf. `optional`, plus `info`.

## Update auf eine neue Version

Update über die Admin-UI: **Adapter → `heishamon` → aktualisieren**. Die Instanz startet automatisch neu.

## Deinstallation

Instanz und Adapter über die Admin-UI entfernen: **Instanzen → `heishamon.0` löschen**, dann **Adapter → `heishamon` löschen**.

## Bekannte Stolpersteine

- **`EACCES: /dev/ttyUSB0`** — User `iobroker` ist nicht in `dialout`. Nach `usermod -aG dialout iobroker` den ganzen ioBroker-Dienst neu starten (`sudo systemctl restart iobroker`), nicht nur die Instanz — Gruppenmitgliedschaft greift erst bei neuer Session.
- **Adapter startet, keine Datenpunkte füllen sich** — Verdrahtung am CN-CNT-Port prüfen (TX↔RX kreuzen, GND verbinden, 5-V-TTL-Pegel beachten, siehe [README.md → Wiring](README.md#wiring)). Bei einem TTL↔RS485-Konverter zusätzlich A/B-Polarität und Abschlusswiderstände prüfen.
- **Set-Commands wirken nicht** — Read-only mode in der Instanz-Konfig ist beim Erststart absichtlich aktiv. Erst deaktivieren, wenn der Read-Pfad sauber läuft.
- **Bei Verbindung über CZ-TAW1-Bus** — Adapter zwingend im **Read-only mode** lassen, sonst entstehen Bus-Kollisionen mit dem Panasonic-Cloud-Modul.
