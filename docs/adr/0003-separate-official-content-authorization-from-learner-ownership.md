# Separate Official Content Authorization from Learner Ownership

Official collections are Clozera-published content, even when they are imported or maintained by a specific admin account. Learner-facing collection authorization is limited to non-official collections owned by the learner, while official collection creation, editing, and deletion require administrative authority and should be handled through admin-specific workflows. For the MVP, administrative authority is represented by an admin user role.

This avoids treating an official collection's maintenance owner as normal learner ownership, which would make official content management depend on whichever admin account imported the content and would not scale to multiple admins.
