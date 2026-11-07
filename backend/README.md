# Clozera API

Express 5 REST API with Mongoose 9, Better Auth and Effect 4, written in TypeScript and
run directly by Node's type stripping (no build step). See
[doc/architecture.md](../doc/architecture.md) for the design.

## Commands

Run from this directory, or from the repository root with `-w backend`.

| Command                       | Behavior                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                 | Start the API with Node's watcher, loading `.env`                               |
| `npm start`                   | Start the API (production; environment comes from the platform)                 |
| `npm run typecheck`           | Type-check with TypeScript 7                                                    |
| `npm run check`               | Check formatting and type-aware lint with Vite+                                 |
| `npm test`                    | Run unit tests                                                                  |
| `npm run test:integration`    | Run integration tests against the local test database                           |
| `npm run test:all`            | Run both projects                                                               |
| `npm run test:coverage`       | Collect unit-test coverage                                                      |
| `npm run admin:upsert`        | Create or update the admin from `ADMIN_*` variables                             |
| `npm run seed:initials`       | Upsert languages, pairs and official collections from `data/seeds`              |
| `npm run auth:migrate-legacy` | Move passport-local-mongoose credentials to Better Auth (`-- --apply` to write) |

## Layout

```
src/server.ts        process entry: connect, listen, graceful shutdown
src/app.ts           Express app factory (Better Auth at /api/auth, routes at /api)
src/auth             Better Auth config, legacy password support and migration
src/http             Effect ↔ Express adapter, tagged errors, session guards
src/services         Effect programs with typed failures
src/models           Mongoose schemas
src/lib              capabilities, serializers, id helpers
scripts              maintenance commands (admin, seed, auth migration)
```

## API

All routes are under `/api` and use `{ data, meta? }` responses and
`{ error: { code, message, details } }` errors.

| Route                                                                                      | Auth                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `/api/auth/*`                                                                              | Better Auth (sign-up/sign-in/sign-out, sessions) |
| `GET /api/session`                                                                         | Optional; profile or `null`                      |
| `GET /api/languages`, `GET /api/language-pairs`                                            | Public                                           |
| `GET/PATCH /api/users/me`                                                                  | Learner                                          |
| `/api/collections`, `/api/collections/:id`, `/api/collections/:id/sentences[/:sentenceId]` | Learner                                          |
| `/api/dashboard/collections[/:collectionId]`                                               | Learner                                          |
| `/api/admin/*/import`                                                                      | Admin                                            |

## Tests

Tests import from `vite-plus/test` and live next to the code (`*.test.ts`); integration
tests are `*.integration.test.ts`. Integration tests use the real app and Better Auth
against `TEST_MONGODB_CONNECTION_STRING` from `.env.test.local` (copy
`.env.test.example`). Guards require `NODE_ENV=test`, a local `mongodb://` host and a
database named `clozera-test` or `clozera_test` (optionally with a suffix), and re-check
the live connection before clearing collections. `MONGODB_CONNECTION_STRING` is never
used as a fallback.

## Lifecycle

The server connects to MongoDB before listening. `GET /health/ready` reports readiness
without a query or session. `SIGTERM`/`SIGINT` mark the server not ready, drain HTTP
connections and disconnect MongoDB within eight seconds.
