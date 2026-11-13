---
name: blind-review
description: Use before merging any PR that will go into a release (Connect, server image, extension, Central). Hands the diff and FIELD_CONDITIONS.md to a fresh reviewer agent that never sees the author's reasoning, and asks it to break the change. Cheap (one Sonnet-sized review, about 20k to 40k tokens); skip for docs-only PRs.
---

# Blind review

The author argues themselves out of the failures they did not think of. A reviewer who sees only the change, not the reasoning, does not.

## When

- Every PR that a release will carry, before it merges.
- Not for docs-only changes, and not twice for the same head commit.

## How

1. Collect only these, in a scratch folder:
   - the diff: `git diff origin/<base>...HEAD`
   - `docs/engineering/FIELD_CONDITIONS.md`
   - the full text of each changed file (the reviewer needs the code around the diff, not just the lines)
2. Start ONE fresh subagent (route `verifier`, or a general agent; never a fork, which carries your context). Do not pass the PR description, the Engineering notes, your plan or any summary of why the change is right. The prompt is exactly:

   > You are reviewing a change to VideoVault, which editors use on Macs and PCs, at the office or from home, against a NAS server. Files: the diff, the changed files, and FIELD_CONDITIONS.md (what the real world does to our software). Try to break this change. For each field condition that applies, walk the changed code with it: slow or dead network, our process killed mid-way, disk full, odd names (trailing space, U+F028), expired login, two copies running, an update mid-operation. Report only failures you can show with a concrete input and the line it goes wrong on, most severe first, at most 8. Say "none found" if none.

3. For each finding: reproduce it (a test, or a breakpoint in the debugger), then fix it or answer why it cannot happen, with the line that proves it. Never dismiss a finding without that line.
4. In the PR's Engineering notes, section 3: one line per finding with its outcome (fixed in <commit>, or cannot happen because <file:line>).

## Cost

One review is about 20k to 40k input tokens and a few thousand out. Use the smaller model route; it is a reading task.
