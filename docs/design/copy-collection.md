# Design spike: copying a collection into My Collections

Status: proposal, no code changes. Written against `main` at 7a031f2.

## Problem

A learner can read official and community collections but cannot change them. Only the owner of a non-official collection can edit it (`findOwnedCollection` in `backend/src/services/collections-service.ts`, ADR 0003). A learner who wants to add hints to a community collection or drop sentences they already know has to retype the whole thing.

A Collection Copy fills that gap without weakening ownership: the learner gets a new My Collection they own, and the source stays untouched. The open questions are what a copy remembers about its source, who may see it, and whether the content may be re-published.

## What exists today

- `Collection` (`backend/src/models/collection.ts`) has `owner`, `languagePair`, `group`, `name`, `slug`, `description`, `type`, `level`, `isOfficial`, `isPublic`, `sentenceCount`, `order`. There is no field that points to a source collection.
- `CollectionSentence` (`backend/src/models/collection-sentence.ts`) holds `owner`, `collection`, `text`, `translation`, `cloze`, `alternativeAnswers`, `multipleChoiceOptions`, `hint`, `notes`, `order`. `cloze` is derived from `text` by a pre-validate hook, so a copy that goes through `create` or `insertMany` keeps it in sync.
- `findAccessibleCollection` is the read guard: public collections plus the viewer's own (`collectionAccessConditions` in `backend/src/lib/collection-capabilities.ts`).
- `createCollection` slugifies the name (Unicode-aware, `backend/src/lib/slug.ts`), picks a free slug with `uniqueCollectionSlug`, retries once on a `Conflict`, creates with `isOfficial: false`, and then adds the collection to the creator's `pinnedCollections`.
- `nextSentenceOrder` and `refreshSentenceCount` are exported helpers for ordering and counting sentences.
- `serializeCollection` (`backend/src/lib/serializers.ts`) adds `creator: { id, displayName }` only when the relationship is `community`, and `displayName` is `owner.name || owner.username`. Nothing else about the owner is exposed.
- There is no per-collection sentence cap in the learner write path that I could find (`sentenceSchema` limits field lengths only, `packages/shared/src/schemas.ts`).

A separate spike is designing a bulk sentence import endpoint (`POST /api/collections/:id/sentences/import`, owner-only). It is "planned" and this design does not depend on it. The copy endpoint reads sentences directly from the database, so it needs no import format.

## Semantics: snapshot copy, not linked copy

Options:

1. **Snapshot copy.** A one-time duplication. After the copy, the two collections are independent. Edits and deletions on either side never affect the other.
2. **Linked copy.** The copy tracks the source: upstream edits flow in, and local edits are merged or overlaid.

Recommendation: **snapshot**.

- It matches the ownership model. The copy is a plain My Collection with `canEdit` true for its owner; no new edit logic is needed in `collectionCapabilities`.
- A linked copy needs a merge or overlay model for sentences (a learner changes a hint, the source changes the same sentence). That is a large feature with no demonstrated demand.
- It avoids a privacy leak: a linked copy would keep surfacing changes from a source that may have gone private.
- The copy gets new sentence documents, so it starts as an independent collection.

What is copied:

| Field | Behaviour |
| --- | --- |
| `name`, `description`, `type`, `level`, `languagePair` | Copied as is. |
| Sentences: `text`, `translation`, `alternativeAnswers`, `multipleChoiceOptions`, `hint`, `notes`, `order` | Copied. New documents get `owner` set to the copier. `cloze` is recomputed by the model hook. |
| `owner` | The copier. |
| `isOfficial` | Always `false`. A copy of an official collection is a My Collection. |
| `group` | `null`. Groups belong to official content (they carry `type` and `order`). |
| `order` | Default (0). |
| `slug` | Generated with the same slugify plus `uniqueCollectionSlug` path as `createCollection`. A same-name copy gets `-2`, so the name needs no "Copy of" prefix. |
| `isPublic` | `false`. See visibility below. |
| Pins | The copy is auto-pinned for the copier, exactly like `createCollection`. The source's pin state is not touched. |

