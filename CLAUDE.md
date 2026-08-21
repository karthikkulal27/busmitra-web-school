# BusMitra — project rules

School bus tracking for schools in coastal Karnataka. Solo developer, evenings. Ship a working spine before anything pretty.

## The one hard rule

The product is a dot that keeps moving. Everything else is secondary. If a change risks the reliability of position reporting from a low-end Android phone in a moving bus, don't make it.

## Stack — do not substitute

| Layer | Choice |
|---|---|
| Server | Node 20 + Express + socket.io |
| Language | TypeScript, strict mode, ESM |
| Database | PostgreSQL (Supabase), PostGIS enabled |
| Query layer | `pg` with plain SQL. No ORM. |
| Cache / live state | Redis (Upstash) |
| Queue | BullMQ on Redis |
| Hosting | Render, Starter instance (never free tier — it sleeps, and websockets die) |
| Web consoles | React 18 + Vite + TypeScript + Tailwind + TanStack Query + Zustand |
| Maps | MapLibre GL + self-hosted PMTiles on Cloudflare R2. No Google Maps, no Mapbox, no metered tile API. |
| Mobile | Flutter (driver + parent flavours, one repo) |
| Validation | zod at every boundary |

## Non-negotiable engineering rules

1. **Never write one DB row per location tick.** Buffer positions in memory, flush a single multi-row INSERT every 10 seconds. At 164 buses a per-tick write pattern will exhaust the connection pool.
2. **Live reads come from Redis, never Postgres.** Postgres holds history. Redis holds "where is bus 42 right now".
3. **The ingest path does nothing but validate and buffer.** Geofence checks, overspeed, delay maths, notifications — all go on the BullMQ queue. If the alert worker dies, buses must keep reporting.
4. **No tap in the driver app ever awaits the network.** Write to local SQLite, return immediately, sync in background. Never show the driver a spinner.
5. **`boardings` is append-only.** Never UPDATE or DELETE a row. It is the legal record if a child ever goes missing.
6. **`locations` is partitioned by month.** Retention is 90 days, enforced by DROP PARTITION, never DELETE.
7. **Every timestamp is `timestamptz`, stored UTC.** Display in Asia/Kolkata.
8. **Money is integer paise.** Never a float.

## Design tokens (from the approved prototypes)

```
ink      #16202E   text, dark surfaces, primary buttons
ink2     #243347
slate    #63748C   secondary text
line     #DCE2EA   borders
paper    #EFF1F5   app background
bus      #FFC53D   live / active state, primary action in driver app
live     #1E9E6A   running, on time, boarded
alert    #D8442F   late, SOS, not boarded
```

Type: Archivo Narrow (headings, labels), Public Sans (body), IBM Plex Mono (times, plates, IDs, all numeric data).
Radius 12px cards, 9px buttons. The chequer strip (6px, yellow/ink alternating) marks live vehicle contexts only.

## Screen references

Prototype HTML files live in `/docs/prototypes/`. Screens are referenced by code:
- `SA-01`..`SA-13` — school console
- `PA-01`..`PA-10` — operator console
- `DR-01`..`DR-10` — driver app
- `PR-01`..`PR-05` — parent app

When asked to build a screen, read the matching prototype file first. It is the spec.

## Driver app rules

- Every label is **Kannada first, English second, on the same line**. Not a language setting — both, always.
- One primary action per screen, thumb-sized, bottom of the screen.
- No free text input anywhere. Fixed reason codes only.
- Assume 2G dead zones on the Surathkal–Mulki stretch. Offline-first, always.

## Repo layout

```
/server        Node + Express + socket.io + BullMQ workers
/web-school    React console for schools (SA-*)
/web-console   React console for operator (PA-*)
/mobile        Flutter, driver + parent flavours
/db            SQL migrations, numbered, forward-only
/docs          prototypes, plan.md
```

## How to work with me

- Do one milestone at a time. Stop and report at the end of each; do not run ahead into the next.
- Write the SQL migration before the code that uses it.
- No mock data in committed code. Seed data goes in `/db/seed.sql` only.
- Explain any deviation from these rules before making it, not after.
