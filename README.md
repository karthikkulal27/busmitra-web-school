# BusMitra — `web-school`

School bus tracking for schools in coastal Karnataka.

This is **one of four repositories**. They are separate because they release on
different cycles — the server continuously, the consoles per deploy, the apps
through store review — but they are one product and a feature usually spans
several of them.

| Repo | What |
|---|---|
| `busmitra-server` | Node + Express + socket.io + BullMQ. Owns `db/` (the schema) and `infra/` (the tiles Worker). |
| `busmitra-web-school` | React console for schools. Screens SA-01…SA-13. |
| `busmitra-web-console` | React console for the operator. Screens PA-01…PA-10. |
| `busmitra-mobile` | Flutter monorepo — shared core, driver app, parent app. |

**The schema lives in the server repo.** Anything that changes a table changes
that repo first, and the others follow. There is no shared types package yet:
the consoles mirror the server's shapes by hand, so a field renamed on one side
and not the other is caught by nothing. Worth knowing before you rename a field.

`CLAUDE.md` is copied into each repo and is the same file in all four. Change
it in one, copy it to the rest.

See `docs/` for this repo's part of the spec. The full plan, the deployment
runbook and the verification runbook live in the server repo.
