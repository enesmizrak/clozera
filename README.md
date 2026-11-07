# Clozera

Open-source language learning app built around cloze-based practice.

## Stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript 7 everywhere, Zod 4 schemas shared by API and UI |
| Web app | TanStack Start (SSR) + Router, Query, DB, Form, Table, Charts, Markdown; React 19 |
| UI | shadcn/ui on Base UI, Tailwind CSS v4, `@shadcn/lint` design-system rules |
| Client state | TanStack DB/Query for server data, URL search params for navigation, Zustand for device preferences |
| API | Express 5, Mongoose 9, Better Auth, Effect 4 for typed service errors |
| Tooling | npm workspaces, Vite+ (build, Vitest, Oxlint, Oxfmt), Node 24 type stripping |

See [doc/architecture.md](doc/architecture.md) for how the pieces fit together and why.

## Repository layout

```
packages/shared   @clozera/shared: API contracts, Zod schemas, sentence helpers
backend           @clozera/backend: REST API under /api, Better Auth under /api/auth
frontend          @clozera/frontend: TanStack Start app; proxies /api to the backend
tooling           Lint and format settings shared by every workspace
```

## Development

Use Node.js 24.15 or newer (see `.node-version` files) and npm. Install once from the root:

```sh
npm ci
cp backend/.env.example backend/.env
```

Start MongoDB, then the API and the web app in two terminals:

```sh
docker compose up -d mongodb
npm run dev:api
npm run dev:web
```

Open http://localhost:5173. The web app proxies `/api` to the API on port 3000, so the
auth cookie is first-party and also available during server rendering.

Seed local content with an admin account (see `backend/.env.example`):

```sh
npm run admin:upsert -w backend
npm run seed:initials -w backend
```

## Validation

```sh
npm run typecheck
npm run check
npm test
npm run test:integration
npm run build
```

`npm run test:integration` needs the local MongoDB and `backend/.env.test.local`
(copy `backend/.env.test.example`).

## Docker

`docker compose up --build` runs MongoDB, the API and the web app. Images build from the
repository root because both applications use the shared workspace. See
[doc/docker-usage.md](doc/docker-usage.md).

Local Docker tracks the latest MongoDB 8.0 patch with `mongo:8.0`, matching the
Atlas release series. Before changing the MongoDB release series or data volume,
stop application writes, take a consistent backup and validate a restored copy.
Use `docker compose stop` for ordinary shutdowns; `docker compose down -v` deletes
the database volume.

## Upgrading existing installations

Accounts created before Better Auth keep their passwords. Run the credential
migration once per database; it is a dry run unless `--apply` is passed:

```sh
npm run auth:migrate-legacy -w backend
npm run auth:migrate-legacy -w backend -- --apply
```

Existing sessions end with this upgrade, so everyone signs in again once.
Production needs `BETTER_AUTH_SECRET`; see [doc/architecture.md](doc/architecture.md#deployment).
