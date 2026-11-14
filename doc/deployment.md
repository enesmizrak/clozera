# Deployment

Clozera runs on a single Hetzner VPS managed by Coolify, behind Cloudflare. This page
describes the edge, the Coolify resources, the environment, the database and the first
deploy. `docker-compose.coolify.yml` holds the production stack. Do not reuse the
development `docker-compose.yml`.

## Topology

```
browser ─HTTPS─▶ Cloudflare edge ─(Tunnel, outbound from VPS)─▶ cloudflared container
  ─▶ Coolify proxy (Traefik :80) ─▶ web container :8080 ─(/api proxy, Docker network)─▶ api container :3000 ─▶ MongoDB
```

Rate limiting needs the real visitor address. Cloudflare sets `CF-Connecting-IP`, and the
web server may trust it only if the origin accepts web traffic exclusively from Cloudflare.
The API must never be publicly reachable: the web app's `/api` proxy is the only client
that may set `X-Forwarded-For` for it.

Two edge options:

- **Cloudflare Tunnel (recommended).** Use Coolify's "all resources" tunnel: one wildcard
  hostname forwarding to Coolify's proxy at `http://localhost:80`. The VPS needs no inbound
  80/443, so every web request passes through Cloudflare and `CF-Connecting-IP` can be
  trusted. A Tunnel bypasses firewall rules: anything reachable through it is public.
