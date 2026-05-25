# ADR-0003: Simulator vor Adapter-Entwicklung

**Status:** Accepted
**Datum:** 2026-05-23

## Kontext

Die Zielhardware ist eine produktive Heizung. Es gibt keine "Testheizung". Wir brauchen einen Weg, den Adapter zu entwickeln, ohne den Heizbetrieb zu gefährden.

## Entscheidung

Phase 2 (Simulator) kommt **vor** Phase 3 (Adapter) und ist nicht optional. Der Adapter wird vollständig gegen den Simulator entwickelt und validiert, bevor er auch nur einmal die echte WP sieht.

Der Simulator wird gegen ein echtes HeishaMon-Modul validiert (Phase 2 Exit-Kriterium): wenn ein unverändertes HeishaMon eine Stunde lang fehlerfrei mit dem Simulator spricht, gilt der Simulator als protokollkonform.

## Begründung

- Heizungsausfall ist nicht akzeptabel.
- Simulator macht auch Fehler-Injektion möglich (kaputte CRCs, Timeouts) — wichtig für Adapter-Robustheit, am echten Bus quasi unmöglich.
- Simulator hat Wert über die Adapter-Entwicklung hinaus (Regressionstests bei späteren Änderungen).

## Alternativen erwogen

- **Adapter direkt am echten Bus entwickeln** — verworfen, siehe oben.
- **Aufgezeichnete Frames replayen statt aktiv simulieren** — nützlich für Unit-Tests der Bibliothek (Phase 1), aber kein Ersatz für eine Gegenstelle, die auf Set-Commands reagiert.

## Konsequenzen

- Mehr Aufwand vorab (~Phase 2 ist eine eigene Phase).
- Hardware-Bedarf: 2× USB-Serial-Adapter am Dev-PC (RS232 entspricht dem nativen WP-Pegel; RS485 nur bei Bedarf zwischen Adapter und WP).
- Der Simulator wird gepflegt — wenn das Protokoll erweitert wird, muss er mitgezogen werden.
