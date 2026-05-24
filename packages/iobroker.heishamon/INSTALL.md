# INSTALL — iobroker.heishamon

Der Adapter ist (noch) nicht im offiziellen ioBroker-Repository. Diese Anleitung beschreibt, wie er manuell in eine lokale ioBroker-Instanz eingespielt wird.

Getestet gegen **ioBroker 7.0.7** auf Linux (systemd-Installation unter `/opt/iobroker`, User `iobroker`).

## Vorbedingungen

- Node.js ≥ 18.18 (kommt mit ioBroker-Installer).
- ioBroker läuft als User `iobroker`. Dieser User muss in der Gruppe `dialout` sein, um auf RS485-USB-Adapter (`/dev/ttyUSB*`) zugreifen zu können.
  ```bash
  groups iobroker          # muss 'dialout' enthalten
  sudo usermod -aG dialout iobroker   # falls nicht
  ```
- RS485-USB-Adapter ist eingesteckt. Persistenten Pfad ermitteln:
  ```bash
  ls -l /dev/serial/by-id/
  ```
  Den `/dev/serial/by-id/...`-Pfad notieren — der bleibt nach Reboot stabil, `/dev/ttyUSB0` wandert.

## Schritt 1 — Pakete bauen

Aus dem Repo-Root (`/home/administrator/develop/projects/IOBrockerHeishaMon`):

```bash
npm install
npm run build
```

Damit werden `packages/heishamon-protocol/dist/` und `packages/iobroker.heishamon/build/` erzeugt.

Optional: Test-Baseline verifizieren:
```bash
npm test 2>&1 | grep -E "Tests +[0-9]+ passed"
```
Erwartung: 3× grün (Stand 2026-05: 330 + 176 + 30 = 536).

## Schritt 2 — Adapter nach ioBroker kopieren

`iobroker.heishamon` referenziert `heishamon-protocol` als Workspace-Paket (`"heishamon-protocol": "*"`). Das funktioniert *nicht* über `iobroker url <tarball>` oder `iobroker add` aus dem Repo, weil npm die Workspace-Referenz dann nicht auflösen kann. Wir installieren daher per Copy:

```bash
# als root oder mit sudo
ADAPTER_DIR=/opt/iobroker/node_modules/iobroker.heishamon
PROTO_DIR=/opt/iobroker/node_modules/heishamon-protocol

sudo -u iobroker mkdir -p "$ADAPTER_DIR" "$PROTO_DIR"

# heishamon-protocol (nur das, was 'files' im package.json erlaubt: dist, src, README)
sudo cp -r packages/heishamon-protocol/{dist,package.json,README.md} "$PROTO_DIR/"

# Adapter
sudo cp -r packages/iobroker.heishamon/{admin,build,io-package.json,package.json,README.md} "$ADAPTER_DIR/"

sudo chown -R iobroker:iobroker "$ADAPTER_DIR" "$PROTO_DIR"
```

Workspace-Referenz auf lokale Auflösung umstellen — `"*"` würde npm sonst in der Registry suchen (404):

```bash
sudo -u iobroker sed -i 's|"heishamon-protocol": "\*"|"heishamon-protocol": "file:../heishamon-protocol"|' "$ADAPTER_DIR/package.json"
```

Anschließend Adapter-Laufzeitabhängigkeiten installieren (`@iobroker/adapter-core`, `serialport`, `heishamon-protocol` per Symlink auf den Geschwisterordner):

```bash
cd "$ADAPTER_DIR"
sudo -u iobroker npm install --omit=dev --no-package-lock
```

## Schritt 3 — Adapter bei ioBroker registrieren

```bash
sudo -u iobroker iobroker upload heishamon
sudo -u iobroker iobroker add heishamon 0
```

`upload` schiebt das Admin-UI (`admin/jsonConfig.json`, i18n) in die ioBroker-Objektdatenbank. `add` erstellt die Instanz `heishamon.0`.

## Schritt 4 — Instanz konfigurieren

Im ioBroker-Admin (`http://<host>:8081`) → **Instanzen** → `heishamon.0` → Einstellungen:

| Feld | Wert |
|---|---|
| Serial Port | `/dev/serial/by-id/usb-Prolific_...` (Pfad aus Schritt 0) |
| Baudrate | `9600` (HeishaMon-Default) |
| Poll-Intervall (s) | `10` für ersten Test, später `60` |
| Read-Only-Modus | **aktiviert** für ersten Test (verhindert Set-Commands an die WP) |

Speichern → der Adapter startet automatisch. Bei `mode: daemon` läuft er kontinuierlich.

## Schritt 5 — Verifizieren

```bash
# Adapter-Logs (folgen)
sudo -u iobroker iobroker logs heishamon --watch

# oder einmalig
sudo tail -n 200 -f /opt/iobroker/log/iobroker.current.log | grep heishamon
```

Erwartetes Bild bei laufendem Simulator oder echter WP:

- `info: Opening serial port /dev/serial/by-id/...`
- `info: Poller started, intervall 10s`
- Nach erstem erfolgreichen Poll: 157 Datenpunkte unter `heishamon.0.*` im Objektbaum.

Object-Tree im Admin prüfen: **Objekte** → `heishamon.0` → erwartete Devices: `main`, `extra`, ggf. `optional`.

## Update auf eine neue Adapter-Version

```bash
# im Repo: neu bauen
npm run build

# nach $ADAPTER_DIR und $PROTO_DIR die geänderten Ordner überschreiben:
sudo cp -r packages/heishamon-protocol/dist "$PROTO_DIR/"
sudo cp -r packages/iobroker.heishamon/build "$ADAPTER_DIR/"
sudo cp -r packages/iobroker.heishamon/admin "$ADAPTER_DIR/"
sudo cp packages/iobroker.heishamon/io-package.json "$ADAPTER_DIR/"
sudo chown -R iobroker:iobroker "$ADAPTER_DIR" "$PROTO_DIR"

# bei Änderungen am UI:
sudo -u iobroker iobroker upload heishamon

# Adapter neustarten
sudo -u iobroker iobroker restart heishamon.0
```

## Deinstallation

```bash
sudo -u iobroker iobroker del heishamon.0
sudo -u iobroker iobroker del heishamon
sudo rm -rf /opt/iobroker/node_modules/iobroker.heishamon /opt/iobroker/node_modules/heishamon-protocol
```

## Bekannte Stolpersteine

- **`EACCES: /dev/ttyUSB0`** — User `iobroker` ist nicht in `dialout`. Siehe Vorbedingungen, danach ioBroker komplett neu starten (`sudo systemctl restart iobroker`), nicht nur die Instanz: Gruppenmitgliedschaft greift erst bei neuer Session.
- **`Cannot find module 'heishamon-protocol'`** — `heishamon-protocol` liegt nicht unter `/opt/iobroker/node_modules/heishamon-protocol/` oder dort fehlt `dist/`. Schritt 2 wiederholen.
- **Adapter startet, aber keine Datenpunkte füllen sich** — Verkabelung/Polarität RS485 prüfen, Baudrate 9600, Pin-Belegung gegen [`docs/protocol/`](../../docs/protocol/) abgleichen. Mit Simulator gegentesten (zweiter USB-RS485 oder `socat` virtuell).
- **Set-Command landet nicht in der WP** — Read-Only-Modus in der Instanz-Konfig ist (zurecht) per Default an. Erst deaktivieren, wenn der Read-Pfad sauber läuft.
