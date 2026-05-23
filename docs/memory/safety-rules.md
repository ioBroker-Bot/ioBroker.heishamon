# Sicherheits-Regeln für den Umgang mit der produktiven WP

Die Panasonic-Wärmepumpe ist **kein Testobjekt**. Sie heizt ein bewohntes Haus. Ein kalter Tag mit defekter Heizung ist teurer als jede Sparmaßnahme bei den Tests.

## Tabus

- **Keine destruktiven Tests am echten Bus**, bevor Adapter + Simulator validiert sind.
- **Keine Set-Commands an die echte WP**, deren Wirkung nicht vorher am Simulator nachgewiesen wurde.
- **Keine Frame-Experimente** (unbekannte Op-Codes, Fuzzing) am echten Bus. Niemals.
- **Kein Adapter-Code auf dem Heizungs-Pi**, der nicht vollständig gegen den Simulator getestet ist.

## Erlaubt

- Passives Mitlesen auf dem Bus (RX-only Transceiver-Konfiguration).
- Wiedereinsetzen von HeishaMon jederzeit als Rollback-Pfad — HeishaMon-Modul bleibt griffbereit.

## Workflow

Reihenfolge ist nicht verhandelbar:
1. Phase 0 / 1 / 2 / 3 alle am Schreibtisch / mit Simulator
2. Phase 4a am Heizungs-Pi nur read-only und parallel zu HeishaMon
3. Cut-Over erst nach erfolgreicher Phase 4a, mit dokumentiertem Rollback-Plan

## Rollback

- HeishaMon bleibt nach dem Cut-Over physisch verfügbar.
- Rollback-Zeit-Budget: 15 Minuten von "Adapter zickt" bis "HeishaMon liefert wieder MQTT".
