# Admin Editing for Official Collections

Status: Proposed design. Related: [ADR 0003](../adr/0003-separate-official-content-authorization-from-learner-ownership.md), [ADR 0005](../adr/0005-admin-workflows-for-official-content.md).

This document uses the terms in [CONTEXT.md](../../CONTEXT.md): Official Collection, Official Content Authorization, Admin, Collection Group.

## Current state

- `backend/src/routes/admin.ts` mounts `requireAdmin(auth)` on `/admin` and has four import routes: `POST /admin/languages/import`, `/admin/language-pairs/import`, `/admin/collections/import`, and `/admin/collections/:id/sentences/import`.
- The imports in `backend/src/services/admin-service.ts` upsert: languages by code or iso3, language pairs by slug, groups by `(languagePair, type)`, and collections by `(languagePair, slug)`. Sentence import is append-only.
- `requireAdmin` in `backend/src/http/session.ts` reloads the user and checks `role === 'admin'` on every request.
- `findOwnedCollection` in `backend/src/services/collections-service.ts` only matches `owner: viewer._id, isOfficial: false`, so learner routes cannot edit official collections. That is correct and stays.
- The frontend has no admin routes. `frontend/src/routes/_app.tsx` runs with `ssr: false` and returns `user` from `beforeLoad`; `UserDto` has `role` (`packages/shared/src/contracts.ts`).

There is no way to edit or delete one official collection or sentence except by re-running an import or touching the database directly.

### Endpoints

All routes sit under the existing `router.use('/admin', requireAdmin(auth))`, so every route below has the same guard: a signed-in session (else 401 `UNAUTHENTICATED`) with `role === 'admin'` (else 403 `FORBIDDEN`). Error codes come from `backend/src/http/errors.ts`: `NOT_FOUND`, `FORBIDDEN`, `UNAUTHENTICATED`, `CONFLICT` (409), `VALIDATION_ERROR` (400), `INTERNAL_SERVER_ERROR`. An invalid ObjectId is reported as 404 through `collectionNotFound`, as learner routes already do. Success replies use `ok` (200), `created` (201) and `noContent` (204) from `backend/src/http/handler.ts`.

| Method and path | Input | Success | Errors |
| --- | --- | --- | --- |
| `PATCH /api/admin/collections/:id` | `adminCollectionUpdateSchema` | 200, collection DTO | 400, 401, 403, 404, 409 |
| `DELETE /api/admin/collections/:id` | none | 204 | 401, 403, 404 |
| `POST /api/admin/collections/:id/sentences` | `sentenceSchema` | 201, sentence DTO | 400, 401, 403, 404 |
| `PATCH /api/admin/collections/:id/sentences/:sentenceId` | `sentenceSchema` | 200, sentence DTO | 400, 401, 403, 404 |
| `DELETE /api/admin/collections/:id/sentences/:sentenceId` | none | 204 | 401, 403, 404 |
| `POST /api/admin/language-pairs/:slug/groups` | `adminGroupSchema` | 201, group | 400, 401, 403, 404 `LANGUAGE_PAIR_NOT_FOUND` |
| `PATCH /api/admin/groups/:id` | `adminGroupSchema.partial()` | 200, group | 400, 401, 403, 404 |
| `DELETE /api/admin/groups/:id` | none | 204 | 401, 403, 404, 409 if collections still reference it |

Group routes are optional for a first version: groups can still be maintained through the collections import, which upserts them. Collection creation is also already covered by `POST /admin/collections/import`, so a single-collection create endpoint is not proposed.

The schemas below are sketches in the style of `packages/shared/src/schemas.ts`. `sentenceSchema` already exists there and already requires exactly one cloze marker, so the admin sentence routes reuse it unchanged. The admin collection schema would go in `packages/shared` only if the admin UI shares it; otherwise it can live in `admin-service.ts` next to the import schemas.

```ts
export const adminCollectionUpdateSchema = z
  .object({
    name: requiredText('Collection name', 120),
    description: optionalText(1000),
    level: optionalText(40),
    type: z.enum(COLLECTION_TYPES),
    isPublic: z.boolean(),
    groupId: objectIdSchema.nullable(), // must belong to the collection's language pair
    order: z.number().int(),
  })
  .partial()

export const adminGroupSchema = z.object({
  name: requiredText('Group name', 120),
  type: requiredText('Group type', 60),
  description: optionalText(1000),
  order: z.number().int().default(0),
})
```

Decisions worth stating:

- Slug and language pair are not editable. The slug is part of the import upsert key `(languagePair, slug)`; changing it silently would make the next import create a duplicate. A rename can be a separate, explicit operation later.
- `isOfficial` is not editable through these routes. Turning an official collection into a learner collection, or the reverse, is a different decision than editing content.
- A 409 from the unique `(languagePair, slug)` index is already mapped by `backend/src/http/db.ts`, which names the last key of a compound duplicate key in the message.

### Service reuse

Put the new functions in `admin-service.ts` (or a new `admin-content-service.ts` if that file gets long) and reuse what already exists:

- Sentence normalization: `normalizeSentencePayload` from `@clozera/shared`, already used by `importCollectionSentences`. The `CollectionSentence` model also re-derives `cloze` from `text` in its `pre('validate')` hook, so the admin write path cannot leave them out of sync.
- `nextSentenceOrder` and `refreshSentenceCount`, both exported from `collections-service.ts`. Admin sentence create calls `nextSentenceOrder` then `refreshSentenceCount`; delete calls `refreshSentenceCount`, as `deleteSentence` does.
- `deleteCollection` ordering: delete the collection document first, then its sentences, then pull its id from `User.pinnedCollections`. A failure part-way leaves unreachable leftovers, not a half-visible collection. The admin delete should follow the same order. Today those three steps are inlined in `deleteCollection` behind `findOwnedCollection`; extract them into a shared function (for example `removeCollection(collection)`) that both services call. That is the only change to learner code, and it does not touch the guard.
- Serialization: `serializeCollection` and `serializeSentence` from `backend/src/lib/serializers.ts`, plus the `POPULATED_PATHS` list in `collections-service.ts`, so admin responses have the same shape as learner ones.
- The upserting imports stay as the bulk path. They are for seeding and large changes; the new routes are for single edits. Both write the same documents, so a later import can overwrite an admin edit made to the same slug. Admins should know this (see open questions).

