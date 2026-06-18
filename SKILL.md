---
name: ahnenwerk-json-creation
description: >-
  Author an Ahnenwerk setting JSON file — the per-setting genealogy document
  that the Ahnenwerk family-tree app (https://ahnenwerk.app) loads via its
  "Import JSON" button. Use this whenever you want to turn a described family,
  lineage, dynasty, or set of genealogical relationships into an importable
  Ahnenwerk file, or when someone says "build an Ahnenwerk setting", "make a
  genealogy JSON", "create a family tree for the genealogy tool", "add these
  people/births/marriages to Ahnenwerk", or hands over a family description and
  wants it turned into the tool's format. Also use when editing or extending an
  existing Ahnenwerk JSON (adding people or events, fixing references). Covers
  the event-sourced model and all twelve event types — births, deaths,
  marriages, divorces, adoptions, fusions, defusions, body swaps,
  reincarnations, possessions, custom events, and titles / lines of succession —
  including the exotic cases.
---

# Ahnenwerk setting JSON

Ahnenwerk is a worldbuilding family-tree tool for fictional genealogies. A
"setting" is one genealogy, stored as a single JSON file. The app at
**https://ahnenwerk.app** loads a setting via **Import JSON…** on the picker
screen (it asks for a setting id, then opens the tree). This skill turns a
described genealogy into a valid, import-ready file.

## The one idea that matters: event sourcing

Persons are **thin records** — just identity (id, name, kind, optional house).
**Every relationship lives in an event**, never on the person. There is no
`parents` field on a person and no `children` array anywhere; the app *derives*
the whole tree from the event list. So "Alice is Bob's mother" is encoded as a
`birth` event for Bob that lists Alice as a parent — not as a property of either
person. Get this right and everything else follows.

This matters because it's what lets the tool handle the weird cases cleanly: a
person can gain parents, marry, divorce, be adopted, fuse with another person,
later defuse, swap bodies — all just events on a timeline, with the graph
recomputed each time.

## File shape

```json
{
  "setting": "Display Name",
  "calendar": { "granularity": "year", "eraLabel": "AE", "negativeEraLabel": "VZ" },
  "persons": [ /* thin records */ ],
  "events":  [ /* all relationships */ ],
  "titles":  [ /* optional: lines of succession */ ]
}
```

Do **not** add `schemaVersion`, `revision`, or `updatedAt` — the app stamps
those on first save. Negative years mean pre-era (`negativeEraLabel`).

## IDs

Stable, zero-padded, sequential, never reused:
- persons → `p_001`, `p_002`, …
- entities (non-person things that can still parent — an artifact, a god, a
  concept) → `ent_001`, …
- events → `e_001`, …
- titles (lines of succession) → `t_001`, …

Assign ids as you place each person/event and reference them everywhere by id.

## Workflow

1. **Gather** the genealogy: the people (and any non-person entities), which
   house/family each belongs to, the calendar style (year-only is the common
   case), and the relationships as a timeline of events. Ask only for what you
   genuinely need — if you're given a prose family description, infer the events
   from it and confirm the non-obvious ones.
2. **Assign ids** to every person/entity, then to every event.
3. **Write the events.** Each relationship → one event. See
   `references/schema.md` for the exact field shape of every event type and a
   couple of worked examples (including a fusion and a three-parent birth with
   an entity). Read it whenever you're unsure of a field — it's the source of
   truth, mirrored from the app's `src/lib/types.ts`.
4. **Validate** before handing it over (catches the mistakes that make an import
   look broken — a birth pointing at a person id that doesn't exist, a marriage
   with one participant, a self-parent):
   ```
   node scripts/validate.mjs <path-to-your-file>.json
   ```
   Fix every `✗`; `⚠` lines are advisory. The app only does a light check on
   import, so this script is your real safety net.
5. **Deliver**: save the file (suggest `<setting-id>.json`) and open the app →
   **Import JSON…** → pick the file → choose a setting id. If the id already
   exists it asks before overwriting.

## Editing an existing setting — decode first

When the task is to edit or extend a file that already exists (rather than author
a fresh one), **read and restate the current state before changing it.** A raw
event list doesn't show the derived genealogy, and the exotic cases (fusion
chains, reincarnation links, who currently holds a title) are exactly where a
blind edit goes wrong.

Before writing any change:
1. **Decode** the file in plain language — for each person, their derived
   relations (parents, children, spouses), plus current title holders, active
   fusions / possessions, and reincarnation links. Walk the events in date order
   the way the app's `deriveGraph` does: a `fusion` ends its inputs, a `defusion`
   restores them, `succession` mutates the holder set (`hold` replaces /
   `cohold` adds / `end` removes), and a death / fusion-end / defusion-end ends a
   tenure automatically.
2. **Confirm** that restatement and the specific change — especially anything
   touching an exotic case — *before* editing.
3. Make the edit with **stable ids** (never reuse a retired id), then
   **re-validate the whole file** (`node scripts/validate.mjs <file>.json`).

This is a read-and-confirm step, not a separate tool — it just keeps an edit
grounded in what the file actually derives to.

## Field quick-reference

**Person** — `id`, `name`, `kind` (`"person"` | `"entity"`) are required.
Optional: `regnalName` (throne/reign name — shown by DEFAULT when set),
`nickname` (informal name; shown in the nickname view), `family` (house
grouping; drives node color + far-zoom labels), `docId` (optional id of an
external page for this person in your own wiki/notes — persons without one get a
stub in the Markdown export), `meta.note` (free text shown in the side panel).
Omit `portrait` (set inside the app) and `pin` (layout is automatic).

**Title** — optional `titles[]`, the lines of succession. `id` (`t_###`) and
`name` required; optional `family`, `note`; no `docId`. Who holds it when is
**derived from `succession` events**, never stored on the title.

**Event** — every event has `id` and `type`; `date` ({year, optional month/day})
and `note` are optional on all of them. Type-specific fields:

| type | fields | meaning |
|---|---|---|
| `birth` | `person`, `parents[]` | 0–n parents (persons or entities); person ≠ a parent of itself |
| `death` | `person` | |
| `marriage` / `divorce` | `persons[]` | ≥ 2 participants |
| `adoption` | `person`, `parents[]` | adoptive parents |
| `fusion` | `inputs[]`, `output` | inputs merge **into** output; inputs become "ended-by-fusion" (not deleted) |
| `defusion` | `input`, `outputs[]` | input ends; outputs restored (a previously-fused input returns; a brand-new output hangs one generation below) |
| `bodyswap` | `persons[]` | ≥ 2 participants |
| `reincarnation` | `from`, `to` | soul continues `from` a past life `to` a new one; directional 1:1; ends nobody |
| `possession` | `possessor`, `host`, `action` | `action` = `seize` \| `release`; possessor may be a person or entity; a seize + later release = an interval |
| `custom` | `label`, `persons[]` | free-text event, ≥ 1 person |
| `succession` | `title`, `persons[]`, `action` | `action` = `hold` \| `cohold` \| `end`; `title` → a `titles[].id`; optional `label` ("Coronation") |

Full detail, edge cases, and examples: **`references/schema.md`**.
