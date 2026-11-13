## Engineering notes

<!-- How we build: docs/engineering/FIELD_READY.md (skill: field-ready). Short tables and links, not essays. CI warns when a section is empty; it never blocks. Write "n/a: why" when a section does not apply. -->

- [ ] Small fix: one thing, no new outside piece or boundary. Fill only sections 2 and 6, for what it touches.

### 1. Brief

<!-- Who uses it, where (office or home), on what (Mac, Windows, browser, which boxes), which disk, whether their own Claude drives it. The FIELD_CONDITIONS.md rows that apply, by ID (e.g. FC-NET-1, FC-PROC-1). -->

### 2. Read before you write

<!-- Each outside piece: what it does when slow, dead, half-finished or given odd input. Proof per row: a docs or source link. A row with no proof is an open question. Also: the code path you read end to end, and every caller. -->

| Outside piece | Slow, dead, half-finished, odd input | Proof |
|---|---|---|

### 3. Dry run and invariants

<!-- The code path walked by hand for each picked row: what each call returns when it hangs, errors or returns half, and what happens if the process dies there. The invariants you found (what must always be true). -->

| Boundary | Hangs | Returns half | Error | Process dies here |
|---|---|---|---|---|

Premortem (required for network, retry, timeout, quit, disk or process changes; "n/a: why" otherwise):

| Tiger | Fixed or disproved, with proof |
|---|---|

### 4. Questions VV answered

<!-- The product choices you would otherwise have guessed, with VV's answers or a link. "None: no product choice" is fine. -->

### 5. Built to be debuggable

<!-- Where the guard sits so the whole class is fixed (the shared boundary, not one caller). Assertions added. Limits read from Central config. Debug log lines at boundaries. Telemetry events for failure paths. -->

### 6. Debugger run

<!-- Dev build under the debugger on the real path. Breakpoints set, what you broke at each (value set, pause held, process killed) and what you saw. Paste the breakpoints.mjs output if you used it. -->

### 7. Tests and release

<!-- Tests that lock in what sections 3 and 6 taught you. If this fixes a release from the last 24 hours: which step missed it, and the FIELD_CONDITIONS.md row added. -->
