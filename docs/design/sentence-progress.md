# Sentence progress (design spike)

Status: Proposed. Nothing here is implemented. See `docs/adr/0006-sentence-progress.md`.

Practice grades every answer and then discards it. `check` and `rateFlashcard` in `frontend/src/hooks/use-practice-session.ts:88-95` dispatch a local `grade` action and send nothing to the API. `sessionSentencesFromCollection` in `frontend/src/lib/practice-session.ts:51` is a uniform shuffle (`shuffledItems(...).slice(0, limit)`), so a learner sees a sentence they have never missed as often as one they miss every time. `CONTEXT.md` defines **Practice Session** as practice "without saving learning progress or review history", so saving results needs a new term and a decision, not a quiet change.

## Proposed term

Glossary entry to add to `CONTEXT.md` if the decision is accepted (not added by this spike):

**Sentence Progress**:
A learner's private record of how they have answered one Sentence in Practice Sessions: how many attempts, how many were correct, the latest result and when they last practiced it. It exists only to choose which Sentences a later Practice Session shows more often.
_Avoid_: Review history, review session, score, mastery, spaced repetition schedule

Also amend **Practice Session** to say it may read and update Sentence Progress, and keep "temporary" for the round itself. Sentence Progress has no due dates and no intervals, so it is not spaced repetition; that is why those words are on the _Avoid_ list.

## Data model

A new Mongoose model `SentenceProgress`, in its own collection, next to the existing models in `backend/src/models/`. ADR 0002 stores pins on the user "for MVP" and names the case for a separate model: data with its own metadata. Per-user-per-sentence counters are that case, and they would make the user document grow without bound, so they do not go on the user.

Fields:

- `user`: ObjectId ref `User`, required.
- `sentence`: ObjectId ref `CollectionSentence`, required.
- `collection`: ObjectId ref `Collection`, required. Duplicated from the sentence so a round can load all progress for one collection with one query, and so deleting a collection can clean up by collection id.
- `attempts`: number, default 0.
- `correct`: number, default 0.
- `lastCorrect`: boolean, the latest result.
- `lastPracticedAt`: date.
- `lastRoundId`: string, used for retry idempotency (see Write path).

Indexes:

- Unique `{ user: 1, sentence: 1 }`. This is the upsert key.
- `{ user: 1, collection: 1 }`. This is the read path: one query for "my progress in this collection".
- `{ sentence: 1 }`, only if deleting one sentence has to find its rows quickly. Sentence deletion could instead leave orphans, as pins do in ADR 0002 ("stale pin references are harmless"); orphans are never read because reads start from the collection's sentences.

Size estimate: about 100 bytes of BSON per row (four ObjectIds including `_id`, two small numbers, a boolean, a date, a round id, field names), roughly 150 bytes with index entries. A learner who has practiced 2,000 sentences costs about 300 KB. 1,000 such learners cost about 300 MB, which fits on the single VPS described in `doc/deployment.md` and ADR 0004. Rows exist only for sentences a learner has answered, not for every sentence they can see. These are estimates, not measurements.

## Write path

Options: one request per answer, or one request at the end of the round.

Recommended: one request per completed round, plus a flush when the learner leaves mid-round. The client already holds the whole round in the reducer, so it can accumulate `{ sentenceId, correct }` pairs and send them together.

- Endpoint sketch: `POST /collections/:id/progress` with `{ roundId, results: [{ sentenceId, correct }] }`. It does a single `bulkWrite` of upserts per call: `$inc: { attempts: 1, correct: correct ? 1 : 0 }`, `$set: { lastCorrect, lastPracticedAt: now, lastRoundId: roundId }`, `$setOnInsert` for `user` and `collection`. The user comes from the session, never from the body, and the service must check that each sentence belongs to the collection the viewer can access (reuse the capability check from ADR 0001).
- Abandoned rounds: answers already given are real signal, so flush what exists with `navigator.sendBeacon` on `pagehide`, and also on the explicit "leave" action. If the beacon is lost, the cost is at most one round of counters. No retry queue is proposed.
- Offline: a failed end-of-round request is dropped, not queued. The round still works exactly as it does today, so the feature adds no new failure mode to practice.
- Idempotency: `$inc` is not idempotent, so a retried request would double count. The client generates a `roundId` (UUID) per round. Server-side, each upsert filter also requires `lastRoundId: { $ne: roundId }` for existing rows, so a replay of the latest round is a no-op. That only dedupes immediate retries of the most recent round, which is the realistic case, and costs one field. (Implementation note: with an upsert, a filter that excludes the existing row would try to insert and hit the unique index; the implementation must treat that duplicate-key error as "already applied".) Per-answer writes would need per-answer ids, a main reason not to choose them.
- Per-answer writes were rejected: 10 to 20 requests per round, in-memory rate limits (single API container, see `doc/deployment.md`) would have to be tuned, and a flaky connection fails mid-round instead of at the end.

Trust: the client reports its own results, so a learner can write whatever they want to their own progress. That is fine because progress only affects that learner's own sampling.

## Read path

`GET /collections/:id/sentences` is paginated, and the integration test "lists paginated collection sentences without progress data" (`backend/src/integration/collections.integration.test.ts:271`) asserts the response has no `progress` property (line 295). Keep that contract: do not add progress to sentence list responses. Add a separate read, `GET /collections/:id/progress`, returning `{ sentenceId, attempts, correct, lastPracticedAt }` rows for the viewer. The existing test then stays true and the sentence list stays cacheable across users.

The frontend merges the two. `sessionSentencesFromCollection` has two callers, both in `use-practice-session.ts` (line 71, first round, and line 100, restart). It would gain an optional progress argument; with none, behaviour is exactly the current uniform shuffle.

