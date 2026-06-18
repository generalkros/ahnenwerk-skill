#!/usr/bin/env node
// Validate an Ahnenwerk setting JSON file before importing it into the app.
// Usage:  node validate.mjs <path-to-setting.json>
// Exits 0 if the file is import-ready, 1 if there are errors.
//
// Checks shape + referential integrity: every id referenced by an event must
// exist in persons, a person can't be their own parent, relational events need
// enough participants, etc. Warnings don't fail the run; errors do.

import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('usage: node validate.mjs <path-to-setting.json>');
  process.exit(2);
}

const errors = [];
const warnings = [];
const E = (m) => errors.push(m);
const W = (m) => warnings.push(m);

let data;
try {
  data = JSON.parse(readFileSync(path, 'utf-8'));
} catch (e) {
  console.error(`✗ Not valid JSON: ${e.message}`);
  process.exit(1);
}

const ID_RE = /^(p|ent|e)_\d{3,}$/;
const TITLE_ID_RE = /^t_\d{3,}$/;
const GRANULARITIES = ['year', 'month', 'day'];
const EVENT_TYPES = ['birth', 'death', 'marriage', 'divorce', 'adoption', 'fusion', 'defusion', 'bodyswap', 'reincarnation', 'possession', 'custom', 'succession'];
const ACTIONS = ['hold', 'cohold', 'end'];
const POSSESSION_ACTIONS = ['seize', 'release'];

// ---- top-level shape --------------------------------------------------------
if (typeof data !== 'object' || data === null || Array.isArray(data)) {
  console.error('✗ Top level must be a single JSON object.');
  process.exit(1);
}
if (typeof data.setting !== 'string' || !data.setting.trim()) E('`setting` must be a non-empty string (the display name).');
if (typeof data.calendar !== 'object' || data.calendar === null) {
  E('`calendar` object is required.');
} else if (!GRANULARITIES.includes(data.calendar.granularity)) {
  E(`calendar.granularity must be one of ${GRANULARITIES.join(' | ')}.`);
}
if (!Array.isArray(data.persons)) E('`persons` must be an array.');
if (!Array.isArray(data.events)) E('`events` must be an array.');
if (data.titles !== undefined && !Array.isArray(data.titles)) E('`titles` must be an array (or omitted).');
for (const k of ['schemaVersion', 'revision', 'updatedAt']) {
  if (k in data) W(`\`${k}\` is server-managed — remove it; the app sets it on save.`);
}
if (errors.length) report(); // exits; can't go deeper without valid arrays

const persons = data.persons ?? [];
const events = data.events ?? [];
const gran = data.calendar?.granularity;

// ---- persons ----------------------------------------------------------------
const personIds = new Set();
persons.forEach((p, i) => {
  const at = `persons[${i}]${p?.name ? ` "${p.name}"` : ''}`;
  if (typeof p !== 'object' || p === null) return E(`${at}: must be an object.`);
  if (typeof p.id !== 'string' || !p.id) E(`${at}: missing string \`id\`.`);
  else {
    if (personIds.has(p.id)) E(`${at}: duplicate id "${p.id}".`);
    personIds.add(p.id);
    if (!ID_RE.test(p.id)) W(`${at}: id "${p.id}" doesn't match the p_### / ent_### convention.`);
    if (p.kind === 'entity' && !p.id.startsWith('ent_')) W(`${at}: entity ids should start with "ent_".`);
    if (p.kind === 'person' && !p.id.startsWith('p_')) W(`${at}: person ids should start with "p_".`);
  }
  if (typeof p.name !== 'string' || !p.name.trim()) E(`${at}: \`name\` must be a non-empty string.`);
  if (p.kind !== 'person' && p.kind !== 'entity') E(`${at}: \`kind\` must be "person" or "entity".`);
});

// ---- titles -----------------------------------------------------------------
const titleIds = new Set();
const titles = Array.isArray(data.titles) ? data.titles : [];
titles.forEach((t, i) => {
  const at = `titles[${i}]${t?.name ? ` "${t.name}"` : ''}`;
  if (typeof t !== 'object' || t === null) return E(`${at}: must be an object.`);
  if (typeof t.id !== 'string' || !t.id) E(`${at}: missing string \`id\`.`);
  else {
    if (titleIds.has(t.id)) E(`${at}: duplicate title id "${t.id}".`);
    titleIds.add(t.id);
    if (!TITLE_ID_RE.test(t.id)) W(`${at}: id "${t.id}" doesn't match the t_### convention.`);
  }
  if (typeof t.name !== 'string' || !t.name.trim()) E(`${at}: \`name\` must be a non-empty string.`);
});

// ---- helpers ----------------------------------------------------------------
const eventIds = new Set();
const has = (id) => personIds.has(id);
const hasTitle = (id) => titleIds.has(id);
const checkRefs = (at, ids, label) => {
  if (!Array.isArray(ids)) return E(`${at}: \`${label}\` must be an array of ids.`);
  ids.forEach((id) => { if (!has(id)) E(`${at}: \`${label}\` references unknown id "${id}".`); });
};
const checkDate = (at, date) => {
  if (date === undefined) return;
  if (typeof date !== 'object' || date === null) return E(`${at}: \`date\` must be an object {year,...}.`);
  if (typeof date.year !== 'number') E(`${at}: \`date.year\` must be a number.`);
  if (date.month !== undefined && gran === 'year') W(`${at}: \`date.month\` set but calendar granularity is "year".`);
  if (date.day !== undefined && gran !== 'day') W(`${at}: \`date.day\` set but calendar granularity isn't "day".`);
};

