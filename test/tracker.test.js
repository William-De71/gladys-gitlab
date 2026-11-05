import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diffRepository, SCENE_TRIGGERS } from '../src/tracker.js';
import { readRepository } from '../src/read.js';
import { rawRepository, NOW } from './helpers/fixtures.js';

const snap = (options) => readRepository(rawRepository(options));
const keys = (events) => events.map((event) => event.key);
const SHA = (c) => c.repeat(40);

test('the first round is the baseline: nothing is reported', () => {
  assert.deepEqual(diffRepository(null, snap()), []);
});

test('nothing changed: no event', () => {
  assert.deepEqual(diffRepository(snap(), snap()), []);
});

test('a new release, issue and merge request each fire once', () => {
  const after = snap({
    releases: [
      { tag: 'v1.3.0', name: 'v1.3.0', at: NOW },
      { tag: 'v1.2.0', name: 'Autumn', at: NOW - 86400000 },
    ],
    issues: [
      { number: 15, title: 'B', author: 'c', at: NOW },
      { number: 14, title: 'A', author: 'c', at: NOW - 1 },
      { number: 12, title: 'Crash on start', author: 'alice', at: NOW - 7200000 },
    ],
    merges: [
      { number: 16, title: 'Draft', author: 'd', at: NOW, draft: true },
      { number: 13, title: 'Fix the crash', author: 'bob', at: NOW - 3600000 },
    ],
  });
  const events = diffRepository(snap(), after);
  assert.deepEqual(keys(events), [
    SCENE_TRIGGERS.RELEASE_PUBLISHED,
    SCENE_TRIGGERS.ISSUE_OPENED,
    SCENE_TRIGGERS.ISSUE_OPENED,
    SCENE_TRIGGERS.MERGE_REQUEST_OPENED,
  ]);
  assert.equal(events[0].release.tag, 'v1.3.0');
  assert.deepEqual(
    events.slice(1, 3).map((event) => event.item.number),
    [14, 15],
  );
  assert.equal(events[3].item.draft, true);
});

test('an upcoming release fires on its date, not before', () => {
  const upcoming = snap({
    releases: [
      { tag: 'v2.0.0', name: 'v2.0.0', at: NOW + 86400000, upcoming: true },
      { tag: 'v1.2.0', name: 'Autumn', at: NOW - 86400000 },
    ],
  });
  assert.deepEqual(diffRepository(snap(), upcoming), []);
  const out = snap({
    releases: [
      { tag: 'v2.0.0', name: 'v2.0.0', at: NOW + 86400000 },
      { tag: 'v1.2.0', name: 'Autumn', at: NOW - 86400000 },
    ],
  });
  assert.deepEqual(keys(diffRepository(upcoming, out)), [SCENE_TRIGGERS.RELEASE_PUBLISHED]);
});

test('new commits on the default branch, oldest first, up to the previous head', () => {
  const after = snap({
    commits: [
      { sha: SHA('c'), message: 'Third', at: NOW + 2 },
      { sha: SHA('b'), message: 'Second', at: NOW + 1 },
      { sha: SHA('a'), message: 'Fix the crash', at: NOW - 1800000 },
    ],
    pipeline: null,
  });
  const before = snap({ pipeline: null });
  const events = diffRepository(before, after);
  assert.deepEqual(
    events.map((event) => event.commit.message),
    ['Second', 'Third'],
  );
});

test('stars going up fire with the count; going down does not', () => {
  assert.deepEqual(diffRepository(snap({ stars: 42 }), snap({ stars: 44 })), [
    { key: SCENE_TRIGGERS.STAR_ADDED, stars: 44, added: 2 },
  ]);
  assert.deepEqual(diffRepository(snap({ stars: 44 }), snap({ stars: 43 })), []);
});

test('pipeline: running then failed fires once; a new pipeline fires again; running never', () => {
  const running = snap({ pipeline: { id: 6000, status: 'running', sha: SHA('a') } });
  const failed = snap({ pipeline: { id: 6000, status: 'failed', sha: SHA('a') } });
  const events = diffRepository(running, failed);
  assert.deepEqual(keys(events), [SCENE_TRIGGERS.PIPELINE_COMPLETED]);
  assert.equal(events[0].state, 'failed');
  assert.equal(events[0].commit.message, 'Fix the crash');
  assert.deepEqual(diffRepository(failed, failed), []);
  const retried = snap({ pipeline: { id: 6001, status: 'success', sha: SHA('a') } });
  assert.equal(diffRepository(failed, retried)[0].state, 'success');
  assert.deepEqual(diffRepository(failed, running), []);
  const canceled = snap({ pipeline: { id: 6002, status: 'canceled', sha: SHA('a') } });
  assert.equal(diffRepository(retried, canceled)[0].state, 'canceled');
});
