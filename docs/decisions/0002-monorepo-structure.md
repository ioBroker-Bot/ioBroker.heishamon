# ADR-0002: Monorepo-Struktur mit npm-Workspaces

**Status:** Accepted
**Datum:** 2026-05-23

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