Weighting: weight each sentence, then draw `limit` sentences without replacement with the Efraimidis-Spirakis key `random() ** (1 / weight)` (take the largest keys). Weight:

- Unseen sentence (no row): weight 1.0, so new material still appears.
- Seen sentence: `missRate = 1 - (correct + 1) / (attempts + 2)` (add-one smoothing, so one right answer does not mean "mastered"), then `weight = 0.25 + 1.75 * missRate`, so the range is 0.25 to 2.0.
- Recency: if practiced less than an hour ago, multiply by 0.5, so the sentence just answered does not return immediately on restart. Older practice has no extra effect; there is no decay curve, deliberately.
- The floor of 0.25 means every sentence stays possible.

Pure-function sketch, unit-testable the same way as `frontend/src/lib/practice-session.test.ts` (inject `random` and `now`). `SentenceDto` has a string `id` (`packages/shared/src/contracts.ts:93`).

```ts
export interface SentenceProgressDto {
  sentenceId: string
  attempts: number
  correct: number
  lastPracticedAt: string
}

const RECENT_MS = 60 * 60 * 1000

export function sentenceWeight(progress: SentenceProgressDto | undefined, now: number): number {
  if (!progress || progress.attempts === 0) return 1
  const missRate = 1 - (progress.correct + 1) / (progress.attempts + 2)
  const recent = now - Date.parse(progress.lastPracticedAt) < RECENT_MS
  return (0.25 + 1.75 * missRate) * (recent ? 0.5 : 1)
}

export function weightedSessionSentences<T extends { id: string }>(
  sentences: readonly T[],
  progress: readonly SentenceProgressDto[],
  limit: number,
  random: () => number = Math.random,
  now: number = Date.now()
): T[] {
  const byId = new Map(progress.map(row => [row.sentenceId, row]))
  return sentences
    .map(sentence => ({
      sentence,
      key: random() ** (1 / sentenceWeight(byId.get(sentence.id), now)),
    }))
    .sort((a, b) => b.key - a.key)
    .slice(0, limit)
    .map(entry => entry.sentence)
}
```

Tests to write with it: no progress behaves like a plain sample of `limit`; a sentence with 0 of 5 correct is drawn more often than one with 5 of 5 over many seeded runs; a sentence practiced a minute ago is drawn less often than the same one practiced yesterday; result length is `min(limit, sentences.length)`; weights never reach zero. The sketch has not been run.

## Privacy

- Progress is private to its learner. No endpoint returns another user's progress, and collection creators and admins get no progress or aggregate view in this design. Recommendation: never show it to collection creators. An aggregate per-sentence view for creators would turn learner behaviour into creator data and needs its own ADR.
- Account deletion: I searched `backend/src` and `frontend/src` for user or account deletion and found no flow. `backend/src/auth/auth.ts` configures Better Auth `user` options (`additionalFields`, `changeEmail`) and does not enable `deleteUser`; the only related match, `deleteUserSessions` in `backend/src/auth/credentials.ts:24`, is session revocation. So there is nothing to hook into today. If account deletion is added, it must also run `SentenceProgress.deleteMany({ user })`. Until then, progress lives as long as the account.
- Collection deletion: `deleteCollection` (`backend/src/services/collections-service.ts:190`) already deletes sentences and pulls pins. It should add `SentenceProgress.deleteMany({ collection })`. If that step fails, leftover rows are unreachable and harmless, the same argument its doc comment makes for sentences and pins.
- Backups: progress rows go to the daily R2 backups described in ADR 0004, so a deletion reaches backups only as they expire (30 days in R2).
- Content: rows hold ids and counters only, no answer text.

## Alternatives

(a) Do nothing. Zero cost, no new term, `CONTEXT.md` stays true. Learners keep seeing mastered sentences as often as missed ones, which is the main thing cloze and flashcard learners expect. Fine if the product is positioned as quick one-off drills.

(b) Device-local progress in the Zustand persist store `frontend/src/stores/preferences.ts`. No backend, no privacy surface, works offline. But that file's comment declares it "Per-device UI preferences", with server data in TanStack Query/DB, so this needs an explicit decision to widen it. localStorage is also small (commonly about 5 MB), one persisted blob is rewritten on every change, and data is lost when the learner clears the browser or switches device. It suits a time-boxed experiment to see if weighting is liked, if a separate persist key is accepted and its data is understood not to migrate.

(c) Server-side model, as described above. Syncs across devices, survives browser clears, allows later features. Costs: a new model and two endpoints, a privacy surface, and cleanup obligations on collection and (future) account deletion.

Recommendation: (c), at the smallest scope in this document: a per-round bulk write, a separate progress read, and weighting only. Do not build streaks, due dates or creator analytics in the first change. If the team is unsure that learners want weighting at all, do (b) first as a throwaway.

## Open questions

- Should a Practice Session have a way to opt out ("practice evenly"), for example a toggle beside mode and limit in preferences?
- Should the learner be able to reset progress for one collection? It is cheap (`deleteMany({ user, collection })`) and probably needed for trust.
- Do multiple-choice and flashcard results count the same as typed answers? Multiple choice is easier to guess and flashcard "remembered" is self-reported, so they may deserve less weight. The design counts all modes equally.
- Retention: should rows for sentences not practiced in a year be pruned?
- Does `sendBeacon` work with the Cloudflare and `/api` proxy path and the Better Auth session cookie? Needs a check before choosing it.
- Shared official content (ADR 0003): confirm that no capability rule blocks a non-owner from writing progress against a collection they can only read.
