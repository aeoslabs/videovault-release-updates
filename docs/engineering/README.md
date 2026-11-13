# Engineering: field-ready

How we build features so they work in the field the first time. Start with [FIELD_READY.md](FIELD_READY.md).

| File | What it is |
|---|---|
| [FIELD_READY.md](FIELD_READY.md) | The 7 steps, the 15-release run that led to them, how to debug each part, VV's decisions |
| [FIELD_CONDITIONS.md](FIELD_CONDITIONS.md) | What the real world does to the whole product (Connect, server, web, extensions, Central), one row per real incident |
| [PR_NOTES.md](PR_NOTES.md) | The "Engineering notes" section every app's PR template carries |
| `skills/field-ready/` | Our skill: walks the 7 steps and asks VV the product questions |
| `skills/premortem/` | From parcadei/Continuous-Claude-v3 (MIT, d07ff4b): verified risks, used at the end of the dry run |
| `skills/brainstorming/` | From obra/superpowers (MIT, 22f0b46): the brief and the questions, steps 1 and 4 |
| `skills/verification-before-completion/` | From obra/superpowers: no "done" without fresh evidence, steps 6 and 7 |
| `skills/systematic-debugging/` | From obra/superpowers: root cause first, for every field issue |
| `tools/breakpoints.mjs` | Breakpoints for agents: attach to `--inspect`, print values, set state, hold a pause; one line per hit |
| `tools/field-check.mjs` | The CI check. Warns on missing notes, never fails |
| `tools/sync.mjs` | Copies all of this into an app |

The third-party skills are installed as named skills only, with no hooks, the same way ponytail was. Each starts with a "VideoVault notes" block saying how it differs here; brainstorming's description was narrowed so it does not fire on every task. Their licences sit next to each SKILL.md.

To update an app after changing anything here:

```
node engineering/tools/sync.mjs ../VideoVault-Desktop-App
node engineering/tools/sync.mjs ../video-vault
```

`--check` tells you whether an app is behind.
