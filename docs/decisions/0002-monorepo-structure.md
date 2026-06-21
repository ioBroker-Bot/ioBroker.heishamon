# ADR-0002: Monorepo-Struktur mit npm-Workspaces

**Status:** Superseded am 2026-05-25 (Commit `c281d4f`)
**Datum:** 2026-05-23

> **Hintergrund der Aufhebung:** Der ioBroker-Repochecker und die offiziellen Aufnahme-Konventionen verlangen ein Standalone-Adapter-Repo mit `io-package.json` im Root und Repo-Name nach dem Schema `ioBroker.<name>`. Der Mono-Repo-Ansatz war für die Phasen 0–3 nützlich (saubere Bibliotheks-Grenzen, getrennte Test-Suites), passte aber nicht zur Release-Pipeline. Bei der Restrukturierung wurden `heishamon-protocol` als `src/protocol/`, `heishamon-sim` als `tools/simulator/` und `iobroker.heishamon` direkt ins Repo-Root gehoben. Tests und Build laufen seitdem aus einer einzigen `package.json`.

## Kontext

Adapter, Protokoll-Bibliothek und Simulator teilen sich Code (vor allem die Bibliothek). Wir müssen entscheiden, wie diese Pakete organisiert werden.

## Entscheidung

Ein Monorepo mit npm-Workspaces. Pakete liegen unter `packages/`:

```
packages/
├── heishamon-protocol/   # Bibliothek
├── heishamon-sim/        # Simulator (depends on protocol)
└── iobroker.heishamon/   # Adapter (depends on protocol)
```

Root-`package.json` definiert die Workspaces, Dependencies werden per Workspace-Link verbunden (`"heishamon-protocol": "workspace:*"`).

## Begründung

- Bibliothek wird von Adapter **und** Simulator genutzt. Polyrepo würde bedeuten, sie zu publishen oder per relativem Pfad zu linken — beides umständlich.
- Tests, Build und Lint können zentral konfiguriert werden.
- Atomare Commits über Paketgrenzen hinweg (eine Protokolländerung berührt alle drei Pakete).

## Alternativen erwogen

- **Polyrepo** — verworfen, zu viel Reibung bei einer kleinen Code-Basis.
- **Lerna / Nx / Turborepo** — overkill für drei Pakete, npm-Workspaces reichen.
- **pnpm-Workspaces** — sinnvolle Alternative, aber zusätzliches Tool nicht nötig.

## Konsequenzen

- Node ≥ 18 (für stabile npm-Workspaces).
- `npm install` an der Root, nicht in den Paketen.
- ioBroker-Adapter-Veröffentlichung später extrahiert ein Sub-Paket (kein Blocker, npm publish funktioniert pro Workspace).
