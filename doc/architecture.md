# Architecture

This document describes how Clozera's TypeScript stack fits together and records the
decisions made when the project moved from JavaScript, React Router and Passport to
TanStack Start, Better Auth and Effect.

Decisions with lasting trade-offs are recorded as ADRs in [../docs/adr](../docs/adr); domain terms are defined in [../CONTEXT.md](../CONTEXT.md).

## Workspaces

The repository is an npm workspace with one lockfile.

| Workspace | Purpose |
| --- | --- |
| `packages/shared` | Response DTO types, Zod request schemas and sentence helpers. Both apps import it, so an API contract change fails type checking on both sides. |
| `packages/emails` | React Email templates. Built to `dist/` because Node cannot run TSX; the API's dev and maintenance scripts build it first. |
| `backend` | Express 5 REST API, Mongoose models, Better Auth and maintenance scripts. |
| `frontend` | TanStack Start web app with SSR and a same-origin `/api` proxy. |
| `tooling` | Oxlint and Oxfmt settings shared by every `vite.config.ts`. |

All workspaces use TypeScript 7 with `erasableSyntaxOnly`. The API runs its `.ts`
sources directly with Node's built-in type stripping, so it has no build step;
`npm run typecheck` runs `tsc` in every workspace. Vite+ provides Vitest, Oxlint
(type-aware) and Oxfmt.

## Request flow

```
Browser ──/api/*──▶ Web server (TanStack Start) ──▶ API (Express) ──▶ MongoDB
   │                    │
   └── SSR pages ◀──────┘ server-side fetches go straight to API_INTERNAL_URL
```

The browser only talks to the web origin. `frontend/src/routes/api/$.ts` forwards
`/api/*` to the API. This keeps the Better Auth cookie first-party (no
`SameSite=None` third-party cookie) and lets server rendering read the same session.
During SSR, `src/lib/api.ts` calls the API directly and forwards the visitor's cookie.

## Backend

- **Routes** (`src/routes`) parse input with the shared Zod schemas and call services.
- **Services** (`src/services`) are Effect programs. Expected failures are tagged errors
  (`NotFound`, `Forbidden`, `ValidationFailed`, `Conflict`, `Unauthenticated`,
  `DatabaseError`) in the Effect error channel instead of thrown objects with ad hoc
  `status` fields. `src/http/handler.ts` maps them to the JSON error envelope
  `{ error: { code, message, details } }`; anything unexpected becomes a 500.
- **Database access** goes through `db()` in `src/http/db.ts`, which turns duplicate keys
  into `409 Conflict`, Mongoose validation errors into `400`, and everything else into
  `DatabaseError`.
- **Serializers** (`src/lib/serializers.ts`) produce the DTOs declared in `@clozera/shared`.

Search input is escaped before it reaches a MongoDB regular expression, malformed ids
return 404 instead of a cast error, and slug generation uses one query.

### Authentication

Better Auth is mounted at `/api/auth/*` with email/password and the `username` plugin.
Users live in the existing Mongoose `users` collection, so ObjectId references from
collections and sentences keep working. Better Auth writes identity fields; Mongoose owns
learning fields (`selectedLanguagePair`, `languagePairs`, `pinnedCollections`). `role` and
`timezone` are Better Auth additional fields; `role` cannot be set by sign-up.

Better Auth's own data uses `auth_sessions`, `auth_accounts` and `auth_verifications`.
The previous `sessions` collection (connect-mongo) is unused and can be dropped.

`GET /api/session` returns the learner profile or `null` and never answers 401; the web
app uses it for SSR and route guards. Protected routes use `requireUser`/`requireAdmin`.

### Email verification and account emails

Email/password accounts must verify their address before they can sign in. Better Auth
sends three emails, rendered from `packages/emails`:

| Email | Trigger | Link | Lands on |
| --- | --- | --- | --- |
| Verify email | Sign-up, or signing in while unverified | 24 hours, signs the learner in | `/email-verified` |
| Reset password | `/forgot-password` | 1 hour, single use; ends other sessions | `/reset-password?token=` |
| Approve email change | `/settings` → change email (sent to the current address) | 24 hours; then a verify email goes to the new address | `/email-changed` |

