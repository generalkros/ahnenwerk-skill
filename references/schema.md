# Ahnenwerk setting JSON — full schema

Source of truth: the app's `src/lib/types.ts` (this file ships beside it in the
repo). This document restates it for authoring. If a detail here ever disagrees
with the running app, the app wins.

## Contents
- [Top-level object](#top-level-object)
- [Calendar](#calendar)
- [Person](#person)
- [Title](#title)
- [Dates (WDate)](#dates-wdate)
- [Events](#events)
- [Worked example: small dynasty](#worked-example-small-dynasty)
- [Worked example: exotic cases](#worked-example-exotic-cases)
- [Validation rules](#validation-rules)

## Top-level object

```jsonc
{
  "setting": "Tidewater Houses",          // display name (string, required)
  "calendar": { ... },                     // required, see below
  "persons": [ ... ],                      // array, may be empty
  "events":  [ ... ],                      // array, may be empty
  "titles":  [ ... ]                       // array, optional (lines of succession)
}
```

Never hand-author `schemaVersion`, `revision`, `updatedAt` — the app adds them
on save. If you're editing a file exported from the app and they're present,
leave them; just don't invent them.

## Calendar

```jsonc
{
  "granularity": "year",        // "year" | "month" | "day"  (required)
  "eraLabel": "AE",             // optional: label for years >= 0
  "negativeEraLabel": "VZ"      // optional: label for negative years (pre-era)
}
```

`granularity` controls how much of a date the UI shows and accepts. With
`"year"`, only `date.year` is meaningful — don't add `month`/`day`. Negative
years are plain negative integers (e.g. `-120`) rendered with `negativeEraLabel`.

## Person

Thin record — identity only. No relationship fields ever.

```jsonc
{
  "id": "p_001",                 // required; p_### (person) or ent_### (entity)
  "name": "Aldric Varr",         // required, non-empty (the base / birth name)
  "kind": "person",              // required: "person" | "entity"
  "nickname": "Ald",             // optional: informal name (shown in the nickname view)
  "regnalName": "Aldric II",     // optional: throne / reign name — shown by DEFAULT when set
  "family": "Varr",              // optional: house/family grouping
  "docId": "wiki-aldric-varr",   // optional: id of this person's page in your own wiki/notes (else export makes a stub)
  "meta": { "note": "..." }      // optional: free text shown in the side panel
}
```

- **Name views.** The canvas shows one of three name modes: **regnal** (the
  default — `regnalName` when set, else `name`), **regular** (always `name`), or
  **nickname** (`nickname` when set, else `name`). Set `regnalName` for a monarch
  whose reign name should be their default label; leave it off for everyone else.
- **`kind: "entity"`** is a non-person that can still appear in the tree and act
  as a parent — an artifact, a deity, an AI, a concept. Use it when something
  non-human sits in a lineage (e.g. a relic that "births" constructs). Entity
  ids use the `ent_` prefix.
- **`docId`** is optional and only matters if you keep a separate wiki/notes
  system: it's the id of this person's page there, used by the Markdown export to
  link existing pages and to stub the rest. Leave it off if you don't use one.
- Omit **`portrait`** — it's set inside the app, not hand-authored.
- Omit **`pin`** — node positions are computed automatically; pins are only for
  manual drags inside the app.

## Title

A title / line of succession — held by people over time and passed via
`succession` events. Thin record; *who holds it when* is derived from those
events, never stored here.

```jsonc
{
  "id": "t_001",                // required; t_### convention
  "name": "King of Tidewater",  // required, non-empty
  "family": "Varr",             // optional: loose house tag (holders may come from any house)
  "note": "..."                 // optional: free description
}
```

A title is a pure in-tool construct (a colored thread + a derived reign list).
It carries **no `docId`**. Holders are recorded with `succession` events (see
below), never on the title itself.

## Dates (WDate)

Optional `date` on any event:

```jsonc
{ "year": 312, "month": 6, "day": 14 }   // include month/day only if granularity allows
```

Only `year` is required when a date is present. A person's lifespan is derived
from their `birth` and `death` events — there's no birth/death field on the
person.

## Events

Every event shares this base:

```jsonc
{ "id": "e_001", "type": "...", "date": { "year": 0 }, "note": "optional" }
```

`date` and `note` are optional on all types. Type-specific fields:

### birth
```jsonc
{ "type": "birth", "person": "p_002", "parents": ["p_001", "ent_001"] }
```
0 to n parents; parents may be persons or entities. A person must not appear in
their own `parents`. This is how lineage is recorded — there is no other way.

### death
```jsonc
{ "type": "death", "person": "p_001" }
```

### marriage / divorce
```jsonc
{ "type": "marriage", "persons": ["p_001", "p_003"] }
{ "type": "divorce",  "persons": ["p_001", "p_003"] }
```
≥ 2 participants. Model a remarriage as a second `marriage` event.

### adoption
```jsonc
{ "type": "adoption", "person": "p_005", "parents": ["p_001"] }
```
Like birth but adoptive; rendered with a distinct (dashed) edge.

### fusion
```jsonc
{ "type": "fusion", "inputs": ["p_002", "p_003"], "output": "p_010" }
```
The `inputs` merge **into** the `output` person. Inputs are marked
"ended-by-fusion" — they are **not deleted**, so a later `defusion` can restore
them. The `output` must be its own person record (often created for this
event); it must not also be listed in `inputs`.

### defusion
```jsonc
{ "type": "defusion", "input": "p_010", "outputs": ["p_002", "p_003"] }
```
The `input` (the fused person) ends. Each `output` is restored: an output that a
prior fusion had ended comes back ("restored", keeping its original place); an
output that never existed before is a new person hung one generation below the
fused person. `input` must not appear in `outputs`.

### bodyswap
```jsonc
{ "type": "bodyswap", "persons": ["p_001", "p_004"] }
```
≥ 2 participants; drawn as a dotted arc.

### reincarnation
```jsonc
{ "type": "reincarnation", "from": "p_001", "to": "p_007" }
```
A soul continues from a past life (`from`) into a new one (`to`) — a directional
1:1 link, drawn as a dashed violet thread. It **ends nobody**: the past life's
death (if any) is a separate `death` event, and the new life may carry its own
`birth`/parents too. `from` and `to` must be different persons.

### possession
```jsonc
{ "type": "possession", "possessor": "ent_002", "host": "p_004", "action": "seize" }
```
A `possessor` takes (`seize`) or lets go of (`release`) a `host`'s body —
directional, drawn as a dotted teal arc into the host. The possessor may be a
person **or** an entity (a spirit/demon). A `seize` and a later `release` (same
possessor + host) form an interval; neither party is ended. `action` is one of
`seize` | `release`; `possessor` and `host` must differ. Record an ongoing
possession with just a `seize`; add a `release` when it ends.

### custom
```jsonc
{ "type": "custom", "label": "Ascended", "persons": ["p_001"] }
```
Free-text milestone, ≥ 1 person. Use for anything the fixed types don't cover.

### succession
```jsonc
{ "type": "succession", "title": "t_001", "persons": ["p_001"], "action": "hold", "label": "Coronation" }
```
A moment in a title's life. `title` must match a `titles[].id`; `persons` (≥ 1)
are the holder(s) this event acts on; `action` is one of:
- **`hold`** — these persons become the holders, *replacing* anyone current (the normal handover).
- **`cohold`** — these persons join as additional holders (co-monarchy), disturbing no one.
- **`end`** — these persons stop holding (title goes vacant if they were the last).

`label` is an optional free-text name for the moment ("Coronation", "Abdicated").
A holder's tenure also ends automatically on their **death / fusion-end /
defusion-end** — don't record an `end` for that. A joint coronation is a single
event: two `persons` with `action: "hold"`.

## Worked example: small dynasty

Year-only calendar, two houses, a marriage, two children, a death.

```json
{
  "setting": "Tidewater Houses",
  "calendar": { "granularity": "year", "eraLabel": "AE", "negativeEraLabel": "VZ" },
  "persons": [
    { "id": "p_001", "name": "Aldric Varr",  "kind": "person", "family": "Varr" },
    { "id": "p_002", "name": "Mirelle Senn", "kind": "person", "family": "Senn" },
    { "id": "p_003", "name": "Tessa Varr",   "kind": "person", "family": "Varr" },
    { "id": "p_004", "name": "Kaelen Varr",  "kind": "person", "family": "Varr" }
  ],
  "titles": [
    { "id": "t_001", "name": "Lord of Tidewater", "family": "Varr" }
  ],
  "events": [
    { "id": "e_001", "type": "marriage", "persons": ["p_001", "p_002"], "date": { "year": 360 } },
    { "id": "e_002", "type": "birth", "person": "p_003", "parents": ["p_001", "p_002"], "date": { "year": 363 } },
    { "id": "e_003", "type": "birth", "person": "p_004", "parents": ["p_001", "p_002"], "date": { "year": 366 } },
    { "id": "e_004", "type": "succession", "title": "t_001", "persons": ["p_001"], "action": "hold", "label": "Invested", "date": { "year": 360 } },
    { "id": "e_005", "type": "death", "person": "p_001", "date": { "year": 410 } },
    { "id": "e_006", "type": "succession", "title": "t_001", "persons": ["p_004"], "action": "hold", "label": "Inherited", "date": { "year": 410 } }
  ]
}
```

Aldric holds from 360; his death in 410 ends his tenure automatically (no `end`
needed), and the same year Kaelen's `hold` takes the title — so the derived line
reads *Aldric 360–410 → Kaelen 410–present*.

## Worked example: exotic cases

A three-parent birth where one parent is a non-person **entity**, then a
**fusion** of two people into a new third, and finally a **defusion** that brings
them back.

```json
{
  "setting": "Quill Fusions",
  "calendar": { "granularity": "year", "eraLabel": "AE" },
  "persons": [
    { "id": "p_001", "name": "Sera",  "kind": "person", "family": "Quill" },
    { "id": "p_002", "name": "Toval", "kind": "person", "family": "Quill" },
    { "id": "ent_001", "name": "The Tide", "kind": "entity",
      "meta": { "note": "Tidal relic that quickened the first construct." } },
    { "id": "p_003", "name": "Nerei", "kind": "person", "family": "Quill" },
    { "id": "p_004", "name": "Seravol", "kind": "person", "family": "Quill",
      "meta": { "note": "Fusion of Sera + Toval." } }
  ],
  "events": [
    { "id": "e_001", "type": "birth", "person": "p_003",
      "parents": ["p_001", "p_002", "ent_001"], "date": { "year": 12 },
      "note": "Three-parent birth: two people and an entity." },
    { "id": "e_002", "type": "fusion", "inputs": ["p_001", "p_002"], "output": "p_004",
      "date": { "year": 40 } },
    { "id": "e_003", "type": "defusion", "input": "p_004", "outputs": ["p_001", "p_002"],
      "date": { "year": 47 }, "note": "Sera and Toval restored." }
  ]
}
```

Note how `p_004` (the fusion output) is a real person record created for the
fusion, and the defusion lists the original two as `outputs` so they're restored
rather than recreated.

## Validation rules

`scripts/validate.mjs` enforces these. Errors (✗) block import; warnings (⚠)
are advisory (e.g. an off-convention id, a `month` on a year-granularity date).

- Top level is an object with a non-empty `setting`, a `calendar` with a valid
  `granularity`, and `persons` + `events` arrays.
- Person ids are unique; `kind` is `person` or `entity`; `name` non-empty.
- Title ids are unique; each title `name` is non-empty (`titles` is optional).
- Event ids are unique; `type` is one of the twelve known types.
- Every id an event references exists in `persons`.
- `birth`/`adoption`: the `person` isn't in its own `parents`.
- `marriage`/`divorce`/`bodyswap`: ≥ 2 participants.
- `fusion`: `output` isn't also an `input`; `inputs` non-empty.
- `defusion`: `input` isn't also an `output`; `outputs` non-empty.
- `reincarnation`: `from` and `to` both exist and are different persons.
- `possession`: `possessor` and `host` both exist and differ; `action` is
  `seize` / `release`.
- `custom`: has a `label` and ≥ 1 person.
- `succession`: `title` resolves to a real `titles[].id`; ≥ 1 person; `action` is
  `hold` / `cohold` / `end`.
- Server-managed keys (`schemaVersion`/`revision`/`updatedAt`) should be absent.
