# Edit Official Content Through Dedicated Admin Endpoints

Status: Proposed

ADR 0003 says official collection creation, editing, and deletion need administrative authority and should go through admin-specific workflows. Today the admin API only imports content (`backend/src/routes/admin.ts`), and there is no admin UI, so fixing one official sentence means running a script against the production database. This ADR proposes the shape of that workflow. The details are in [../design/admin-official-content.md](../design/admin-official-content.md).

Official content is edited through new routes under `/api/admin`, behind the existing `requireAdmin` guard. They do not reuse the learner routes, and the learner guard `findOwnedCollection` is not widened for admins. Admin routes load collections with a separate `findOfficialCollection`, which only matches `isOfficial: true`, so an admin cannot change a learner's collection through them. The services share the low-level pieces already used by imports and learner editing: sentence normalization, `nextSentenceOrder`, and `refreshSentenceCount`.

The backend stays the authority. A small admin area under `_app/admin` may hide itself from non-admins using `user.role`, but that is only a convenience. Whether admin edits should be recorded in an audit trail (who changed what, and when) is left as an open question for the maintainer, with options listed in the design document.

This ADR stays Proposed until the maintainer answers those open questions. It changes no behaviour by itself.
