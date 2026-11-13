# videovault-release-updates: agent instructions

## Engineering: field-ready before code

Every change follows `docs/engineering/FIELD_READY.md` (skill `.claude/skills/field-ready`): read how each outside piece behaves from its docs or source, dry run the code by hand, ask VV the product questions before code, build it debuggable, step through the real path in a debugger, tests last, one release when VV asks. Debug tools stay in dev builds; customers never get them. Source is `aeoslabs/videovault-hq/engineering/`: never edit the copies here, change hq and run `node engineering/tools/sync.mjs <this repo>`.

No em dashes anywhere you write.