- **Proxied DNS plus a Hetzner Cloud Firewall.** Point an orange-cloud DNS record at the VPS
  IP. The Hetzner Cloud Firewall (in the Hetzner console) must allow inbound 80/443 only from
  [Cloudflare's published IP ranges](https://www.cloudflare.com/ips/). Keep that list updated.

Either way, allow SSH (22) only from the operator's addresses or through Tailscale or
Cloudflare Access. MongoDB and API ports are never published to the host.

> **Docker bypasses `ufw`.** Ports that Docker publishes skip host firewall rules. The
> firewall must live outside the VM (Hetzner Cloud Firewall), or there must be no public web
> ports at all (Tunnel). Do not rely on `ufw`.

## Cloudflare settings

For the app hostname:

- SSL/TLS mode: Full (strict).
- Email Obfuscation and Rocket Loader: off. Both rewrite HTML or JavaScript and can break
  React hydration.
- No cache rules for `/api/*`.
- Optional extra layer: a WAF rate-limiting rule on `/api/auth/sign-in*` and
  `/api/auth/request-password-reset`.

## Coolify resources

One Docker Compose resource from `docker-compose.coolify.yml`, with `web` and `api` on the
same Compose network.

| Service | Built from | Public domain | Key environment |
| --- | --- | --- | --- |
| `web` | `frontend/Dockerfile.production` (port 8080) | Yes, e.g. `clozera.example` (set in the Coolify UI) | `API_INTERNAL_URL=http://api:3000`, `CLIENT_IP_HEADER=cf-connecting-ip` |
| `api` | `backend/Dockerfile.production` (port 3000) | No | `NODE_ENV=production`, `PORT=3000`, `FRONTEND_URL`, `BETTER_AUTH_SECRET`, `MONGODB_CONNECTION_STRING`, `MONGODB_TRANSACTIONS`, `EMAIL_TRANSPORT=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` |

The API has no domain and no published port. Run one API container: Better Auth keeps its
rate limits in memory per process, so a restart resets them, which is acceptable.

Enter secrets as Coolify environment variables. Never commit them.

## Environment

API (`api`):

- `NODE_ENV`: required; `production` here. The API refuses to start without it.
- `PORT`: listening port, `3000`.
- `FRONTEND_URL`: public web origin, e.g. `https://clozera.example`. Also used for links and
  images in emails.
- `BETTER_AUTH_SECRET`: 32+ random characters. `SESSION_SECRET` is no longer accepted.
- `BETTER_AUTH_URL`: optional; defaults to `FRONTEND_URL`.
- `MONGODB_CONNECTION_STRING`: MongoDB URI, e.g. `mongodb://<db-host>:27017/clozera`.
- `MONGODB_TRANSACTIONS`: `true` only when MongoDB is a replica set; default `false`.
- `EMAIL_TRANSPORT`: `resend` in production.
- `RESEND_API_KEY`: Resend API key.
- `EMAIL_FROM`: sender, e.g. `Clozera <no-reply@clozera.example>`.
- `EMAIL_REPLY_TO`: reply-to address.

Web (`web`):

- `API_INTERNAL_URL`: API base URL reachable from the web server, `http://api:3000`.
- `PORT`: set to `8080` by the image.
- `CLIENT_IP_HEADER`: header carrying exactly one visitor address from a trusted edge.
- `TRUSTED_PROXY_HOPS`: number of proxies in front of the web server that append to
  `X-Forwarded-For`. Ignored when `CLIENT_IP_HEADER` is set.

Where the visitor address comes from:

| Setup | Setting |
| --- | --- |
| Local development | both unset: the socket address is used |
| Coolify without Cloudflare | `TRUSTED_PROXY_HOPS=1` |
| Behind Cloudflare | `CLIENT_IP_HEADER=cf-connecting-ip` |

Use `cf-connecting-ip` only when the origin is reachable exclusively through Cloudflare
(Tunnel, or a Cloud Firewall allowlisting Cloudflare ranges). Otherwise anyone can forge the
header and evade rate limits. `VITE_API_BASE_URL` is no longer used.

## Database

| | A. Self-hosted MongoDB in Coolify (chosen) | B. MongoDB Atlas Free (M0) as primary | C. Self-hosted plus Atlas Free as a nightly copy |
| --- | --- | --- | --- |
| Latency | Same machine | Extra network hop; pick an AWS Frankfurt region near Hetzner DE | Same machine |
| Limits | VPS disk and RAM only | Official limits page: 100 operations/second, storage size not configurable, transfer capped per rolling 7 days. Third-party sources say 512 MB storage; verify on the official page | Copy bounded by M0 limits |
| Transactions (`MONGODB_TRANSACTIONS`) | Off on a standalone server, unless MongoDB runs as a single-node replica set | On (Atlas is always a replica set) | Off (or replica set) |
| Backups | Coolify scheduled backups support MongoDB (mongodump archive) uploaded to S3-compatible storage; Cloudflare R2 is a documented target; separate local and S3 retention | Official docs now allow backups on Free clusters (daily snapshot, up to 4 kept); older docs said no, so verify. Keep your own exports | A mirror is not a backup: a bad delete or corruption is copied over on the next sync |
| Operations work | You own updates, disk and backups | Least work | Most work |

Decision: **A**, see [ADR 0004](../docs/adr/0004-host-mongodb-on-the-vps-with-r2-backups.md).
Why not B: the 100 operations/second cap is shared by every page load, the shared cluster
adds latency to every query, and you would still want your own off-site exports. Why not C:
it only adds a warm standby, never a substitute for versioned archives. It can be added on
top of A later.

Backups: Coolify scheduled backups of the MongoDB resource to Cloudflare R2, daily, with
retention of 7 local and 30 in R2 (new schedules keep everything until limits are set).
Once a month, restore the latest R2 dump into a scratch database and check it (open the app
against it, or at least count collections). Watch the first scheduled backup after every
Coolify upgrade: a reported Coolify issue stopped scheduled MongoDB backups to R2 after an
upgrade until a manual backup ran.

Transactions without Atlas (optional): run the Coolify MongoDB as a single-node replica set,
then set `MONGODB_TRANSACTIONS=true`. Today transactions only make Better Auth's sign-up
write the user and the account atomically. Without them, a crash between the two writes can
leave a user without credentials, who can recover with "Forgot password". The operator must
check whether Coolify's MongoDB resource can be configured as a replica set; if not, leave
transactions off.

Coolify's scheduled backups apply to MongoDB created as a Coolify Database resource. The
`api` service, which lives in the Compose resource, must reach it over a shared Docker
network. Coolify shows an internal URL for the database, and Compose resources may need
"Connect to predefined network" enabled.

## First deploy checklist

1. Hetzner: create the VPS, then a Hetzner Cloud Firewall with inbound SSH from your IP only.
   With a Tunnel, allow no inbound 80/443. With proxied DNS, allow 80/443 only from
   Cloudflare's IP ranges.
2. Coolify: install it, then create the Cloudflare Tunnel following Coolify's "all resources"
   guide (wildcard hostname, service `http://localhost:80`, SSL Full (strict)).
3. R2: create a bucket and an API token scoped to it (Object Read & Write). Add it in Coolify
   as S3 storage (endpoint, access key, secret, default region).
4. MongoDB: create a Coolify MongoDB Database resource (`mongo:8`) with no public port. Enable
   scheduled backups to R2 (daily; retention 7 local / 30 in R2). Run one manual backup to
   confirm it lands in R2. Make sure the Compose resource can reach the database's internal
   URL (shared network). Optional: replica set, then `MONGODB_TRANSACTIONS=true`.
5. App: create a Docker Compose resource from this repository with
   `docker-compose.coolify.yml`. Set the domain on `web` only, enter the API variables as
   secrets, and deploy.
6. Verify the edge: `curl -sI https://<domain>/` returns 200 with a `cf-ray` header. The API
   is unreachable from outside (the VPS IP times out on any port). Eleven wrong-password
   logins from one network answer 429 on the 11th, and logging in from a phone on mobile
   data still works.
7. Seed: run `npm run admin:upsert` and `npm run seed:initials` once inside the `api`
   container, with `ADMIN_*` set for that run.
8. Monthly: restore the latest R2 dump into a scratch database and check it.

## Upgrading existing installations

Upgrade order for an existing environment:

1. Deploy the API with `BETTER_AUTH_SECRET` and the web app with `API_INTERNAL_URL`.
2. Run `npm run auth:migrate-legacy -w backend` against the database, review the dry run,
   then run it again with `-- --apply --notify`.
3. Optionally drop the unused `sessions` collection.
