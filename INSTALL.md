# INSTALL — iobroker.heishamon

Schritt-für-Schritt-Anleitung für die Installation auf einer ioBroker-Instanz, mit Fokus auf die Linux-Defaults (`/opt/iobroker`, User `iobroker`). Für die Verdrahtung der Wärmepumpe siehe [README.md](README.md#wiring).

## Voraussetzungen

- ioBroker ≥ 7.0, Node.js ≥ 22.
- User `iobroker` ist in der Gruppe `dialout`, damit er auf serielle Geräte zugreifen kann:
  ```bash
  groups iobroker          # muss 'dialout' enthalten
  sudo usermod -aG dialout iobroker  # falls nicht — anschließend ioBroker neu starten
  ```
- Serial-Device ist eingesteckt und reproduzierbar erreichbar. Stabilen `/dev/serial/by-id/...`-Pfad notieren:
  ```bash
  ls -l /dev/serial/by-id/
  ```
  Bei Pi-GPIO-UART ist der Pfad statisch (z.B. `/dev/ttyAMA2`).

## Installation

Sobald der Adapter im offiziellen ioBroker-Repository ist, geht der Standard-Weg über die Admin-UI: **Adapter → heishamon suchen → installieren**.

Bis dahin (oder für Pre-Releases) direkt aus npm:

```bash
sudo -u iobroker iobroker url iobroker.heishamon
```

Dann im Admin-UI: **Instanzen → +heishamon** anlegen.

## Konfiguration

Im Admin-UI → Instanzen → `heishamon.0` → Einstellungen:

| Feld | Empfehlung beim ersten Start |
|---|---|
| Serial port | `/dev/serial/by-id/...` (stabilen Pfad nutzen, nicht `/dev/ttyUSB0`) |
| Baud rate | `9600` (Panasonic CN-CNT-Default — nicht ändern) |
| Poll interval | `5` Sekunden |
| Read-only mode | **aktivieren** — verhindert jeden Set-Command, sicherer Erststart |
| Extra poll | `true` (harmlos bei älteren WPs) |

Speichern → Adapter startet automatisch.

## Verifikation

```bash
sudo -u iobroker iobroker logs heishamon --watch
```

Erwartetes Bild bei laufender WP:
- `info: wire queue: minSendGapMs=…, capacity=100`
- `info: opened /dev/serial/by-id/… @ 9600 8E1`
- Nach wenigen Sekunden: 157 Datenpunkte unter `heishamon.0.main.*` und `heishamon.0.extra.*`.
- `heishamon.0.info.connection = true`, `info.connectionQuality` läuft Richtung 100.

Object-Tree im Admin prüfen: **Objekte → heishamon.0** → Devices `main`, `extra`, ggf. `optional`, plus `info`.

## Update auf eine neue Version

```bash
sudo -u iobroker iobroker upgrade heishamon
sudo -u iobroker iobroker restart heishamon.0
```

Falls der Adapter noch nicht im offiziellen Repository ist, geht das gezielt per npm:

```bash
sudo -u iobroker iobroker stop heishamon.0
sudo -u iobroker npm install --prefix /opt/iobroker iobroker.heishamon@<version>
sudo -u iobroker iobroker start heishamon.0
```

## Deinstallation

```bash
sudo -u iobroker iobroker del heishamon.0
sudo -u iobroker iobroker del heishamon
```

## Bekannte Stolpersteine

- **`EACCES: /dev/ttyUSB0`** — User `iobroker` ist nicht in `dialout`. Nach `usermod -aG dialout iobroker` den ganzen ioBroker-Dienst neu starten (`sudo systemctl restart iobroker`), nicht nur die Instanz — Gruppenmitgliedschaft greift erst bei neuer Session.
- **Adapter startet, keine Datenpunkte füllen sich** — Verdrahtung am CN-CNT-Port prüfen (TX↔RX kreuzen, GND verbinden, 5V-TTL-Pegel beachten, siehe [README.md → Wiring](README.md#wiring)). Bei einem TTL↔RS485-Konverter zusätzlich A/B-Polarität und Abschlusswiderstände prüfen.
- **Set-Commands wirken nicht** — Read-only mode in der Instanz-Konfig ist beim Erststart absichtlich aktiv. Erst deaktivieren, wenn der Read-Pfad sauber läuft.
- **Bei Verbindung über CZ-TAW1-Bus** — Adapter zwingend im **Read-only mode** lassen, sonst entstehen Bus-Kollisionen mit dem Panasonic-Cloud-Modul.
