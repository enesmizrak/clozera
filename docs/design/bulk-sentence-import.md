# Bulk sentence import for My Collections

Status: proposed. This is a design only; no code has changed.

A learner who builds a My Collection can add sentences one at a time through the sentence form. A 50-sentence collection takes 50 passes through that form, which limits how much community content gets written. This document specifies a paste-based bulk import that collection owners can use.

Terms follow [../../CONTEXT.md](../../CONTEXT.md). Import is available on My Collections only. Official collections stay admin-managed (ADR 0003), and a Community Collection is another learner's My Collection, so a non-owner cannot import into it.

## What exists today

- `POST /collections/:id/sentences` in `backend/src/routes/collections.ts` parses one `sentenceSchema` and calls `createSentence` in `backend/src/services/collections-service.ts`.
- `createSentence` loads the collection through `findOwnedCollection` (owner match and `isOfficial: false`; 403 `Forbidden` if the collection exists but is not the viewer's, 404 if it does not exist). It places the sentence with `nextSentenceOrder` and recomputes the count with `refreshSentenceCount`. Both helpers are exported, so a new bulk function can reuse them.
- `importCollectionSentences` in `backend/src/services/admin-service.ts` already does a bulk insert for admins. It validates with `sentencesImportSchema`, which is only `text` and `translation` plus any other keys (`z.looseObject`). It normalizes each row with `normalizeSentencePayload`, rejects a row with no cloze at `sentences.${index}.text`, appends after the highest existing order, and writes the whole batch with `CollectionSentence.insertMany`. It does not apply the length limits in `sentenceSchema`, and it does not check ownership, because it sits behind the admin routes.
- `sentenceSchema` in `packages/shared/src/schemas.ts` is the contract for learner sentences: `text` up to 1000 characters with exactly one `{{marker}}`, `translation` up to 1000, `hint` up to 300, `notes` up to 2000, and `alternativeAnswers` and `multipleChoiceOptions` as lists (an array or a comma/newline-separated string, normalized by `normalizeList`). The two answer lists have no length limit in the schema.
- `backend/src/app.ts` sets `express.json({ limit: '1mb' })`.

The learner import should not call the admin function. That function is unguarded and looser than the learner schema, so reusing it would let a learner store rows the single-sentence endpoint rejects. The new service function should validate with `sentenceSchema` and share the ordering and counting helpers.

## Input format

Recommendation: tab-separated values, one sentence per line, with an optional header row. Columns, in order:

`text`, `translation`, `alternativeAnswers`, `multipleChoiceOptions`, `hint`, `notes`

Only `text` and `translation` are required. Trailing empty columns can be left off. Within `alternativeAnswers` and `multipleChoiceOptions`, items are separated by commas, which is what `normalizeList` and the single-sentence form (`listToText`) already use.

Example (tabs shown as `→`):

```
Ich {{habe}} einen Hund.→I have a dog.
Sie {{geht}} heute ins Kino.→She is going to the cinema today.→→geht, fährt→Present tense of gehen
```

Why TSV and not CSV:

- Learners build word lists in a spreadsheet (Google Sheets, Excel, Numbers). Copying cells from one puts tab-separated text on the clipboard, so pasting needs no export step and no file upload.
- Sentences contain commas all the time. CSV makes the paste dialog handle quoting rules and quoted newlines; a tab almost never appears inside a sentence, so a plain split on tab is enough.
- The two list columns already use commas for their items. In CSV they would need quoting; in TSV they do not.

How it maps to existing shapes: each parsed line becomes an object with the same keys as `sentenceSchema`, which is also what the admin importer reads (`text`, `translation`). The header row is optional and is detected when the first line's first two cells are `text` and `translation` (case-insensitive); it is dropped. Without a header, the column order above applies.

Parsing rules:

- Split on `\r?\n`, then on tab. Blank lines are skipped.
- Cells are trimmed, which `sentenceSchema` does anyway for `text` and `translation`.
- Spreadsheets can wrap a cell in double quotes when it contains a quote or line break. The first version does not unquote; a cell that arrives quoted is shown as-is in the preview so the learner can see and fix it. Revisit if this turns out to be common.
- A line with more than six cells is an error for that row (the extra cell is almost certainly a stray tab in a sentence).

CSV can be added later as a second parser that produces the same row objects. It would not change the API.

Where parsing happens: in the browser, in a small pure function in `packages/shared` next to `sentence-authoring.ts`. The API stays JSON, takes the same objects as the single-sentence endpoint, and has one format to validate. The preview and the server cannot disagree about how a line splits, since the server never splits lines.

## API

`POST /api/collections/:id/sentences/import`

Added to `backend/src/routes/collections.ts` beside the single-sentence route. Authentication is the same as the other collection routes.

Request body:

```json
{ "sentences": [ { "text": "Ich {{habe}} einen Hund.", "translation": "I have a dog." } ] }
```

Each element is parsed with `sentenceSchema`, so the learner import accepts exactly what the single endpoint accepts. A new `sentencesBulkSchema` in `packages/shared/src/schemas.ts` wraps it: `z.object({ sentences: z.array(sentenceSchema).min(1).max(MAX_IMPORT_SENTENCES) })`, with the constant exported from shared so the dialog can use the same number.

Guard: a new `importSentences` in `collections-service.ts` calls `findOwnedCollection` first. A non-owner gets 403, an official collection gets 403, and an unknown or malformed id gets 404, all the same as `createSentence`.

Behaviour: all-or-nothing.

- Validate every row first. If any row fails, nothing is written and the response is 400 in the existing envelope with one `details` entry per bad field, with paths like `sentences.12.text`. This is the same path format `importCollectionSentences` uses and the one `validationFailed` in `backend/src/http/errors.ts` produces from a Zod error (`issue.path.join('.')`), so no new error code or client handling is needed. Zod reports every failing row in one pass, so the learner sees all problems at once.
- If every row is valid, compute `base = nextSentenceOrder(collection._id)`, assign `order = base + index`, `insertMany`, then `refreshSentenceCount`. Order follows paste order, appended after existing sentences. Unlike the admin importer, learner rows do not take a client-supplied `order`.
- Response: `201` with `{ data: { sentences: [...] } }` using `serializeSentence` for each created document. The dialog invalidates the sentence list and the collection (for `sentenceCount`).

Why all-or-nothing rather than partial success:

- The dialog already shows per-row problems in a live preview and disables the import button until rows are fixed, so a server-side row rejection is a rare backstop, not the main feedback path.
- Partial success needs a response shape that mixes created and rejected rows, plus UI to resume with the rejected rows. It also makes retries after a dropped connection ambiguous (did rows 1-30 land?). With all-or-nothing, a rejected request changed nothing and can be repeated.
- The cost is that one bad row blocks the batch. The preview exists to make that cheap to fix.

Atomicity note: `insertMany` on a standalone MongoDB is not a transaction. After validation succeeds, the remaining failure mode is a database error partway through, which returns 500 like every other route. Mongoose `insertMany` is ordered by default and stops at the first write error, leaving earlier documents inserted. `refreshSentenceCount` recounts from the collection, so the count stays correct either way. Open question 3 asks whether that is enough.

Caps and limits:

- At most 200 sentences per request (`MAX_IMPORT_SENTENCES = 200`). Over the cap is a 400 with `details: [{ field: 'sentences', message: ... }]` from Zod's `.max`.
- Request body: the existing 1 MB `express.json` limit applies and should not be raised for this route. By the field limits, the fixed fields of one row can reach about 4.3 KB (1000 + 1000 + 300 + 2000 characters, before multi-byte encoding), so 200 maximum-size rows could exceed 1 MB and hit the body limit before the row cap. Realistic sentences are a few hundred bytes each, far under it. An oversized body is rejected by `express.json` before route code runs, and `errorHandler` in `backend/src/app.ts` turns it into a 4xx `BAD_REQUEST`.
- The two answer lists have no length limit in `sentenceSchema`; the body limit bounds them. This design does not add one, but it is listed in open questions because it also applies to the single-sentence endpoint today.

No per-collection total cap is specified. I did not find one in `createSentence`, `importCollectionSentences` or the indexes in `backend/src/models/collection-sentence.ts`; see open questions.

## Rate limiting

The only rate limits I found in the backend are Better Auth's `customRules` for sign-in, sign-up and email routes in `backend/src/auth/auth.ts`; its comment says they are per IP and kept in memory per instance. The collection routes have none.

Recommendation: no new limiter for the first version.

- Accounts must verify their email (`requireEmailVerification: true` in `auth.ts`), so importing needs a real, signed-in account.
- One request is bounded by 200 rows and 1 MB, so the largest single write is small for MongoDB.
- The existing single-sentence endpoint has no limit and can already be scripted. A bulk endpoint adds no new kind of abuse, only a faster one.
- The abuse that matters for public collections is content, which a rate limit does not address.

If abuse shows up, the follow-up is a per-user limit on the write routes of `/collections` (for example 10 imports per minute per user), added as one Express middleware in `backend/src/routes/collections.ts`, not a limiter built only for import. It would need a shared store if the API runs more than one instance.

## UI

An "Import sentences" button next to the add-sentence control on the collection page (`frontend/src/routes/_app/dashboard/collections/$collectionId/index.tsx`), shown only when `collection.capabilities.canEdit` is true, the same flag that gates the edit controls on that page.

The dialog:

1. A textarea with a short hint showing the column order and one example line, and a note that spreadsheet cells can be pasted directly.
2. A live preview under the textarea, one row per parsed line, built from the shared parser and the shared helpers: `sentenceParts` from `packages/shared/src/sentence-authoring.ts` renders the sentence with the cloze highlighted, and `sentenceSchema.safeParse` per row produces the row's error message. A row with no `{{marker}}`, more than one marker, or a missing translation is marked with an error, using the schema's own messages so the wording matches the single-sentence form (for example "Mark exactly one missing word or phrase with {{double braces}}.").
3. A summary line ("38 sentences ready, 2 need fixing") and an Import button that is disabled while any row is invalid, no rows exist, or the row count is over `MAX_IMPORT_SENTENCES`.
4. On submit, one POST. On success, close the dialog and refresh the list. On a 400 from the server, map `details[].field` (`sentences.12.text`) back to preview rows by index, so the same display handles a backstop rejection.

`SentenceForm` uses TanStack Form via `useAppForm` (`frontend/src/components/form.tsx`). The import dialog does not need that: it is one textarea plus derived preview state, so plain React state with a mutation is simpler. It can reuse `FormError` from the same module for request-level errors.

No debounce is needed for the preview at a 200-row cap; parsing and a per-row `safeParse` are cheap.

## Tests

Backend integration tests, added to `backend/src/integration/collections.integration.test.ts` (it already has seeding and `signUpAs` helpers):

- Owner happy path: an owner imports several rows and gets 201; rows are stored in paste order, `sentenceCount` matches, and optional fields (alternatives, hint) are normalized.
- Appends after existing sentences: import into a collection that already has sentences and check the order values continue from `nextSentenceOrder`.
- Non-owner 403: a second user imports into the first user's collection.
- Official collection 403: a learner importing into an official collection is refused, because `findOwnedCollection` requires `isOfficial: false`.
- Unknown collection id: 404.
- Row error reporting: a body with a missing marker in one row and a missing translation in another returns 400 with `details` entries such as `sentences.2.text` and `sentences.5.translation` (zero-based) and writes nothing.
- Cap exceeded: 201 rows returns 400 with a `sentences` detail and writes nothing.
- Empty list: returns 400.
- Unauthenticated: rejected like the other collection routes.

Shared unit tests for the new parser in `packages/shared`: tab splitting, optional header detection, blank-line skipping, short rows, rows with more than six cells, and CRLF input.

Frontend tests, alongside `frontend/src/components/sentence-form.test.tsx`: the import button is hidden when `canEdit` is false; the preview marks a row with no marker; the Import button is disabled while a row is invalid and enabled once it is fixed; a server 400 maps back to the right preview row.

## Open questions

1. Header and quoting: is optional header detection with no unquoting good enough for what learners paste from spreadsheets, or should the first version unquote double-quoted cells?
2. Row cap: is 200 right? It fits a lesson-sized list and is well under the body limit for normal sentences.
3. Partial insert on a database failure: should the service delete already-inserted rows on error, or is a correct count after a rare 500 enough? A MongoDB transaction needs a replica set; I have not checked whether the production database (ADR 0004) is one.
4. Per-collection cap: nothing I read limits how many sentences a collection can hold, and bulk import makes reaching a very large number easy. Do we want a total cap (for example 1000), and should it apply to the single-sentence endpoint too?
5. Answer-list limits: `alternativeAnswers` and `multipleChoiceOptions` have no length or item-count limit in `sentenceSchema`. Add one now, which also changes the single-sentence endpoint?
6. Duplicates: should the import skip or flag a row whose `text` already exists in the collection? The first version does not check, and the `{ collection, cloze }` index is not unique.
7. Rate limiting: is "no limiter" acceptable for launch, or do we want the per-user limit on collection write routes from the start?
8. Should the admin importer move onto `sentenceSchema` validation so the two paths cannot drift, or be left alone?