Keep the guards separate. Do not add an `isAdmin` branch to `findOwnedCollection`. Add a sibling that does the opposite check:

```ts
// Loads an official collection by id. 404 if it is missing or not official.
function findOfficialCollection(id: unknown): Effect.Effect<CollectionDocument, AppError>
```

It matches `{ _id, isOfficial: true }`. A learner collection id returns 404 through admin routes: the admin API does not manage that content, and 404 avoids confirming that it exists. (The learner guard returns 403 for an existing collection the viewer does not own, so the maintainer may prefer 403 for consistency.) Admin sentence routes use `findOfficialCollection` too, and look up sentences by `{ _id, collection: collection._id }`, as `updateSentence` does.

`sentence.owner` for official sentences is currently whichever admin imported them (`importCollectionSentences` sets `owner: owner._id`). ADR 0003 says that owner is not authorization, so admin routes must not read `owner` for access decisions.

### Audit trail

Options for recording who changed what:

1. None. Rely on MongoDB backups (ADR 0004: daily, 7 local and 30 in R2) to recover from a bad edit. Cheapest, but it does not say who did it, and restoring a whole backup to undo one edit is heavy.
2. Stamp the last editor on the document: an `updatedBy` field on `Collection` and `CollectionSentence`, next to the existing `timestamps`. Answers "who touched this last" with one field, but keeps no history.
3. A separate `AdminAuditLog` collection: `{ actor, action, targetType, targetId, before, after, at }`, written by the admin service after each successful write. Gives history and an undo path, at the cost of a model, storage growth and an extra write per edit.
4. Structured application logs only (actor id, route, target id). No new storage and enough to investigate incidents, but not queryable from the product and lost with log retention.

Transactions are off by default (ADR 0004), so option 3 cannot be atomic with the edit. Write the log entry after the change succeeds and accept that a crash between the two loses one entry, or write it first and accept a spurious entry.

### UI sketch

Minimal pages under `frontend/src/routes/_app/admin/`, kept small because there are few admins:

- `admin/route.tsx`: a layout whose `beforeLoad` reads `user` from the parent route context and redirects to the dashboard unless `user.role === 'admin'`. This is a convenience only; the API returns 403 regardless.
- `admin/collections/index.tsx`: a table of official collections for the active language pair (name, type, level, sentence count, public flag), each linking to its page.
- `admin/collections/$collectionId.tsx`: a collection form (name, description, level, type, group, public) and a sentence list with add, edit and delete. The sentence form validates with the shared `sentenceSchema`.
- Delete uses a confirmation dialog that names the collection and says how many sentences it has.
- A link to the admin area, shown only when `user.role === 'admin'`.

Learner data lives in TanStack DB collections scoped per learner (`ensureLearnerScope` in `_app.tsx`). Admin pages should use plain TanStack Query calls against `/api/admin/*`, and invalidate the learner-facing official collection data after a write so the library does not show stale content.

### Test plan

Backend tests go beside `backend/src/integration/admin.integration.test.ts`, which already has a "rejects admin imports for regular users" case to copy:

- Authorization negatives, parameterized over every route in the endpoint table: no session returns 401; a learner session returns 403 with code `FORBIDDEN`; in both cases the stored documents are unchanged.
- A role change takes effect immediately: demote an admin in the database and the next request returns 403 (`requireAdmin` re-reads the role on each request).
- An admin cannot edit a learner's collection through admin routes, public or private: PATCH, DELETE and all three sentence routes return 404 and leave the data unchanged. Also check that a learner collection id combined with a valid sentence id cannot reach that sentence.
- Existing learner negatives still hold: learner PATCH and DELETE on an official collection are refused (`findOwnedCollection` is unchanged).
- Behaviour: sentence create appends via `nextSentenceOrder` and updates `sentenceCount`; update re-derives `cloze`; a text with no marker or two markers returns 400 with the `text` field; delete removes the sentence and recounts; collection delete removes sentences and pulls the id from users' `pinnedCollections`; a group from another language pair is rejected; invalid ids return 404.
- An import after an admin edit overwrites the edited fields for the same slug (documents the known interaction).

Frontend: a test that the admin route redirects when `user.role` is not `admin`, and that the admin link is hidden.

### Open questions

1. Audit trail: which of the four options above? If option 2 or 3, is the user id enough to identify "who"?
2. Should an admin edit survive a later import? Options: leave as is (imports win), or mark admin-edited fields so imports skip them. The first is simpler; the second protects edits.
3. Should admins be able to create a single official collection through the API, or is the import enough?
4. Should deleting an official collection be a hard delete, as for learner collections, or a soft archive first? Learners' dashboards lose the pin either way (ADR 0002).
5. For a learner collection reached through admin routes: 404 (proposed) or 403 for consistency with learner routes?
6. Is group CRUD needed in the first version, or is the import enough?
7. Is the role check alone enough, or should admin routes be rate-limited or require a recent sign-in?
8. Admins are created today with the `npm run admin:upsert -w backend` script (`backend/scripts/upsert-admin.ts`). Is a promote and demote endpoint wanted, or does that stay out of the API?