// ---- events -----------------------------------------------------------------
events.forEach((e, i) => {
  const at = `events[${i}]${e?.type ? ` (${e.type})` : ''}`;
  if (typeof e !== 'object' || e === null) return E(`${at}: must be an object.`);
  if (typeof e.id !== 'string' || !e.id) E(`${at}: missing string \`id\`.`);
  else {
    if (eventIds.has(e.id)) E(`${at}: duplicate event id "${e.id}".`);
    eventIds.add(e.id);
    if (!/^e_\d{3,}$/.test(e.id)) W(`${at}: event id "${e.id}" doesn't match the e_### convention.`);
  }
  if (!EVENT_TYPES.includes(e.type)) return E(`${at}: unknown \`type\` "${e.type}".`);
  checkDate(at, e.date);

  switch (e.type) {
    case 'birth':
    case 'adoption':
      if (!has(e.person)) E(`${at}: \`person\` "${e.person}" not found.`);
      checkRefs(at, e.parents, 'parents');
      if (Array.isArray(e.parents) && e.parents.includes(e.person)) E(`${at}: a person cannot be their own parent.`);
      break;
    case 'death':
      if (!has(e.person)) E(`${at}: \`person\` "${e.person}" not found.`);
      break;
    case 'marriage':
    case 'divorce':
    case 'bodyswap':
      checkRefs(at, e.persons, 'persons');
      if (Array.isArray(e.persons) && e.persons.length < 2) E(`${at}: needs at least 2 \`persons\`.`);
      if (Array.isArray(e.persons) && new Set(e.persons).size !== e.persons.length) W(`${at}: duplicate ids in \`persons\`.`);
      break;
    case 'fusion':
      checkRefs(at, e.inputs, 'inputs');
      if (Array.isArray(e.inputs) && e.inputs.length < 1) E(`${at}: \`inputs\` needs at least 1 id.`);
      if (!has(e.output)) E(`${at}: \`output\` "${e.output}" not found.`);
      if (Array.isArray(e.inputs) && e.inputs.includes(e.output)) E(`${at}: \`output\` cannot also be an \`input\`.`);
      break;
    case 'defusion':
      if (!has(e.input)) E(`${at}: \`input\` "${e.input}" not found.`);
      checkRefs(at, e.outputs, 'outputs');
      if (Array.isArray(e.outputs) && e.outputs.length < 1) E(`${at}: \`outputs\` needs at least 1 id.`);
      if (Array.isArray(e.outputs) && e.outputs.includes(e.input)) E(`${at}: \`input\` cannot also be an \`output\`.`);
      break;
    case 'reincarnation':
      if (!has(e.from)) E(`${at}: \`from\` "${e.from}" not found.`);
      if (!has(e.to)) E(`${at}: \`to\` "${e.to}" not found.`);
      if (e.from === e.to) E(`${at}: \`from\` and \`to\` cannot be the same person.`);
      break;
    case 'possession':
      if (!has(e.possessor)) E(`${at}: \`possessor\` "${e.possessor}" not found.`);
      if (!has(e.host)) E(`${at}: \`host\` "${e.host}" not found.`);
      if (e.possessor === e.host) E(`${at}: \`possessor\` and \`host\` cannot be the same person.`);
      if (!POSSESSION_ACTIONS.includes(e.action)) E(`${at}: \`action\` must be one of ${POSSESSION_ACTIONS.join(' | ')}.`);
      break;
    case 'custom':
      if (typeof e.label !== 'string' || !e.label.trim()) E(`${at}: custom event needs a \`label\` string.`);
      checkRefs(at, e.persons, 'persons');
      if (Array.isArray(e.persons) && e.persons.length < 1) E(`${at}: custom event needs at least 1 person.`);
      break;
    case 'succession':
      if (typeof e.title !== 'string' || !e.title) E(`${at}: succession needs a \`title\` id.`);
      else if (!hasTitle(e.title)) E(`${at}: \`title\` "${e.title}" not found in titles[].`);
      checkRefs(at, e.persons, 'persons');
      if (Array.isArray(e.persons) && e.persons.length < 1) E(`${at}: succession needs at least 1 person.`);
      if (!ACTIONS.includes(e.action)) E(`${at}: \`action\` must be one of ${ACTIONS.join(' | ')}.`);
      break;
  }
});

report();

function report() {
  for (const w of warnings) console.log(`⚠ ${w}`);
  for (const e of errors) console.log(`✗ ${e}`);
  if (errors.length === 0) {
    const np = Array.isArray(data.persons) ? data.persons.length : 0;
    const ne = Array.isArray(data.events) ? data.events.length : 0;
    const nt = Array.isArray(data.titles) ? data.titles.length : 0;
    console.log(
      `✓ Import-ready — ${np} persons, ${ne} events${nt ? `, ${nt} titles` : ''}${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`,
    );
    process.exit(0);
  }
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s). Fix the errors before importing.`);
  process.exit(1);
}
