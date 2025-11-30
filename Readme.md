# PBX Remote Management & Monitoring (3CX)

A remotely hosted watcher for 3CX phone systems inspired by pbxmonitor.net. It polls each tenant through the 3CX API, caches normalized health snapshots, forwards maintenance actions, and now ships with a lightweight React dashboard for operators.

## Prerequisites

- Node.js 18+
- 3CX tenants with HTTPS API access and API keys

## Backend setup

1. Copy `.env.example` to `.env` and adjust the port, poll interval, and tenant config path.
2. Copy `config/tenants.example.json` to `config/tenants.json` and list each PBX (id, URL, API key, timezone, feature flags).
3. Install dependencies:

```bash
npm install
```

4. Start the API (auto polls tenants and exposes `/api` plus `/healthz`):

```bash
npm run dev
```

## Frontend (lightweight UI)

The React dashboard lives under `frontend/` (Vite + TypeScript).

- Development server with hot reload and proxy back to the API:

```bash
npm run dev:ui
```

- Production build:

```bash
npm run build:ui
```

Run `npm run build:all` to compile both the Node service (`dist/`) and the React bundle (`frontend/dist`). When the backend starts, it automatically serves the latest frontend build if it exists.

## API surface

- `GET /healthz` – process heartbeat summary
- `GET /api/tenants` – configured tenants (API keys omitted)
- `GET /api/tenants/:tenantId/snapshot` – most recent cached snapshot
- `POST /api/tenants/:tenantId/snapshot/refresh` – pull a fresh snapshot on demand
- `POST /api/tenants/:tenantId/actions` – forward maintenance requests (restart, reboot, backup, etc.)

## Frontend highlights

- Tenant selector with live refresh controls
- Health summary cards (version, uptime, CPU/memory/disk gauges)
- Service / trunk status pills and recommendation feed
- Tables for active calls, queue load, and extension reachability
- Maintenance action form that forwards safe commands with optional notes

> Tip: Keep the API server and `npm run dev:ui` running simultaneously during development. In production simply ship the compiled backend + `frontend/dist` folder.
