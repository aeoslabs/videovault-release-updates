# Field-ready engineering: releases that just work

For every change in every part of the product: Connect, the server (web app, API, workers), the extensions, Central. The goal is one release that works, not a run of releases that each fix the last.

**Why.** Soham needed 15 Connect releases in 3 days (1.3.277 to 1.3.291, 10 to 12 Nov 2026, four of them in two hours on 12 Nov). None of the fixes needed a cleverer test suite. They needed the old practices: read how the thing you call really behaves, walk your code by hand, and step through it in a debugger before shipping.

| Release run | What it fixed | Practice that would have caught it first |
|---|---|---|
| 1.3.277, 1.3.278 (twice) | Finder showed "localhost" | Read how macOS names an NFS mount (docs) |
| 1.3.279 | Make Offline ran out of disk hours in | Dry run with "disk nearly full" (FC-DISK-1) |
| 1.3.281 | Premiere black frames from sparse cache | Read rclone's VFS cache docs |
| 1.3.288 | Mac froze when the drive died | `man mount_nfs`: hard mount by default |
| 1.3.289 | Drive died when Connect quit | Breakpoint, then kill the paused process (FC-PROC-1) |
| 1.3.290 | Reads from home timed out | Timeout as a Central setting, not a constant; breakpoint holding the read |
| 1.3.291 | Claude could not find "Raw Footage " | Fix the class at the shared path boundary, not one caller (FC-NAME-1, known since 15 Oct) |

## The steps

The `field-ready` skill walks them. Each leaves a short note in the PR's "Engineering notes". CI warns on a missing note and never blocks.

| Step | What you do | Costs |
|---|---|---|
| 1. Brief | Who uses it, where (office or home), on what (Mac, Windows, browser, which box), which disk, whether their own Claude drives it. Pick the rows of `FIELD_CONDITIONS.md` that apply. | Minutes |
| 2. Read before you write | For every outside piece (rclone, NFS, SMB, TrueNAS middleware, BullMQ, Redis, Postgres, Cloudflare, electron-updater, Premiere, Central, Claude): what it does when slow, dead, half-finished or given odd input. Proof is a docs or source link, never memory. Then read our own code path end to end, every caller. | Reading |
| 3. Dry run on paper | Walk the code path line by line with concrete values for each picked row, as a trace table: what each variable holds, what each call returns when it hangs, errors or returns half, what happens if the process dies on this line. Write down the invariants (what must always be true) as you go. Run `premortem` on the result. | Reading |
| 4. Questions to VV | Every product choice you would otherwise guess (how long to wait, what the editor sees, stop or warn), in one message with your pick. Technical facts are never asked. | One message |
| 5. Write it debuggable | Fix the class, not the instance: put the guard at the shared boundary every caller goes through. Assertions for the step 3 invariants (throw in dev builds; in customer builds a log line and a Central event only). A debug-level log line at every boundary. Limits (timeouts, sizes, reserves) come from Central config, so changing one is not a release. Every failure path sends an event to Central. | Code |
| 6. Step through it | Run the dev build under the debugger on the real path once. Breakpoints at each boundary; at a breakpoint read the state and break things on purpose: set the variable to what the field gives (disk full, empty reply, odd name), hold the pause to make it hang, kill the paused process. `tools/breakpoints.mjs` does this from a plan file and prints one line per hit. | One sitting |
| 7. Lock in, then release once | Tests only for what steps 3 and 6 taught you. One release per batch. A release that fixes a release from the last 24 hours needs a root-cause note naming the step that missed it, and adds a `FIELD_CONDITIONS.md` row. | Minutes |

Not part of the process: big test matrices, slowed-network rigs, or long screen-driven runs on ys-mac-mini. The debugger and the dry run find the same things for a fraction of the time and tokens.

## Small fixes

A small fix touches one thing and adds no new outside piece or boundary. It skips the notes, but still does steps 2 and 6 for what it touches (read the piece, step through the change once), because it must be reliable. Tick "Small fix" in the PR and fill sections 2 and 6.

## Field issues

`systematic-debugging` first: reproduce it under the debugger or from the user's debug log before changing code. Then find the class (every caller that meets the same condition) and fix it at the shared boundary. The same PR adds or cites the `FIELD_CONDITIONS.md` row.

## How to debug each part

| Part | Debugger (dev only) | Logs |
|---|---|---|
| Connect main process | `npx electron-vite dev --inspect=9229` on the dev machine, then `breakpoints.mjs plan.json --port 9229` or Chrome `chrome://inspect` (check the flag with `npx electron-vite --help` on first use) | Dev build logs at debug level; Connect's `logs` folder |
| Connect drive helper | Its own process: the dev build should start it with `--inspect=9230` (to build) | `drive-helper.log`, `streaming-drive.log` |
| Connect windows | DevTools in the dev build | Renderer console |
| Server app and workers | RnD hot-reload containers with `NODE_OPTIONS=--inspect=0.0.0.0:9229` and the port published (to set up) | `LOG_LEVEL=debug`; box logs through `ssh-nas` |
| Central | `next dev` locally with `--inspect` | Vercel logs |

## Still to build so these steps are cheap

| What | Where | Status |
|---|---|---|
| Verbose drive and updater logs in the dev build | Connect main and client/yaas | To build |
| Drive helper under `--inspect=9230` in the dev build | Connect | To build |
| Limits read from Central config instead of constants | Connect, server | Per feature, as each is touched |
| Inspector port on RnD dev containers | video-vault dev env | To set up |

## VV's decisions (13 Nov 2026)

- CI warns, never blocks.
- Applies to all engineering across the product, Connect and video-vault first.
- VV answers the product questions, before code.
- No slowed-network rig or heavy test runs on ys-mac-mini; classic debugging instead (breakpoints, debugger, dev builds).
- Debug mode is for us in development only. Nothing debug-related ships in a customer build: no switch, no Central flag, no "Send logs".
- Detailed logs and failure telemetry are fine while a feature is new (like the streaming drive). Once it is stable, only feature-usage telemetry stays.
- Small fixes skip the notes, but must be reliable.

## Where this lives

Source: `videovault-hq/engineering/`. `node engineering/tools/sync.mjs <app repo>` copies the docs and tools to `docs/engineering/` and the skills to `.claude/skills/`. Never edit the copies in an app.
