# Host MongoDB on the VPS with R2 Backups

Status: Accepted (2026-11-14)

Clozera runs on a single Hetzner VPS managed by Coolify behind Cloudflare. The database must be chosen with that in mind: MongoDB Atlas Free (M0) is capped at 100 operations per second with a fixed storage size, runs on a shared cluster that adds a network hop to every query, and offers limited backup options.

We run MongoDB as a Coolify Database resource on the same VPS and use Coolify scheduled backups to Cloudflare R2 (daily; retention 7 local, 30 in R2), with a monthly restore test into a scratch database. Atlas Free was considered as the primary database and as a nightly mirror of the self-hosted one. As primary, its limits and latency are a poor fit. As a mirror, it is a warm standby rather than a backup, because corruption or a bad delete is copied on the next sync. A mirror can still be added later.

The operator owns updates, disk space and backups. Transactions stay off (`MONGODB_TRANSACTIONS=false`) unless MongoDB is run as a single-node replica set. Revisit this decision if traffic outgrows the VPS or if not operating a database ourselves (a managed service) becomes the priority.
