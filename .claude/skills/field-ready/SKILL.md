---
name: field-ready
description: Use before writing code for any VideoVault change beyond a one-liner, in any repo (Connect, server, web app, extensions, Central), and for every field issue from a customer or editor. Walks the 7 field-ready steps: brief with field conditions, read how each outside piece behaves, dry run the code by hand, product questions to VV, build it debuggable, step through it in a debugger breaking things at breakpoints, then tests and one release. Fills the PR's Engineering notes.
---

# Field-ready

The goal is a release that just works, so there is no second release to fix the first. That comes from understanding, not from testing until things stop failing: it is all logic. Use the practices developers have always used: read the docs and the source, walk the code by hand, put assertions on what must be true, and step through the real path in a debugger. Big test matrices and long screen-driven runs are not part of this.

Read `FIELD_READY.md` (in an app: `docs/engineering/FIELD_READY.md`) and `FIELD_CONDITIONS.md` next to it.

## Small fix or not?

A small fix touches one thing and adds no new outside piece or boundary. Do steps 2 and 6 for what it touches, tick "Small fix" in the PR, fill sections 2 and 6, done. Everything else runs every step.

## 1. Brief

Who uses it, where (office LAN or home internet), on what (Mac, Windows, browser, which boxes), which disk, whether their own Claude or Codex drives it, which branches and boxes it must reach (Connect `main` and every `client/*` that ships it; every box's stack). Then pick the `FIELD_CONDITIONS.md` rows that apply, by ID. When unsure whether a row applies, include it: the dry run decides cheaply.

## 2. Read before you write

For every outside piece the change touches, find out what it does when slow, dead, half-finished, or given odd input. Proof only from the docs (link and line), the source (file and line, in its repo or `node_modules`), or a debugger run. Never from memory. A behaviour without proof is an open question; settle it before step 3.

Then read our own code path end to end: entry point to every side effect, and every other caller of the functions you will change (`grep` them all). Most repeat bugs were one caller fixed while another kept the old behaviour.

## 3. Dry run on paper

Walk the code path line by line with concrete values, once for each picked row. Write a trace table in your notes:

```
line                          | FC-DISK-1 (98 GB free)        | FC-PROC-1 (quit mid-copy)
free = statfs(cache)          | 98 GB                         | 98 GB
reserve = 191 GB              | reserve > free: evicts ALL    | -
copy(file)                    | -                             | half-written file left
```

For each boundary (a call across the network, to another process, or to the disk) write what happens when it hangs, returns half, errors, and when our process dies on that line. Each odd cell is a bug found before it was written. As you go, write the invariants: statements that must always hold (`reserve < free`, "nothing reads the cache folder", "every path goes through toServerName()"). Then run the `premortem` skill on the plan.

Every number in a boundary (timeout, size, reserve) is a product choice for step 4, unless the source dictates it.

## 4. Questions to VV, before code

Every product choice you would otherwise guess: how long to wait, what the editor sees, stop or warn, on by default or not, which boxes or branches. ONE message, most important first, each with options and your pick. Technical facts are never asked (that is step 2). Keep working on what does not depend on the answers; do not merge what does.

## 5. Build it debuggable

- **Fix the class.** Put the guard at the shared boundary every caller goes through, not in the caller that broke.
- **Assertions** for each invariant from step 3: throw in dev builds; in customer builds only a log line and a Central event. Debug tools never ship to customers. They turn a silent wrong state into an exact line.
- **Debug log lines** at every boundary (what went in, what came out, how long it took), at debug level, so a dev build shows the whole path.
- **Limits from Central config,** not constants, so a customer-specific number is a config change, not a release.
- **Telemetry** to Central for every failure path from step 3.

## 6. Step through it in a debugger

Run the dev build under the debugger on the real path once (how, per part: the table in `FIELD_READY.md`). Set breakpoints at each boundary from step 3 and, at each one, read the state and break things on purpose:

- set a variable to what the field gives (disk nearly full, an expired token, an empty reply, a name ending in U+F028),
- hold the pause to make a call hang (`pauseMs`),
- kill the process while it is paused, restart, and read what is left.

`tools/breakpoints.mjs` does this from a JSON plan and prints one line per hit, so it costs few tokens:

```json
[
  { "at": "const free = statfs", "print": ["free", "reserve"], "do": "free = 98e9", "hits": 1 },
  { "at": "await copyFile\\(", "pauseMs": 60000, "hits": 1 }
]
```

`node docs/engineering/tools/breakpoints.mjs plan.json --port 9229`. "NEVER HIT" means the path you think runs does not: that is a finding. If what you see differs from step 2 or 3, go back there; do not patch around it.

## 7. Lock it in, release once

Tests only for what steps 3 and 6 taught you (each picked row the code handles), small and fast. Before saying it is done, `verification-before-completion`: fresh test output and the debugger run, never "should work". Batch fixes into one release. If this fixes a release from the last 24 hours, write which step missed it and add the `FIELD_CONDITIONS.md` row.

## Field issues

`systematic-debugging` first: reproduce it under the debugger, or read the user's debug log, before changing code. Find the class (every caller that meets the same condition), fix it at the shared boundary, and add or cite the row. Also open the product fix, not only a workaround.

## The PR

Copy short notes into the "Engineering notes" section of the PR template: tables, links and the breakpoints output, not essays. CI warns on gaps and never blocks.
