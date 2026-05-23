# ADR-0004: HeishaMon-MQTT-Topic-Namen als kanonische Datenpunktnamen

**Status:** Accepted
**Datum:** 2026-05-23

## Kontext

Der Adapter soll bestehende HeishaMon-Nutzer-Setups möglichst nahtlos übernehmen können. ioBroker-Skripte und VIS-Widgets sind oft an die HeishaMon-MQTT-Topics gebunden.

## Entscheidung

Datenpunktnamen im Adapter-Objekttree sind **bytegleich** zu den Suffixen der HeishaMon-MQTT-Topics:

```
HeishaMon-MQTT:    panasonic_heat_pump/main/Heatpump_State
ioBroker-Adapter:  heishamon.0.main.Heatpump_State
```

Gleiches gilt für die Optional-PCB-Topics. Auch die Schlüssel in `heishamon-protocol`'s `datapoints.ts` verwenden diese Namen.

## Begründung

- Migrationskosten sinken drastisch — bestehende Skripte greifen über einen Such-/Ersetz-Vorgang auf den neuen Adapter zu.
- Vermeidet "wir sind besser"-Renaming-Drift, das in jeder Diskussion neu aufflammen würde.
- HeishaMon ist der etablierte Standard in der Aquarea-DIY-Community, Konsistenz lohnt sich.

## Alternativen erwogen

- **Eigene, "saubere" Naming-Convention** (camelCase, deutsche Namen, etc.) — verworfen, weil der Migrationsschmerz höher ist als der Stil-Gewinn.
- **Alias-Tabelle** (intern eigene Namen, Mapping nach außen) — zusätzliche Komplexität ohne Nutzen.

## Konsequenzen

- Wenn HeishaMon ein Topic umbenennt, müssen wir nachziehen und ggf. eine Alias-Migration einbauen.
- Stil-Inkonsistenzen (manche HeishaMon-Topics sind PascalCase, manche snake_case) übernehmen wir.
