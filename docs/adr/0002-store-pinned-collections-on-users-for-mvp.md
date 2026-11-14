# Store Pinned Collections on Users for MVP

Pinned collections are currently only a dashboard presentation preference, so the MVP stores pinned collection references on the user rather than introducing a separate pin model. A separate `CollectionPin` model can be introduced later if pins need their own metadata, cross-user analytics, multiple dashboard surfaces, or richer ordering behavior.

Dashboard membership is exposed as a dashboard resource rather than a collection mutation: `GET /dashboard/collections`, `POST /dashboard/collections`, and `DELETE /dashboard/collections/:collectionId`. Although pinned references are stored on the user, these endpoints keep the API aligned with the user-facing dashboard surface.

When a collection is deleted, the backend removes that collection id from matching users with an array pull operation rather than iterating over every user. Dashboard reads must still only return existing collections that the user can access, so stale pin references are harmless if cleanup is delayed or retried.

Changing a collection from public to private does not remove existing pin references from other users. Those pins stop appearing because dashboard reads filter by access, and they can reappear if the collection becomes public again.
