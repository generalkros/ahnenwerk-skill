# Ahnenwerk JSON-creation skill

An agent skill for building [Ahnenwerk](https://ahnenwerk.app) setting files —
the JSON a fictional family tree imports. Describe a world in plain language and
an AI agent produces a valid, import-ready Ahnenwerk JSON: people, events,
titles, and all the exotic cases (fusion, defusion, reincarnation, possession,
body-swap, entity & multi-parent births).

It lives in the app's own repo, beside `src/lib/types.ts`, so the schema can't
silently drift from the tool.

## Contents

- **`SKILL.md`** — the skill: the event-sourced model, the workflow, and a field
  quick-reference for all twelve event types.
- **`references/schema.md`** — the full schema, restated from `src/lib/types.ts`,
  with worked examples (a small dynasty; the exotic cases).
- **`scripts/validate.mjs`** — a standalone validator (shape + referential
  integrity) you run before importing.

## Use it

With an agent runner (e.g. Claude Code), point the agent at `SKILL.md` and
describe your genealogy. Then validate before importing:

```
node scripts/validate.mjs your-setting.json
```

Fix every `✗` (errors block import); `⚠` lines are advisory. Then open the app →
**Import JSON…** → pick the file → choose a setting id.

## License

MIT — see [`LICENSE`](LICENSE).
