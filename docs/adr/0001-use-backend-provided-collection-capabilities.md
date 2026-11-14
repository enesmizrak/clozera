# Use Backend-Provided Collection Capabilities

Collection action availability is user-specific and depends on ownership, official status, visibility, and administrative permissions. The backend will serialize collection capabilities such as `canEdit`, `canDelete`, `canChangeVisibility`, `canPin`, and `canUnpin` so the frontend can render available actions without reimplementing authorization rules.

These capabilities are a UI contract, not a security boundary. Every mutation endpoint must still enforce authorization on the backend, so changing capability values in the browser cannot grant access to edit, delete, pin, unpin, or otherwise mutate a collection.

Pinning capabilities are derived from access and the current pinned state: accessible unpinned collections can be pinned, and currently pinned collections can be unpinned.