## Attribution

Add one optional field to `Collection`:

```
copiedFrom: {
  collection: ObjectId | null   // source id; not populated
  name: string                  // source name at copy time
  creatorName: string           // display name at copy time (owner.name || owner.username); '' for official sources
  wasOfficial: boolean
}
```

The DTO gains `copiedFrom?: { name: string; creator?: CollectionCreatorDto-like credit; collectionId?: string; isOfficial: boolean } | null`. The UI shows "Adapted from <name> by <displayName>" on the copy, or "Adapted from <name> (Clozera official)" for an official source. The credit is the same display name `serializeCollection` already shows for community collections, so no private identity details are added.

Why snapshot the names instead of populating them live:

- If the source is deleted, the credit still reads correctly and there is no dangling reference to render.
- If the source goes private, a live lookup would either leak a now-private collection's name or have to hide the credit. The snapshot data was public when the copier saw it, so nothing new is revealed.
- The cost is that a creator who later changes their display name stays credited under the old name, and an account deletion would need to scrub `creatorName` on copies. This is a maintainer decision (see open questions).

Behaviour by source state:

| Source state | Copy shows |
| --- | --- |
| Still public | Credit plus a link to the source (`collectionId`, returned only if `findAccessibleCollection` would let the viewer read it). |
| Made private | Credit text stays; the link is dropped because other viewers can no longer read it. |
| Deleted | Credit text stays; the link is dropped. The serializer can treat a source that no longer resolves as deleted, so `deleteCollection` needs no change. |
| Source owner deletes their account | Out of scope; follow whatever the account-deletion flow does with `creatorName`. |

Copying a copy credits the copy's owner as the immediate source. A full chain of credit (the original author of the original) is not kept in v1; see open questions.

## Visibility and licensing

Default: **private**, regardless of the source's visibility. This follows Collection Visibility ("New collections default to private") and means a copy never appears on the Community shelf by accident.

Can a copy of a Community Collection be made public? The code can allow it (`updateCollection` lets any owner change `visibility`), but the real question is whether Clozera may republish someone else's content. What I found in the repo:

- The code is GPL-3.0-only (`LICENSE`, `"license": "GPL-3.0-only"` in `package.json`). That licenses the software, not the learner-authored sentences stored in the database.
- No content license or terms of use for learner-authored content exists in the repo. The public footer links to `/terms` and `/privacy` (`frontend/src/components/public-footer.tsx`), but I found no matching route under `frontend/src/routes` and no terms document. Today nothing states what rights a learner grants when they make a collection public.
- Official content is Clozera-published; the maintainer controls its rights.

Options for the maintainer:

1. **Private-only copies of community content.** A copy whose source was a Community Collection can be practised and edited, but not made public. This needs no legal text and removes the republishing risk. Cost: a server rule in `updateCollection` that rejects `visibility: 'public'` when `copiedFrom` is set and `wasOfficial` is false, plus a capability so the UI can explain it (`CollectionCapabilities`, ADR 0001). Copies of official content can be allowed to go public or not; that is the maintainer's call about their own content.
2. **Allow public with mandatory attribution.** Copies can be published and always show "Adapted from ... by ...". Needs a terms-of-use clause in which creators who publish grant others the right to copy, adapt and republish with credit. Without that clause this option is not safe.
3. **Per-collection license chosen at publish time.** Creators pick a license when making a collection public; copying and republishing follow it. Most flexible, most work, and adds a field and UI to every public collection.
4. **No copying of community content at all.** Only official collections are copyable. Smallest scope, but it leaves the stated need (adapting a community collection) unmet.

Recommendation: ship option 1 now, and revisit option 2 once a terms-of-use page exists. A content clause in the terms is worth writing regardless of this feature, because making a collection public already shows the content to everyone.

## API sketch

`POST /api/collections/:id/copy`