Links point at `/api/auth/*` on the web origin, so they pass through the same proxy as
the app. Emails are sent after the response (`src/email/mailer.ts`): auth endpoints stay
fast and response time does not reveal whether an address has an account. Password reset
answers identically for unknown addresses. Rate limits apply to sign-in, sign-up and the
email endpoints in production; they are kept in memory per instance.

There is no session cookie cache, so a password reset or sign-out elsewhere ends sessions
immediately.

The transport is chosen by `EMAIL_TRANSPORT`: `resend` (required in production), `smtp`
(Mailpit locally) or `console`. Tests always use an in-memory outbox and never send mail.

### Legacy accounts

passport-local-mongoose stored PBKDF2-SHA256 hashes with 25,000 iterations on the user
document, far below current guidance. They are deleted rather than migrated.
`npm run auth:migrate-legacy` lowercases emails, marks the accounts as verified and
removes the old hash fields; `--notify` sends each learner a password reset link. The
reset flow creates their Better Auth credential. Users whose lowercased email collides
with another account are skipped and reported.

## Frontend

| Concern | Owner |
| --- | --- |
| Routing, SSR, `/api` proxy | TanStack Start + Router (file routes in `src/routes`) |
| Session, languages, single collection | TanStack Query (`src/data/session.ts`, `languages.ts`) |
| Library and sentences | TanStack DB query collections (`src/data/collections.ts`) |
| Forms | TanStack Form with shared Zod schemas (`src/components/form.tsx`) |
| Sentence list | TanStack Table v9 with global filter and pagination |
| Practice material chart | TanStack Charts (`src/components/library-chart.tsx`) |
| Notes and descriptions | TanStack Markdown, raw HTML disabled |
| Keyboard shortcuts | TanStack Hotkeys (`src/hooks/use-choice-hotkeys.ts`) |
| Device preferences | Zustand with `persist` (`src/stores/preferences.ts`) |
| Navigation state | URL search params (`/dashboard?tab=&q=`, `/practice?mode=&limit=`) |

Public pages (home, login, sign-up) render on the server. The signed-in area under
`src/routes/_app` sets `ssr: false`: TanStack DB collections are client-side only, and
module-level collections must never be shared between server requests. Loaders preload
the collections before a page renders.

The library collection holds every collection the learner can see in a language pair.
The dashboard, shelves and pinned list are live queries over it, so pinning, editing and
deleting update every view at once. Pin, edit and delete are optimistic and roll back
on failure; creation waits for the server-assigned id. Signing out cleans up every
collection and clears the Query cache.

UI primitives in `src/components/ui` come from the shadcn CLI with the Base UI `base-vega`
style. `@shadcn/lint` runs inside Oxlint and rejects raw palette colors, unknown classes
and dynamic class strings; arbitrary values are warnings.

## Deployment

| Service | Image | Required environment |
| --- | --- | --- |
| API | `backend/Dockerfile.production` | `MONGODB_CONNECTION_STRING`, `BETTER_AUTH_SECRET` (32+ random characters), `FRONTEND_URL` (public web origin, also used for links and images in emails), `RESEND_API_KEY` (from Secret Manager), `EMAIL_FROM`, `EMAIL_REPLY_TO`. Optional: `BETTER_AUTH_URL`, `MONGODB_TRANSACTIONS=true` on Atlas. |
| Web | `frontend/Dockerfile.production` | `API_INTERNAL_URL` (API base URL reachable from the web server), `PORT` (set by Cloud Run). |

Build both images from the repository root, for example
`docker build -f frontend/Dockerfile.production .`. The web image is a Node server
(`srvx`) rather than nginx, because it renders pages and proxies `/api`.

`SESSION_SECRET` is still accepted as a fallback for `BETTER_AUTH_SECRET` while
environments are migrated. `VITE_API_BASE_URL` is no longer used.

Upgrade order for an existing environment:

1. Deploy the API with `BETTER_AUTH_SECRET` and the web app with `API_INTERNAL_URL`.
2. Run `npm run auth:migrate-legacy -w backend` against the database, review the dry run,
   then run it again with `-- --apply --notify`.
3. Optionally drop the unused `sessions` collection.
