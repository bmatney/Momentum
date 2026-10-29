import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createRoundClock } from '../src/roundClock.js';

function fixture() {
  let time = 0;
  let id = 0;
  const jobs = new Map();
  const clock = createRoundClock({ now: () => time,
    schedule: (fn, delay) => { const key = ++id; jobs.set(key, { fn, at: time + delay }); return key; },
    cancel: key => jobs.delete(key) });
  const advance = ms => {
    const end = time + ms;
    while (jobs.size) {
      const [key, job] = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (job.at > end) break;
      jobs.delete(key); time = job.at; job.fn();
    }
    time = end;
  };
  return { clock, jobs, advance };
}
it('shares a single scheduled tick across multiple displays and alerts', () => {
  const { clock, jobs, advance } = fixture();
  let updates = 0;
  const first = clock.subscribe(() => updates++);
  const second = clock.subscribe(() => {});
  clock.configure(3000000, 3000000);
  assert.equal(jobs.size, 1);
  advance(10000);
  assert.equal(updates, 10);
  assert.equal(clock.getSnapshot(), 2990);
  assert.equal(jobs.size, 1);
  first(); second();
  assert.equal(jobs.size, 0);
});
it('does no timer work while paused, backgrounded or expired and catches up on resume', () => {
  const { clock, jobs, advance } = fixture();
  let updates = 0;
  clock.subscribe(() => updates++);
  assert.equal(jobs.size, 0);
  clock.configure(10000, 10000);
  clock.setActive(false);
  const before = updates;
  assert.equal(jobs.size, 0);
  advance(7000);
  assert.equal(updates, before);
  clock.setActive(true);
  assert.equal(clock.getSnapshot(), 3);
  assert.equal(jobs.size, 1);
  clock.configure(null, 3000);
  assert.equal(jobs.size, 0);
  advance(60000);
  assert.equal(clock.getSnapshot(), 3);
  clock.configure(70000, 3000);
  advance(3000);
  assert.equal(clock.getSnapshot(), 0);
  assert.equal(jobs.size, 0);
});
it('aligns updates to deadline seconds without accumulating tick drift', () => {
  const { clock, jobs, advance } = fixture();
  clock.subscribe(() => {});
  clock.configure(2500, 2500);
  assert.equal(clock.getSnapshot(), 3);
  assert.equal([...jobs.values()][0].at, 500);
  advance(500);
  assert.equal(clock.getSnapshot(), 2);
  clock.setActive(false);
  advance(10000);
  clock.setActive(true);
  assert.equal(clock.getSnapshot(), 0);
  assert.equal(jobs.size, 0);
});