- Router: in `backend/src/routes/collections.ts`, next to `POST /collections`. The `/collections` prefix is already behind `requireUser`.
- Body: empty in v1. The copy takes the source's name and language pair, and visibility is always private. Renaming happens afterwards through the existing `PATCH /collections/:id`.
- Guard: `findAccessibleCollection`. A private collection of another user returns the same not-found as any other unreadable id. Copying your own collection is allowed (useful for variants).
- Steps, as a new service function modelled on `createCollection`:
  1. Load the source with `findAccessibleCollection`.
  2. Reject if `sentenceCount` exceeds the copy cap (below), before any write.
  3. Pick the slug with `uniqueCollectionSlug` and create the collection (`isOfficial: false`, `isPublic: false`, `copiedFrom` filled in), with the same one retry on `Conflict`.
  4. Read the source sentences sorted by `order` and `insertMany` them with `owner` set to the viewer and `collection` set to the new id.
  5. Call `refreshSentenceCount` on the new collection.
  6. Add the collection to `pinnedCollections` with `$addToSet`, populate, and return `serializeCollection(collection, updatedViewer)`.
- Response: 201 with the new `CollectionDto`, like `POST /collections`. The relationship is `owned`, so `creator` is omitted and `copiedFrom` carries the credit.
- Failure handling: MongoDB is hosted on the VPS (ADR 0004); I did not verify that it runs as a replica set, so do not assume multi-document transactions. If `insertMany` fails after the collection was created, delete the new collection and any inserted sentences (best effort) and return the error. A half-filled copy is the failure to avoid.
- Size cap: a constant, for example 500 sentences, checked against the source's `sentenceCount`. No existing cap was found to align with, so the number is a placeholder to be set from the largest real collections. Above the cap the response says the collection is too large to copy. Admin-imported official collections are the likely outliers.
- Abuse: a learner can create many copies. A per-user rate limit or a cap on total My Collections would address it; neither exists today, so treat it as a follow-up.
- Tests when built: copy of a public community collection; copy of an official collection; copy of another user's private collection (not found); copy over the cap; same-name copy gets a new slug; copy is private; copy is auto-pinned; later edits to the copy leave the source unchanged.

Frontend: a "Make a copy" action on community and official collections, driven by a new backend capability (for example `canCopy`) so the UI keeps following backend-provided capabilities (ADR 0001).

## Glossary impact

Proposed new term for `CONTEXT.md`:

**Collection Copy**:
A new My Collection created by duplicating the sentences and details of an existing collection the learner can read. A Collection Copy is private by default, owned by the learner who made it, and does not stay in sync with its source. It credits the source's Collection Creator, while private identity details remain hidden.
_Avoid_: Fork, clone, linked collection

Related edits to existing entries if the feature is built:

- **Pinned Collection** says pinning does not "create a copy". That stays true; add a pointer: learners who want an editable version make a Collection Copy.
- **Collection Creator**: a Collection Copy credits the creator of its source in addition to being owned by the copying learner.
- **My Collection**: a Collection Copy is a My Collection.

## Open questions for the maintainer

- Is the display-name snapshot acceptable, or should credit be resolved live and hidden when the source is not readable?
- What is the largest collection a learner is expected to copy, to set the cap?
- Should copies of official content be allowed to go public? That is a rights decision about Clozera's own content.
- Is a chain of credit (the original author when copying a copy) needed? Not in v1.
- Where should the terms-of-use clause for learner content live, given `/terms` has no page yet?

## Recommendation

Build it, as a snapshot copy that is private by default, behind `POST /api/collections/:id/copy`. The need is real (adapting a collection otherwise means retyping it), the change is small because it reuses `findAccessibleCollection`, the `createCollection` slug and pinning path and the existing sentence model, and it leaves ADR 0003 and the ownership rules intact. Ship it with licensing option 1: copies of community content cannot be made public, because the repo has no content license or terms for learner-authored content (the GPL-3.0 covers the code only, and `/terms` is linked in the footer but has no page). Defer re-publishing and any linked or synced copies until the maintainer writes a content terms clause, and set the sentence cap from real data before release.
