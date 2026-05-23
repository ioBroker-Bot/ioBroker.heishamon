# Projektziel

Ein ioBroker-Adapter, der **direkt per RS485** mit einer Panasonic Aquarea Wärmepumpe spricht — ohne den Umweg über MQTT/HeishaMon-Modul.

## Hardware-Setup

- ioBroker auf Raspberry Pi 4
- RS485-Transceiver an GPIO/UART
- DE-Pin wird vom Kernel-UART-Treiber gemanagt (eigener Treiber existiert bereits)

## Scope

- **In:** Hauptprotokoll (CN-CNT, ~203 Byte Frames) — Telemetrie und Steuerung
- **In:** Optional-PCB-Simulation (SG-Ready, externer Raumthermostat, Smart-Grid)
- **Out:** HeishaMon-Erweiterungen wie 1-Wire / S0 (nicht benötigt)
- **Out:** Web-UI (übernimmt ioBroker-Vis)
- **Out:** WP-Firmware-Updates

## Migrations-Anforderung

Der Adapter soll die **gleichen Datenpunktnamen** wie die HeishaMon-MQTT-Topics anbieten. Migration soll wie ein Bus-Wechsel sein, nicht wie ein Neu-Aufbau aller Skripte und Visualisierungen.

## Warum nicht einfach HeishaMon weiterbetreiben?

- Weniger Hardware in der Kette (kein ESP-Modul, kein MQTT-Broker als Single Point of Failure)
- Tiefer in ioBroker integriert (Adapter-Lifecycle, Konfig-UI, Logs an einem Ort)
- Eigene Kontrolle über das Protokoll-Layer, eigene Erweiterungen möglich

Siehe auch [safety-rules.md](safety-rules.md) für den Umgang mit der produktiven Heizung und [../plan/README.md](../plan/README.md) für den Phasenplan.
