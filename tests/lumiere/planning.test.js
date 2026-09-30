import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchCounter, emptySlots } from '../../docs/lumiere/js/lib/planning.js';
import { addDays, startOfWeek, monthGrid, fmtTime } from '../../docs/lumiere/js/lib/dates.js';

const today = '2026-09-30';
const state = {
  ideas: [
    { id: 'a', status: 'shot' },
    { id: 'b', status: 'edited' },
    { id: 'c', status: 'idea' },
    { id: 'd', status: 'scheduled' },
  ],
  posts: [
    { id: 'p1', date: today, platform: 'instagram', ideaId: 'd' },
    { id: 'p2', date: today, platform: 'tiktok', ideaId: 'd' },
    { id: 'p3', date: addDays(today, 1), platform: 'instagram', ideaId: 'd' },
    { id: 'old', date: addDays(today, -1), platform: 'instagram' },
    { id: 'far', date: addDays(today, 20), platform: 'tiktok' },
  ],
};

test('batch counter with cross-posting counts only fully empty days', () => {
  const bc = batchCounter(state, today, 7, { crossPost: true });
  assert.equal(bc.slots, 14);
  assert.equal(bc.filled, 3);
  assert.equal(bc.empty, 11);
  assert.equal(bc.ideasNeeded, 5); // day 1 is half-filled, days 2-6 fully empty
  assert.equal(bc.ready, 2);
  assert.equal(bc.toFilm, 3);
});

test('batch counter without cross-posting needs one video per slot', () => {
  const bc = batchCounter(state, today, 14, { crossPost: false });
  assert.equal(bc.slots, 28);
  assert.equal(bc.empty, 25);
  assert.equal(bc.toFilm, 23);
});

test('emptySlots lists each open lane', () => {
  assert.deepEqual(emptySlots(state, [today, addDays(today, 1)]), [{ date: addDays(today, 1), platform: 'tiktok' }]);
});

test('date helpers', () => {
  assert.equal(startOfWeek('2026-09-30'), '2026-09-28'); // Wednesday -> Monday
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  const grid = monthGrid('2026-09-15');
  assert.equal(grid.length, 42);
  assert.equal(grid[0], '2026-08-31');
  assert.equal(fmtTime('18:00'), '6pm');
  assert.equal(fmtTime('09:30'), '9:30am');
});
