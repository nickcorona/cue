// Persistence: one JSON document in a private Vercel Blob, written with ETag
// checks so two concurrent writes can't silently clobber each other.
// Auth is OIDC via BLOB_STORE_ID (or a classic read-write token). Falls back to a
// local file when neither is present (local testing).
import { get, head, put, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';
import fs from 'node:fs/promises';

const PATH = 'db/state.json';
const LOCAL = process.env.LOCAL_DB || '/tmp/claude-tasks-db.json';
const useBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export function emptyState() {
  return {
    version: 1,
    settings: {
      tz: 'America/Toronto',
      capacity_min_per_day: 120, // focused task minutes you actually get on a weekday
      capacity_weekend_min: 300, // same, on Saturday and Sunday
      urgency_hard: 20,          // how much worse missing a hard deadline is than the task's value
      urgency_soft: 5,           // same for a soft due date
      default_est_min: 30,
      peak_hours: { start: '09:00', end: '12:00' },        // when deep work goes best
      personal_hours: {                                     // when calendar events eat into task time
        weekday: { start: '17:00', end: '23:00' },
        weekend: { start: '08:00', end: '23:00' },
      },
      // How much each area matters to you, 1-5. Area = the task's project.
      areas: { 'Job search': 5, Move: 5, 'Health & fitness': 4, 'Money & admin': 4, Work: 3, 'Errands & shopping': 2, Home: 2, Chores: 2, 'nick-tasks': 2, Someday: 1 },
    },
    tasks: [],
    habits: [],
    routines: [],
    estimates: [], // {est, actual, at} for the planning-fallacy correction
    goals: [],     // {project, weekly_min, archived}
    choices: [],   // check-off snapshots for later learning of the ranking weights
    meta: { last_backup: null, last_context: null },
  };
}

function migrate(s) {
  const base = emptyState();
  const out = { ...base, ...s, settings: { ...base.settings, ...(s.settings || {}) }, meta: { ...base.meta, ...(s.meta || {}) } };
  // Routine steps get stable ids and day logs key ticks by id instead of position. Ids are
  // deterministic here so repeated reads agree until the first write persists them.
  for (const r of out.routines) {
    r.steps = (r.steps || []).map((st, i) => (st.id ? st : { id: `${r.id}_${i}`, ...st }));
    for (const e of Object.values(r.log || {})) {
      if (!Array.isArray(e.steps)) continue;
      e.ticks ||= {};
      e.steps.forEach((v, i) => { if (v && r.steps[i]) e.ticks[r.steps[i].id] = 'done'; });
      delete e.steps;
    }
  }
  return out;
}

async function load() {
  if (!useBlob && process.env.VERCEL) throw new Error('Storage not connected: add a Blob store to the nick-tasks project in Vercel, then redeploy');
  if (!useBlob) {
    try { return { state: migrate(JSON.parse(await fs.readFile(LOCAL, 'utf8'))), etag: null }; }
    catch { return { state: emptyState(), etag: null }; }
  }
  // The ETag comes from head(), not get(): get() returns the CDN's ETag, which the
  // conditional put doesn't recognize. Reading the ETag first means a write that lands
  // between the two calls makes our put fail and retry instead of clobbering it.
  let etag;
  try { etag = (await head(PATH)).etag; }
  catch (e) { if (e instanceof BlobNotFoundError) return { state: emptyState(), etag: null }; throw e; }
  const r = await get(PATH, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return { state: emptyState(), etag: null };
  const text = await new Response(r.stream).text();
  return { state: migrate(JSON.parse(text)), etag };
}

async function save(state, etag, backup) {
  const body = JSON.stringify(state);
  if (!useBlob) return fs.writeFile(LOCAL, body);
  await put(PATH, body, {
    access: 'private', allowOverwrite: true, addRandomSuffix: false,
    contentType: 'application/json', ...(etag ? { ifMatch: etag } : {}),
  });
  // One snapshot per day so a bad write is never catastrophic.
  if (backup) {
    await put(`db/backup/${state.meta.last_backup}.json`, body, { access: 'private', allowOverwrite: true, addRandomSuffix: false, contentType: 'application/json' });
  }
}

export async function read() {
  return (await load()).state;
}

export async function mutate(fn) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { state, etag } = await load();
    const day = new Date().toISOString().slice(0, 10);
    const needsBackup = state.meta.last_backup !== day;
    const out = await fn(state);
    if (needsBackup) state.meta.last_backup = day;
    try {
      await save(state, etag, needsBackup);
      return out;
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) continue;
      throw e;
    }
  }
  throw new Error('Write conflict after retries, try again');
}
