import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upcoming, busyUntil } from '../lib/calendar.js';

const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:a', 'DTSTART:20261102T140000Z', 'DTEND:20261102T143000Z', 'SUMMARY:Standup', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:b', 'DTSTART:20261102T193000Z', 'DTEND:20261102T203000Z', 'SUMMARY:Dentist', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:c', 'DTSTART:20261103T150000Z', 'DTEND:20261103T160000Z', 'SUMMARY:Tomorrow thing', 'END:VEVENT',
  'END:VCALENDAR'].join('\r\n');
const state = { settings: { tz: 'America/Toronto' }, routines: [], habits: [] };

async function withFeed(fn) {
  const real = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, text: async () => ics });
  process.env.CALENDAR_ICS_URL = 'https://example.test/cal.ics';
  try { await fn(); } finally {
    globalThis.fetch = real;
    delete process.env.CALENDAR_ICS_URL;
  }
}

test('upcoming lists the rest of today with titles, soonest first', () => withFeed(async () => {
  const got = await upcoming(state, Date.parse('2026-11-02T10:00:00-05:00'));
  assert.deepEqual(got.map(e => e.title), ['Dentist']);
  assert.equal(got[0].start, Date.parse('2026-11-02T19:30:00Z'));
}));

test('busy checks still see the titled intervals', () => withFeed(async () => {
  assert.equal(await busyUntil(state, Date.parse('2026-11-02T19:45:00Z')), Date.parse('2026-11-02T20:30:00Z'));
}));
