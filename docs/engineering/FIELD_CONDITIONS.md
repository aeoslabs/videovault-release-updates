# Field conditions

What the real world does to our software, across the whole product. Steps 1, 3 and 6 of `FIELD_READY.md` use this list: pick the rows that apply, walk the code with each one in the dry run, and break the real path the same way at a breakpoint.

Every row comes from a real incident. A new field issue adds a row in the same PR as its fix. IDs never change or get reused; the CI check reads them.

"Applies to": C = Connect, S = server (web app, API, workers on a box), W = web app in a browser, X = editor extensions, CO = Central.

## Network and remote

| ID | Condition | Applies to | Came from | Cheapest way to check |
|---|---|---|---|---|
| FC-NET-1 | Editor at home: 1 to 10 Mbps, high latency | C, X, W | Soham, slow drive, 10 to 12 Nov 2026 | Dry run with a read that takes minutes; breakpoint holding the read (`pauseMs`) |
| FC-NET-2 | The other side stops answering mid-operation | C, S, X | Mac froze with Connect closed, 12 Nov 2026 | Breakpoint in the call, kill the other process while paused |
| FC-NET-3 | First answer takes longer than our timeout | C, S | "Operation timed out" on Connect 1.3.289 | Read the timeout's source; hold a breakpoint past it |
| FC-NET-4 | A box is flaky or offline (router DNS, Tailscale, power) | S, C, CO | POD1 flaky link; LF2 router DNS, 10 Nov 2026 | Dry run every call to the box with "no answer"; check what the user sees |
| FC-NET-5 | Cloudflare tunnel or Worker in the path changes or drops requests | S, W | Review link downloads, LF2, 10 Nov 2026 | Read the Worker code; dry run with a cut or replayed request |

## Processes and deploys

| ID | Condition | Applies to | Came from | Cheapest way to check |
|---|---|---|---|---|
| FC-PROC-1 | The process quits, crashes or updates mid-work | C, S | Drive hang when Connect quit, 12 Nov 2026 | Breakpoint mid-work, kill the paused process, restart, read the state |
| FC-PROC-2 | A deploy lands while jobs or sockets are in flight | S | Stale socket bind-mount; in-flight BullMQ job lost after a queue split | Read `TOPOLOGY_MIGRATION_SAFETY_PATTERN.md`; dry run old and new code side by side |
| FC-PROC-3 | TrueNAS middleware is slow, locked or restarting (large smb.db WAL) | S | LF1 backup stuck since 18 Oct 2026 on a TrueNAS lock | Dry run every middleware call with "hangs" and "errors"; read the middleware docs |

## Disk and data

| ID | Condition | Applies to | Came from | Cheapest way to check |
|---|---|---|---|---|
| FC-DISK-1 | Disk nearly full, or smaller than we assumed | C, S | 191 GB cache reserve on a disk with 98 GB free, 10 Nov 2026; POD1 pool 98% full | Set the free-space variable at a breakpoint (`do`) |
| FC-DISK-2 | External disk unplugged or read-only | C | Cache on "Veer (W+M)" | Breakpoint before the write, detach a disk image, resume |
| FC-DISK-3 | Partial files that look complete (sparse cache) | C | Premiere black frames, 12 Nov 2026 | Read the dependency's docs; assertion that nothing reads the cache folder |
| FC-DISK-4 | A pool is degraded or has no redundancy | S | POD1 raidz1 degraded; Hustle stripe with no redundancy | Read `zpool status` handling; dry run with a pool in DEGRADED |

## Names and input

| ID | Condition | Applies to | Came from | Cheapest way to check |
|---|---|---|---|---|
| FC-NAME-1 | Mac names ending in a space or a dot (U+F028, U+F029 over SMB) | C, S, X | "Raw Footage ", 12 Nov 2026; 5 Predictions, 15 Oct 2026 | Find the shared path boundary; dry run with that name through every caller |
| FC-NAME-2 | Other odd names: Unicode NFD, emoji, long paths, Windows reserved names | C, S, X | Push refusals, Oct 2026 | Same, with each name |
| FC-NAME-3 | A folder the user points us at was renamed or deleted | S, C | Remote Sync tasks on renamed folders, Hustle and POD1 | Dry run with the path gone; what the user sees and what recovers it |
| FC-AI-1 | The user's own Claude or Codex calls our tools | C, S | Make Offline failed from Claude, 12 Nov 2026 | Dry run with the input a model really types (plain spaces, partial paths) |

## Accounts and access

| ID | Condition | Applies to | Came from | Cheapest way to check |
|---|---|---|---|---|
| FC-AUTH-1 | A sign-in or token expired (Google Drive, session, R2 key) | S, C, CO | LF2 "open_ai_backup" Drive sign-in expired, 31 Oct 2026 | Breakpoint before the call, set the token to an expired one (`do`) |
| FC-AUTH-2 | The user lacks permission on a folder or project | S, C, W | Project folder everyone-access lock, 6 Nov 2026 | Dry run as a member without access |

## Releases and rollout

| ID | Condition | Applies to | Came from | Cheapest way to check |
|---|---|---|---|---|
| FC-REL-1 | Two releases within hours; old app with new server, or new app with old server | C, S, X | Update stuck on the first download; 15 Connect releases in 3 days | Read electron-updater's source for the pending download; dry run each version pair |
| FC-ROLL-1 | A feature reaches only some boxes or branches | S, C | LF2 missing direct transfer, 10 Nov 2026 | Check every client stack.yml and every `client/*` branch in the brief |
| FC-CONF-1 | A limit is wrong for one customer and needs a new build to change | C, S | Read timeout, 1.3.290 was a build to change one number | Limit comes from Central config; change it there in the debug run |

## Screens

| ID | Condition | Applies to | Came from | Cheapest way to check |
|---|---|---|---|---|
| FC-UI-1 | What the user sees outside our app: Finder sidebar, Explorer, notifications | C | "localhost" in Finder | Read how the OS names it (docs) before building |
| FC-UI-2 | Phone width, dark mode, long names | W, C | Agentic editor double scrollbars, 27 Oct 2026; phone-width ask, 6 Nov 2026 | Design system check and the screenshot set it asks for |
| FC-PLAT-1 | Mac and Windows both | C, X | Every Connect issue | Dry run each OS branch of the code; say which OS the debug run used |

## Adding a row

- ID: `FC-<AREA>-<n>`, next free number in the area. A new area is fine when none fits.
- Condition: what the world did, not what our code did wrong.
- Came from: the incident, with a date.
- Cheapest way to check: docs or source first, then the dry run, then a breakpoint. Only then a test.
